import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackupFormatError, exportBackup, exportExcel, pickBackup } from './src/files';
import { LanguageProvider, fmtPercent, lower, setLanguage, t as tr, upper } from './src/i18n';
import {
  Analysis, Expense, SUB_TYPES, Settings, Sub, addMonths, analyse, catIndex, catName, categoryCompare, dayLabel, fmtTL, fmtTL0, frequentEntries,
  insights, iso, monthLabel, monthName, monthOnly, monthlyCost, parseAmount, shortDay, subLabel, subStatus, sum, todayIso, uid, weekdayAverages,
} from './src/lib';
import { ensurePermission, reschedule } from './src/notify';
import { BudgetPanel, ExpenseSheet, SettingsPanel, SubSheet } from './src/sheets';
import { merge, useAppData } from './src/store';
import { FONTS, Theme, useTheme } from './src/theme';
import { Amount, Bars, Button, CatIcon, SubTypeIcon, subTypeColor, DailyChart, InsightList, Ionicons, Label, MenuSection, Pill, Progress, SideMenu } from './src/ui';

export default function App() {
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

type Screen = 'ozet' | 'harcamalar' | 'raporlar' | 'abonelikler' | 'butce' | 'ayarlar';
type ExpenseSheetState = { key: number; initial: Expense | null; prefill?: { amount?: number; cat?: string } } | null;
type SubSheetState = { key: number; initial: Sub | null } | null;

const screenTitle = (screen: Screen) => tr('title.' + screen);

/** Son kaydın üzerinden geçen süre: "az önce", "12 dk önce", "3 sa önce", "2 gün önce". */
function agoText(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return tr('ago.now');
  if (m < 60) return tr('ago.min', { n: m });
  if (m < 60 * 24) return tr('ago.hour', { n: Math.floor(m / 60) });
  return tr('ago.day', { n: Math.floor(m / 1440) });
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? upper(parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')) : tr('app.monogram');
}

/**
 * Kestirme bağlantıları aynı uygulamayı açar; ne gösterileceğine açılış bağlantısına bakılarak karar verilir:
 *   ...&channel-name=ekle  → Yeni harcama formu
 *   ...&channel-name=butce → Ayarlar'daki bütçe alanı (klavye açık)
 *   ...&channel-name=main  → normal açılış (Özet)
 * Uygulama arka plandan döndüğünde hiçbir şey kendiliğinden açılmaz.
 */
function launchMode(u: string | null | undefined): 'ekle' | 'butce' | null {
  if (!u) return null;
  if (/[?&]channel-name=ekle\b/.test(u) || /\/--\/ekle\b/.test(u)) return 'ekle';
  if (/[?&]channel-name=butce\b/.test(u) || /\/--\/butce\b/.test(u)) return 'butce';
  return null;
}

// Kestirmeler / bağlantı: .../ekle?tutar=125,50&kategori=market
const SLUG: Record<string, string> = {
  market: 'Market', yeme: 'Yeme-İçme', ulasim: 'Ulaşım', fatura: 'Fatura',
  saglik: 'Sağlık', eglence: 'Eğlence', giyim: 'Giyim', diger: 'Diğer',
};

function Main() {
  const insets = useSafeAreaInsets();
  const { data, update } = useAppData();
  // Dil çizim sırasında (alt bileşenlerden önce) ayarlanır; değişince <LanguageProvider> ağacı yeniden çizdirir.
  const lang = data?.settings.language ?? 'tr';
  setLanguage(lang);
  const t = useTheme(data?.settings.theme);
  const st = useMemo(() => makeStyles(t), [t]);
  const [screen, setScreen] = useState<Screen>('ozet');
  const [budgetFocusKey, setBudgetFocusKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ym, setYm] = useState(todayIso().slice(0, 7));
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [expSheet, setExpSheet] = useState<ExpenseSheetState>(null);
  const [subSheet, setSubSheet] = useState<SubSheetState>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastAction, setToastAction] = useState<{ label: string; run: () => void } | null>(null);
  const [query, setQuery] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const toast = (m: string, action?: { label: string; run: () => void }) => {
    setToastMsg(m);
    setToastAction(action ?? null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToastMsg(''); setToastAction(null); }, action ? 4500 : 2600);
  };
  const buzz = (kind: 'success' | 'light' | 'warn' = 'light') => {
    const p = kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warn' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    p.catch(() => {});
  };
  const openAdd = () => setExpSheet({ key: Date.now(), initial: null });

  // Açılış bağlantısına ve sonradan gelen her bağlantıya göre formu ya da bütçe alanını aç
  useEffect(() => {
    const handle = (u: string | null) => {
      const mode = launchMode(u);
      if (mode === 'ekle') {
        let prefill: { amount?: number; cat?: string } | undefined;
        try {
          const q = Linking.parse(u!).queryParams ?? {};
          // Kestirme bağlantılarının biçimi (tutar=125,50) uygulama dilinden bağımsızdır: her zaman Türkçe kurallarla okunur
          const amount = parseAmount(String(q.tutar ?? ''), 'tr');
          prefill = { amount: amount || undefined, cat: SLUG[String(q.kategori ?? '').toLowerCase()] };
        } catch {}
        setMenuOpen(false);
        setExpSheet({ key: Date.now(), initial: null, prefill });
      } else if (mode === 'butce') {
        setMenuOpen(false);
        setExpSheet(null);
        setSubSheet(null);
        setScreen('butce');
        setBudgetFocusKey(Date.now());
      }
    };
    Linking.getInitialURL()
      .then((u) => handle(u || Constants.experienceUrl || null))
      .catch(() => handle(Constants.experienceUrl || null));
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // Bildirimleri veri değiştikçe yeniden kur (art arda değişikliklerde bir kez)
  useEffect(() => {
    if (!data) return;
    const h = setTimeout(() => reschedule(data.settings, data.subs, data.items), 1200);
    return () => clearTimeout(h);
  }, [data]);

  if (!data) {
    return (
      <View style={[st.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const { items, subs, settings } = data;
  const a = analyse(items, ym);
  const monthItems = items.filter((x) => x.date.slice(0, 7) === ym);
  const budget = settings.budget;

  /* ---------- Eylemler ---------- */
  const go = (key: string) => {
    setMenuOpen(false);
    if (key === 'ekle') {
      setTimeout(openAdd, 200);
      return;
    }
    setScreen(key as Screen);
    setBudgetFocusKey(0); // menüden Ayarlar'a girince klavye kendiliğinden açılmasın
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const changeMonth = (n: number) => {
    setYm(addMonths(ym, n));
    setFilterDay(null);
  };
  const saveExpense = (e: Expense) => {
    const isNew = !items.some((x) => x.id === e.id);
    update((d) => ({ ...d, items: d.items.filter((x) => x.id !== e.id).concat([e]) }));
    setExpSheet(null);
    setYm(e.date.slice(0, 7));
    buzz('success');
    toast(isNew ? tr('toast.added', { amount: fmtTL(e.amount), cat: catName(e.cat) }) : tr('toast.updated'));
  };
  const deleteExpense = (id: string) => {
    const removed = items.find((x) => x.id === id);
    update((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
    setExpSheet(null);
    buzz('warn');
    toast(tr('toast.deleted'), removed ? {
      label: tr('toast.undo'),
      run: () => update((d) => ({ ...d, items: d.items.filter((x) => x.id !== removed.id).concat([removed]) })),
    } : undefined);
  };
  const saveSub = (s: Sub) => {
    update((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== s.id).concat([s]) }));
    setSubSheet(null);
    buzz('success');
  };
  const deleteSub = (id: string) => {
    update((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== id) }));
    setSubSheet(null);
  };
  const paySub = (s: Sub) => {
    const sst = subStatus(s, items);
    const e: Expense = { id: uid(), amount: s.amount, cat: s.cat, note: s.name, date: iso(sst.due), ts: Date.now(), sub: s.id, period: sst.period };
    update((d) => ({ ...d, items: d.items.concat([e]) }));
    buzz('success');
    toast(tr('toast.subAdded', { name: s.name }));
  };
  const skipSub = (s: Sub) => {
    const period = subStatus(s, items).period;
    update((d) => ({ ...d, subs: d.subs.map((x) => (x.id === s.id ? { ...x, skip: period } : x)) }));
  };
  const changeSettings = async (next: Settings) => {
    const turnedOn = (next.remind && !settings.remind) || (next.subRemind && !settings.subRemind);
    update((d) => ({ ...d, settings: next }));
    if (next.budget !== settings.budget) toast(next.budget ? tr('toast.budgetSaved') : tr('toast.budgetRemoved'));
    if (turnedOn && !(await ensurePermission())) {
      toast(tr('toast.noNotifPermission'));
    }
  };
  const doExport = async (which: string | null) => {
    try {
      const ok = await exportExcel(items, subs, which);
      if (!ok) toast(which ? tr('toast.exportNoMonth') : tr('toast.exportNoData'));
    } catch {
      toast(tr('toast.excelFail'));
    }
  };
  const doBackup = async () => {
    try {
      await exportBackup(data);
    } catch {
      toast(tr('toast.backupFail'));
    }
  };
  const doRestore = async () => {
    try {
      const incoming = await pickBackup();
      if (!incoming) return;
      let added = 0;
      update((d) => {
        const r = merge(d, incoming);
        added = r.added;
        return r.data;
      });
      setTimeout(() => toast(added ? tr('toast.restored', { n: added }) : tr('toast.restoreNone')), 50);
    } catch (e) {
      toast(e instanceof BackupFormatError ? tr('toast.restoreBadFile') : tr('toast.restoreReadFail'));
    }
  };

  /* ---------- Ortak parçalar ---------- */
  const monthSwitcher = (
    <View style={st.months}>
      <Pressable style={st.mBtn} onPress={() => changeMonth(-1)} accessibilityLabel={tr('month.prev')}>
        <Ionicons name="chevron-back" size={20} color={t.fg} />
      </Pressable>
      <Text style={st.mLabel}>{monthLabel(ym)}</Text>
      <Pressable style={[st.mBtn, { opacity: a.isCur ? 0.35 : 1 }]} disabled={a.isCur} onPress={() => changeMonth(1)} accessibilityLabel={tr('month.next')}>
        <Ionicons name="chevron-forward" size={20} color={t.fg} />
      </Pressable>
    </View>
  );

  const expenseRow = (x: Expense, i: number, showDate = false) => (
    <Pressable
      key={x.id}
      onPress={() => setExpSheet({ key: Date.now(), initial: x })}
      style={({ pressed }) => [st.item, i > 0 && st.topLine, pressed && { backgroundColor: t.bg }]}
      accessibilityLabel={tr('expense.rowA11y', { cat: catName(x.cat), amount: fmtTL(x.amount) })}
    >
      <CatIcon cat={x.cat} t={t} />
      <View style={{ flex: 1 }}>
        <Text style={st.itemCat} numberOfLines={1}>{x.note || catName(x.cat)}</Text>
        <Text style={st.meta} numberOfLines={1}>{[x.note ? catName(x.cat) : '', showDate ? dayLabel(x.date) : '', x.sub ? tr('expense.subscriptionTag') : ''].filter(Boolean).join(' · ') || catName(x.cat)}</Text>
      </View>
      <Text style={st.itemAmt}>{fmtTL(x.amount)}</Text>
      <Ionicons name="chevron-forward" size={16} color={t.muted} />
    </Pressable>
  );

  const ctx: Ctx = { t, st, a, ym, items, subs, monthItems, budget, settings };
  const notes = insights(items, ym, settings);

  let body: ReactNode = null;
  if (screen === 'ozet') {
    const pending = subs.map((s) => ({ s, x: subStatus(s, items) })).filter((r) => r.x.state === 'pending');
    const recent = [...items].sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : q.ts - p.ts)).slice(0, 5);
    body = (
      <>
        {monthSwitcher}
        <Hero ctx={ctx} onBudget={() => { go('butce'); setBudgetFocusKey(Date.now()); }} />
        <Tiles ctx={ctx} />
        {notes.length ? (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Label t={t}>{tr('section.highlights')}</Label>
              {notes.length > 3 ? <Pressable onPress={() => go('raporlar')} hitSlop={8}><Text style={st.link}>{tr('common.all')}</Text></Pressable> : null}
            </View>
            <InsightList list={notes.slice(0, 3)} t={t} />
          </View>
        ) : null}
        {pending.length ? (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Label t={t}>{tr('section.pendingSubs')}</Label>
              <Pressable onPress={() => go('abonelikler')} hitSlop={8}><Text style={st.link}>{tr('common.all')}</Text></Pressable>
            </View>
            {pending.map(({ s }, i) => (
              <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
            ))}
          </View>
        ) : null}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Label t={t}>{tr('section.recent')}</Label>
            {recent.length ? <Pressable onPress={() => go('harcamalar')} hitSlop={8}><Text style={st.link}>{tr('common.all')}</Text></Pressable> : null}
          </View>
          {recent.length ? <View style={st.items}>{recent.map((x, i) => expenseRow(x, i, true))}</View> : <Text style={st.meta}>{tr('recent.empty')}</Text>}
        </View>
      </>
    );
  } else if (screen === 'harcamalar') {
    const q = lower(query.trim());
    // Arama tüm aylarda yapılır; arama yokken seçili ay listelenir
    const pool = q ? items : monthItems;
    const shown = pool.filter((x) => (!filterCat || x.cat === filterCat) && (!filterDay || x.date === filterDay) &&
      (!q || lower(x.note).includes(q) || lower(x.cat).includes(q) || lower(catName(x.cat)).includes(q) || fmtTL(x.amount).includes(q)));
    const groups: Record<string, Expense[]> = {};
    shown.forEach((x) => (groups[x.date] = groups[x.date] || []).push(x));
    const days = Object.keys(groups).sort().reverse();
    const cats = Array.from(new Set(monthItems.map((x) => x.cat)));
    body = (
      <>
        <View style={st.search}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={tr('search.placeholder')} placeholderTextColor={t.muted}
            style={st.searchInput} returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel={tr('search.a11y')} />
        </View>
        {q ? null : monthSwitcher}
        <View style={st.summaryRow}>
          <Text style={st.meta}>{q ? tr('search.results', { n: shown.length }) : tr('list.count', { n: shown.length })}</Text>
          <Amount text={fmtTL(sum(shown))} style={st.summaryVal} symbolColor={t.gold} />
        </View>
        {cats.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cats.map((c) => (
              <Pressable key={c} onPress={() => setFilterCat(filterCat === c ? null : c)}
                style={[st.catChip, { backgroundColor: filterCat === c ? t.accentSoft : t.surface, borderColor: filterCat === c ? t.gold : t.line }]}>
                <CatIcon cat={c} t={t} size={22} />
                <Text style={{ color: filterCat === c ? t.gold : t.fg, fontSize: 14 }}>{catName(c)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {filterDay ? (
          <View style={st.filters}>
            <Label t={t}>{tr('filter.day')}</Label>
            <Pressable style={st.fchip} onPress={() => setFilterDay(null)}><Text style={st.fchipTxt}>{shortDay(filterDay)} ✕</Text></Pressable>
          </View>
        ) : null}
        {days.length ? (
          <>
            <Text style={[st.meta, { paddingHorizontal: 4 }]}>{tr('list.hint')}</Text>
            {days.map((d) => {
              const its = groups[d].sort((p, q) => q.ts - p.ts);
              return (
                <View key={d} style={{ gap: 6 }}>
                  <View style={st.dayHead}>
                    <Label t={t}>{dayLabel(d)}</Label>
                    <Label t={t}>{fmtTL(sum(its))}</Label>
                  </View>
                  <View style={st.items}>{its.map((x, i) => expenseRow(x, i))}</View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={st.empty}>
            <Ionicons name={q ? 'search' : 'wallet-outline'} size={40} color={t.muted} />
            <Text style={st.emptyTitle}>{q ? tr('empty.noResults') : monthItems.length ? tr('empty.noMatch') : tr('empty.noMonth')}</Text>
            <Text style={[st.meta, { textAlign: 'center' }]}>
              {q ? tr('empty.tryOther') : monthItems.length ? tr('empty.removeFilter') : tr('empty.useButton')}
            </Text>
          </View>
        )}
      </>
    );
  } else if (screen === 'raporlar') {
    body = (
      <Reports
        ctx={ctx}
        notes={notes}
        filterDay={filterDay}
        onDay={(d) => setFilterDay(filterDay === d ? null : d)}
        onCat={(c) => { setFilterCat(c); setFilterDay(null); go('harcamalar'); }}
        onShowDay={() => go('harcamalar')}
        onMonth={(m) => { setYm(m); setFilterDay(null); }}
        onExport={() => doExport(ym)}
        monthSwitcher={monthSwitcher}
      />
    );
  } else if (screen === 'abonelikler') {
    const rank = { pending: 0, upcoming: 1, paid: 2, skipped: 2 };
    const when = (x: ReturnType<typeof subStatus>) => ('next' in x ? x.next : x.due).getTime();
    const rows = subs
      .map((s) => ({ s, x: subStatus(s, items) }))
      .sort((p, q) => rank[p.x.state] - rank[q.x.state] || when(p.x) - when(q.x));
    const monthly = subs.reduce((s, x) => s + monthlyCost(x), 0);
    // Türlere göre grupla; en pahalı tür üstte
    const groups = SUB_TYPES.map((tp) => {
      const list = rows.filter((r) => r.s.type === tp.key);
      return { tp, list, total: list.reduce((m, r) => m + monthlyCost(r.s), 0) };
    }).filter((g) => g.list.length).sort((p, q) => q.total - p.total);
    const pendingCount = rows.filter((r) => r.x.state === 'pending').length;
    body = (
      <>
        {subs.length ? (
          <View style={st.subSum}>
            <View><Amount text={fmtTL(monthly)} style={st.subSumVal} symbolColor={t.gold} /><Text style={st.tileSub}>{tr('subs.monthly')}</Text></View>
            <View><Amount text={fmtTL0(monthly * 12)} style={st.subSumVal} symbolColor={t.gold} /><Text style={st.tileSub}>{tr('subs.yearly')}</Text></View>
            {budget ? <View><Text style={st.subSumVal}>{fmtPercent(Math.round((monthly / budget) * 100))}</Text><Text style={st.tileSub}>{tr('subs.ofBudget')}</Text></View> : null}
          </View>
        ) : null}
        {groups.length > 1 ? (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Label t={t}>{tr('subs.byType')}</Label>
              {pendingCount ? <Pill kind="up" label={tr('subs.pendingCount', { n: pendingCount })} t={t} /> : null}
            </View>
            <View style={st.stack}>
              {groups.map((g) => <View key={g.tp.key} style={{ flex: g.total, backgroundColor: subTypeColor(g.tp.key, t) }} />)}
            </View>
            {groups.map((g, i) => (
              <View key={g.tp.key} style={[st.catRow, i > 0 && st.topLine]}>
                <SubTypeIcon type={g.tp.key} t={t} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={st.itemCat}>{subLabel(g.tp.key)}</Text>
                  <Text style={st.meta}>{tr('subs.countShare', { n: g.list.length, pct: Math.round((g.total / monthly) * 100) })}</Text>
                </View>
                <Text style={st.itemAmt}>{fmtTL(g.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {groups.length ? (
          groups.map((g) => (
            <View key={g.tp.key} style={{ gap: 6 }}>
              <View style={st.dayHead}>
                <Label t={t}>{subLabel(g.tp.key)}</Label>
                <Label t={t}>{tr('subs.perMonthTotal', { amount: fmtTL(g.total) })}</Label>
              </View>
              <View style={[st.card, { paddingVertical: 6 }]}>
                {g.list.map(({ s }, i) => (
                  <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={st.card}>
            <Text style={st.meta}>{tr('subs.empty')}</Text>
          </View>
        )}
        <Button label={tr('subs.add')} kind="ghost" onPress={() => setSubSheet({ key: Date.now(), initial: null })} t={t} />
      </>
    );
  } else if (screen === 'butce') {
    body = (
      <View style={st.card}>
        <BudgetPanel key={budgetFocusKey} focusBudget={budgetFocusKey > 0} settings={settings} onChange={changeSettings} t={t} />
      </View>
    );
  } else {
    body = (
      <View style={st.card}>
        <SettingsPanel
          settings={settings}
          onChange={changeSettings}
          onExport={doExport}
          onBackup={doBackup}
          onRestore={doRestore}
          ym={ym}
          monthLabel={monthOnly(ym)}
          t={t}
        />
      </View>
    );
  }

  const showFab = screen === 'ozet' || screen === 'harcamalar' || screen === 'raporlar';

  /* ---------- Yan menü verisi (her zaman içinde bulunulan ay) ---------- */
  const curYm = todayIso().slice(0, 7);
  const curItems = items.filter((x) => x.date.slice(0, 7) === curYm);
  const curTotal = sum(curItems);
  const byCat: Record<string, number> = {};
  curItems.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + x.amount));
  const pendingSubs = subs.filter((x) => subStatus(x, items).state === 'pending').length;
  const limitAlerts = Object.keys(settings.catBudgets).filter((c) => (byCat[c] || 0) >= settings.catBudgets[c] * 0.8).length;
  const menuSections: MenuSection[] = [
    { title: tr('menu.general'), items: [
      { key: 'ozet', label: tr('menu.home'), icon: 'grid-outline' },
      { key: 'ekle', label: tr('menu.add'), icon: 'add-circle-outline' },
      { key: 'harcamalar', label: tr('menu.expenses'), icon: 'list-outline', badge: curItems.length ? { text: String(curItems.length), kind: 'muted' } : null },
      { key: 'raporlar', label: tr('menu.reports'), icon: 'bar-chart-outline', badge: limitAlerts ? { text: String(limitAlerts), kind: 'warn' } : null },
    ] },
    { title: tr('menu.management'), items: [
      { key: 'abonelikler', label: tr('menu.subs'), icon: 'repeat-outline', badge: pendingSubs ? { text: String(pendingSubs), kind: 'gold' } : null },
      { key: 'butce', label: tr('menu.budget'), icon: 'wallet-outline' },
      { key: 'ayarlar', label: tr('menu.settings'), icon: 'settings-outline' },
    ] },
  ];
  const menuPins = Object.keys(byCat).sort((p, q) => byCat[q] - byCat[p]).slice(0, 3).map((c) => ({ cat: c, amount: fmtTL0(byCat[c]) }));
  const lastTs = items.reduce((m, x) => Math.max(m, x.ts || 0), 0);
  const curMonthName = monthOnly(curYm);

  return (
    <LanguageProvider value={lang}>
    <View style={st.root}>
      <StatusBar style={t.statusBar} />
      <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => setMenuOpen(true)} style={st.menuBtn} hitSlop={8} accessibilityLabel={tr('menu.open')} accessibilityRole="button">
          <Ionicons name="menu" size={24} color={t.fg} />
          {pendingSubs || limitAlerts ? <View style={[st.menuDot, { borderColor: t.bg }]} /> : null}
        </Pressable>
        <Text style={[st.h1, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{screenTitle(screen)}</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + (showFab ? 110 : 40) }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>

      {showFab ? (
        <View style={[st.fabBar, { paddingBottom: insets.bottom + 10 }]}>
          <Button label={tr('fab.add')} kind="primary" onPress={openAdd} t={t} style={st.fab} />
        </View>
      ) : null}

      {toastMsg ? (
        <View pointerEvents={toastAction ? 'auto' : 'none'} style={[st.toast, { bottom: insets.bottom + (showFab ? 82 : 24) }]}>
          <Text style={{ color: t.fg, fontSize: 14, flexShrink: 1 }}>{toastMsg}</Text>
          {toastAction ? (
            <Pressable hitSlop={10} onPress={() => { toastAction.run(); setToastMsg(''); setToastAction(null); buzz(); }}>
              <Text style={{ color: t.gold, fontSize: 14, fontWeight: '700' }}>{toastAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={{ title: tr('app.name'), sub: tr('menu.headerSub', { month: monthLabel(curYm) }) }}
        sections={menuSections}
        pins={menuPins}
        current={screen}
        onSelect={go}
        onPin={(c) => { setYm(curYm); setFilterCat(c); setFilterDay(null); setQuery(''); go('harcamalar'); }}
        budget={settings.budget ? {
          label: tr('menu.budgetOf', { month: curMonthName }),
          pct: Math.round((curTotal / settings.budget) * 100),
          amount: fmtTL0(curTotal),
          total: fmtTL0(settings.budget),
          over: curTotal > settings.budget,
        } : null}
        onBudget={() => { go('butce'); setBudgetFocusKey(settings.budget ? 0 : Date.now()); }}
        status={lastTs ? tr('menu.lastSaved', { ago: agoText(lastTs) }) : tr('menu.noRecords')}
        profile={{ name: settings.name || tr('menu.defaultName'), sub: tr('menu.profileSub', { theme: tr(settings.theme === 'ivory' ? 'settings.themeIvory' : settings.theme === 'system' ? 'settings.themeSystem' : 'settings.themeNoir') }), initials: initials(settings.name) }}
        top={insets.top}
        bottom={insets.bottom}
        t={t}
      />

      {expSheet ? (
        <ExpenseSheet key={expSheet.key} visible initial={expSheet.initial} prefill={expSheet.prefill} frequent={frequentEntries(items)} onSave={saveExpense} onDelete={deleteExpense} onClose={() => setExpSheet(null)} t={t} />
      ) : null}
      {subSheet ? (
        <SubSheet key={subSheet.key} visible initial={subSheet.initial} onSave={saveSub} onDelete={deleteSub} onClose={() => setSubSheet(null)} t={t} />
      ) : null}
    </View>
    </LanguageProvider>
  );
}

/* ---------- Ekran parçaları ---------- */
type Styles = ReturnType<typeof makeStyles>;
type Ctx = { t: Theme; st: Styles; a: Analysis; ym: string; items: Expense[]; subs: Sub[]; monthItems: Expense[]; budget: number; settings: Settings };

/** Özet kartı: koyu metal kart görünümü, şampanya altını ayrıntılar. */
function Hero({ ctx, onBudget }: { ctx: Ctx; onBudget: () => void }) {
  const { t, st, a, ym, items, budget } = ctx;
  const left = budget - a.total;
  return (
    <LinearGradient colors={t.heroGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
      <View style={st.heroTop}>
        <Text style={st.heroBrand}>{upper(tr('app.name'))}</Text>
        <Text style={st.heroBrand}>{upper(monthLabel(ym))}</Text>
      </View>
      <View>
        <Text style={st.heroLabel}>{a.isCur ? tr('hero.today') : tr('hero.avgDaily')}</Text>
        <Amount text={a.isCur ? fmtTL(sum(items.filter((x) => x.date === todayIso()))) : fmtTL(a.avg)} style={st.heroBig} symbolColor={t.heroLabel} />
      </View>
      <View style={st.heroRule} />
      <View style={st.heroRow}>
        <View>
          <Text style={st.heroLabel}>{a.isCur ? tr('hero.thisMonth') : tr('hero.monthTotal')}</Text>
          <Amount text={fmtTL(a.total)} style={st.heroMid} symbolColor={t.heroLabel} />
        </View>
        <Pressable onPress={onBudget} hitSlop={8} style={st.heroBudget}>
          <Text style={st.heroBudgetTxt}>{budget ? tr('hero.budget', { amount: fmtTL0(budget) }) : tr('hero.setBudget')}</Text>
        </Pressable>
      </View>
      {budget ? (
        <View style={{ gap: 8 }}>
          <View style={st.track}>
            <View style={[st.fill, { width: `${Math.min(100, (a.total / budget) * 100)}%`, backgroundColor: a.total > budget ? t.warn : t.heroFill }]} />
          </View>
          <View style={st.heroRow}>
            <Text style={st.heroSmall}>{left >= 0 ? tr('hero.left', { amount: fmtTL0(left) }) : tr('hero.over', { amount: fmtTL0(-left) })}</Text>
            <Text style={st.heroSmall}>
              {a.isCur && left > 0 ? tr('hero.perDay', { amount: fmtTL0(left / (a.dim - a.elapsed + 1)) }) : tr('hero.used', { pct: Math.round((a.total / budget) * 100) })}
            </Text>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function Tiles({ ctx }: { ctx: Ctx }) {
  const { t, st, a, monthItems, budget } = ctx;
  const tiles: { label: string; value: string; sub?: ReactNode }[] = [];
  if (!monthItems.length) {
    [tr('tile.avg'), tr('tile.vsLast'), tr('tile.busiest'), a.isCur ? tr('tile.projection') : tr('tile.count')].forEach((l) => tiles.push({ label: l, value: '—' }));
  } else {
    tiles.push({ label: tr('tile.avg'), value: fmtTL0(a.avg), sub: <Text style={st.tileSub}>{tr('tile.avgSub', { n: a.elapsed })}</Text> });
    if (a.prevSame > 0) {
      const r = Math.round(((a.curSame - a.prevSame) / a.prevSame) * 100);
      tiles.push({
        label: tr('tile.vsLast'),
        value: `${r > 0 ? '+' : r < 0 ? '−' : ''}${fmtPercent(Math.abs(r))}`,
        sub: <Pill kind={r > 0 ? 'up' : r < 0 ? 'down' : 'flat'} label={r > 0 ? tr('tile.more') : r < 0 ? tr('tile.less') : tr('tile.same')} t={t} />,
      });
    } else {
      tiles.push({ label: tr('tile.vsLast'), value: '—', sub: <Text style={st.tileSub}>{tr('tile.noLast')}</Text> });
    }
    tiles.push({ label: tr('tile.busiest'), value: fmtTL0(a.perDay[a.topDay!]), sub: <Text style={st.tileSub}>{shortDay(a.topDay!)}</Text> });
    if (a.isCur) {
      tiles.push({
        label: tr('tile.projection'),
        value: fmtTL0(a.projection),
        sub: budget ? <Pill kind={a.projection > budget ? 'up' : 'down'} label={a.projection > budget ? tr('tile.willExceed') : tr('tile.withinBudget')} t={t} /> : <Text style={st.tileSub}>{tr('tile.pace')}</Text>,
      });
    } else {
      tiles.push({ label: tr('tile.count'), value: String(monthItems.length), sub: <Text style={st.tileSub}>{tr('tile.average', { amount: fmtTL0(a.total / monthItems.length) })}</Text> });
    }
  }
  return (
    <View style={st.tiles}>
      {tiles.map((x) => (
        <View key={x.label} style={st.tile}>
          <Label t={t}>{x.label}</Label>
          <Amount text={x.value} style={st.tileVal} symbolColor={t.gold} />
          {x.sub}
        </View>
      ))}
    </View>
  );
}

function SubRow({ s, ctx, first, onEdit, onPay, onSkip }: { s: Sub; ctx: Ctx; first: boolean; onEdit: () => void; onPay: () => void; onSkip: () => void }) {
  const { t, st, items } = ctx;
  const x = subStatus(s, items);
  return (
    <View style={[st.subWrap, !first && st.topLine]}>
      <Pressable onPress={onEdit} style={st.subRow} accessibilityLabel={tr('sub.rowA11y', { name: s.name })}>
        <SubTypeIcon type={s.type} t={t} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={st.itemCat}>{s.name}</Text>
          <View style={st.metaRow}>
            <Text style={st.meta}>{s.freq === 'yearly' ? tr('sub.yearlyOn', { day: s.day, month: monthName(s.month - 1) }) : tr('sub.everyMonth', { day: s.day })}</Text>
            {x.state === 'pending' ? <Pill kind="up" label={tr('sub.pendingOn', { date: shortDay(iso(x.due)) })} t={t} /> : null}
            {x.state === 'upcoming' ? <Pill kind="flat" label={tr('sub.inDays', { n: x.days })} t={t} /> : null}
            {x.state === 'paid' || x.state === 'skipped' ? (
              <Pill kind={x.state === 'paid' ? 'down' : 'flat'} label={tr(x.state === 'paid' ? 'sub.paidNext' : 'sub.skippedNext', { date: shortDay(iso(x.next)) })} t={t} />
            ) : null}
          </View>
        </View>
        <Text style={st.itemAmt}>
          {fmtTL(s.amount)}
          <Text style={st.meta}>/{tr(s.freq === 'yearly' ? 'sub.perYear' : 'sub.perMonth')}</Text>
        </Text>
      </Pressable>
      {x.state === 'pending' ? (
        <View style={[st.subAct, { paddingLeft: 46 }]}>
          <Button label={tr('sub.markPaid')} onPress={onPay} t={t} style={st.smallBtn} />
          <Button label={tr('sub.skip')} kind="ghost" onPress={onSkip} t={t} style={st.smallBtn} />
        </View>
      ) : null}
    </View>
  );
}

function Reports({ ctx, notes, filterDay, onDay, onCat, onShowDay, onMonth, onExport, monthSwitcher }: {
  ctx: Ctx; notes: ReturnType<typeof insights>; filterDay: string | null; onDay: (d: string) => void; onCat: (c: string) => void; onShowDay: () => void;
  onMonth: (ym: string) => void; onExport: () => void; monthSwitcher: ReactNode;
}) {
  const { t, st, a, ym, items, monthItems, budget, settings } = ctx;
  const { cur, prev } = categoryCompare(items, ym);
  const week = weekdayAverages(items, ym);
  const busiest = week.reduce((m, d) => (d.value > m.value ? d : m), week[0]);
  // Son 6 ay (seçili ay dahil)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5)).map((m) => ({
    key: m,
    label: tr('monthShort.' + (+m.slice(5) - 1)),
    value: sum(items.filter((x) => x.date.slice(0, 7) === m)),
  }));
  const withData = months.filter((m) => m.value > 0);
  const avg6 = withData.length ? sum(withData.map((m) => ({ amount: m.value }))) / withData.length : 0;

  const by: Record<string, number> = {};
  const cnt: Record<string, number> = {};
  monthItems.forEach((x) => {
    by[x.cat] = (by[x.cat] || 0) + x.amount;
    cnt[x.cat] = (cnt[x.cat] || 0) + 1;
  });
  const catRows = Object.keys(by).sort((p, q) => by[q] - by[p]);
  const top = [...monthItems].sort((p, q) => q.amount - p.amount).slice(0, 5);

  return (
    <>
      {monthSwitcher}
      {notes.length ? (
        <View style={st.card}>
          <Label t={t}>{tr('section.highlights')}</Label>
          <InsightList list={notes} t={t} />
        </View>
      ) : null}
      <View style={st.card}>
        <View style={st.cardHead}>
          <Label t={t}>{tr('reports.last6')}</Label>
          {avg6 ? <Text style={st.meta}>{tr('tile.average', { amount: fmtTL0(avg6) })}</Text> : null}
        </View>
        <Bars data={months} selected={ym} onSelect={onMonth} t={t} />
      </View>

      <View style={st.card}>
        <View style={st.cardHead}>
          <Label t={t}>{tr('reports.daily')}</Label>
          <View style={st.legend}>
            <View style={st.legendItem}><View style={[st.dash, { borderColor: t.muted }]} /><Text style={st.legendTxt}>{tr('reports.legendAvg')}</Text></View>
            {budget ? <View style={st.legendItem}><View style={[st.dash, { borderColor: t.warn }]} /><Text style={st.legendTxt}>{tr('reports.legendBudget')}</Text></View> : null}
          </View>
        </View>
        <DailyChart a={a} ym={ym} budget={budget} selected={filterDay} onSelect={onDay} t={t} />
        {filterDay ? (
          <Pressable onPress={onShowDay} style={st.metaRow}>
            <Text style={st.meta}>{tr('reports.dayTotal', { day: dayLabel(filterDay), amount: fmtTL(a.perDay[filterDay] || 0) })}</Text>
            <Text style={st.link}>{tr('reports.showExpenses')}</Text>
          </Pressable>
        ) : (
          <Text style={st.meta}>{tr('reports.pickDay')}</Text>
        )}
      </View>

      {monthItems.length ? (
        <View style={st.card}>
          <View style={st.cardHead}>
            <Label t={t}>{tr('reports.weekday')}</Label>
            <Text style={st.meta}>{tr('reports.perDayAvg')}</Text>
          </View>
          <Bars data={week} selected={busiest.value ? busiest.key : undefined} t={t} height={130} />
          {busiest.value ? <Text style={st.meta}>{tr('reports.busiestDay', { day: busiest.label, amount: fmtTL0(busiest.value) })}</Text> : null}
        </View>
      ) : null}

      <View style={st.card}>
        <View style={st.cardHead}>
          <Label t={t}>{tr('reports.byCategory')}</Label>
          {monthItems.length ? <Label t={t}>{tr('list.count', { n: monthItems.length })}</Label> : null}
        </View>
        {catRows.length ? (
          <>
            <View style={st.stack}>
              {catRows.map((c) => <View key={c} style={{ flex: by[c], backgroundColor: t.cats[catIndex(c)] }} />)}
            </View>
            {catRows.map((c, i) => (
              <Pressable key={c} onPress={() => onCat(c)} style={[st.catRow, i > 0 && st.topLine]}>
                <CatIcon cat={c} t={t} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={st.metaRow}>
                    <Text style={st.itemCat}>{catName(c)}</Text>
                    <CatChange cur={cur[c] || 0} prev={prev[c] || 0} t={t} />
                  </View>
                  <Text style={st.meta}>
                    {tr('reports.catLine', { pct: Math.round((by[c] / a.total) * 100), n: cnt[c] })}
                    {settings.catBudgets[c] ? ` · ${tr('reports.limit', { amount: fmtTL0(settings.catBudgets[c]) })}` : ''}
                  </Text>
                  {settings.catBudgets[c] ? <Progress value={by[c]} max={settings.catBudgets[c]} t={t} /> : null}
                </View>
                <Text style={st.itemAmt}>{fmtTL(by[c])}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.muted} />
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={st.meta}>{tr('reports.noExpenses')}</Text>
        )}
      </View>

      {top.length ? (
        <View style={st.card}>
          <Label t={t}>{tr('reports.top')}</Label>
          {top.map((x, i) => (
            <View key={x.id} style={[st.catRow, i > 0 && st.topLine]}>
              <Text style={st.rank}>{i + 1}</Text>
              <CatIcon cat={x.cat} t={t} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={st.itemCat}>{x.note || catName(x.cat)}</Text>
                <Text style={st.meta}>{catName(x.cat)} · {shortDay(x.date)}</Text>
              </View>
              <Text style={st.itemAmt}>{fmtTL(x.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Button label={tr('reports.exportMonth', { month: monthOnly(ym) })} kind="ghost" onPress={onExport} t={t} />
    </>
  );
}

/** Geçen ayın aynı dönemine göre kategori değişimi. */
function CatChange({ cur, prev, t }: { cur: number; prev: number; t: Theme }) {
  if (!prev) return null;
  const r = Math.round(((cur - prev) / prev) * 100);
  if (!r) return null;
  return <Pill kind={r > 0 ? 'up' : 'down'} label={`${r > 0 ? '↑' : '↓'} ${fmtPercent(Math.abs(r))}`} t={t} />;
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: t.bg },
    menuDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: t.gold, borderWidth: 2 },
    menuBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.goldLine, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    h1: { fontSize: 34, fontFamily: FONTS.display, color: t.fg, letterSpacing: -0.3 },
    link: { color: t.gold, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
    months: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.goldLine, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
    mLabel: { fontSize: 19, fontFamily: FONTS.bold, color: t.fg },
    hero: { borderRadius: 26, padding: 22, gap: 16, borderWidth: 1, borderColor: 'rgba(201,168,106,0.45)', overflow: 'hidden' },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
    heroBrand: { color: t.heroLabel, fontSize: 10, letterSpacing: 2.4, fontWeight: '600' },
    heroLabel: { color: t.heroMuted, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
    heroRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(201,168,106,0.4)' },
    heroBudget: { borderWidth: 1, borderColor: 'rgba(201,168,106,0.5)', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12 },
    heroBudgetTxt: { color: t.heroLabel, fontSize: 13, fontWeight: '600' },
    fab: { height: 56, borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    heroBig: { color: t.heroFg, fontSize: 48, fontFamily: FONTS.display, marginTop: 6, letterSpacing: -0.5 },
    heroMid: { color: t.heroFg, fontSize: 26, fontFamily: FONTS.bold, marginTop: 2 },
    heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 },
    heroSmall: { color: t.heroMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    track: { height: 4, borderRadius: 99, backgroundColor: t.heroTrack, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 99 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 20, padding: 16, gap: 6 },
    tileVal: { fontSize: 24, fontFamily: FONTS.bold, color: t.fg },
    tileSub: { fontSize: 13, color: t.muted },
    card: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 22, padding: 18, gap: 14 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
    summaryVal: { fontSize: 28, fontFamily: FONTS.display, color: t.fg },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 12 },
    subSum: { flexDirection: 'row', gap: 24, paddingHorizontal: 4 },
    subSumVal: { fontSize: 26, fontFamily: FONTS.display, color: t.fg },
    subWrap: { gap: 10, paddingVertical: 10 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    subAct: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingLeft: 20 },
    smallBtn: { height: 38, borderRadius: 12, paddingHorizontal: 12 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    topLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
    legend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendTxt: { fontSize: 12, color: t.muted },
    dash: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
    stack: { flexDirection: 'row', height: 14, borderRadius: 99, overflow: 'hidden', gap: 2 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 2 },
    dot: { width: 10, height: 10, borderRadius: 3 },
    filters: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    fchip: { backgroundColor: t.accent, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12 },
    fchipTxt: { color: t.accentFg, fontSize: 14, fontWeight: '600' },
    dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    items: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 20, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
    itemCat: { fontSize: 16, fontWeight: '500', color: t.fg },
    itemAmt: { fontSize: 16, fontWeight: '500', color: t.fg, fontVariant: ['tabular-nums'] },
    meta: { fontSize: 13, color: t.muted },
    empty: { alignItems: 'center', paddingVertical: 28, gap: 4 },
    emptyTitle: { fontSize: 22, fontFamily: FONTS.bold, color: t.fg, marginTop: 6 },
    fabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: 'transparent' },
    toast: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', backgroundColor: t.raised, borderWidth: 1, borderColor: t.goldLine, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, paddingHorizontal: 12 },
    searchInput: { flex: 1, fontSize: 16, color: t.fg, height: '100%' },
    rank: { width: 16, fontSize: 15, color: t.muted, fontFamily: FONTS.bold, textAlign: 'center' },
  });
}
