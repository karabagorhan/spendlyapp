import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cur, fmtMoney, fmtStamp, needsRates, setMainCurrency, viewData, fromViewSettings } from './src/currency';
import { BackupFormatError, exportBackup, exportExcel, pickBackup } from './src/files';
import { LanguageProvider, deviceLanguage, fmtPercent, fmtTime, lower, setLanguage, t as tr, upper } from './src/i18n';
import {
  Analysis, Expense, Income, SUB_TYPES, Settings, Sub, addMonths, analyse, budgetProgress, catIndex, catName, categoryCompare, dayLabel, money, money0, frequentEntries,
  MAX_AMOUNT, balanceFor, incomeCatName, insights, iso, monthLabel, monthName, monthOnly, monthShortName, monthlyCost, parseAmount, recentTransactions, shortDay, subLabel, subStatus, sum, todayIso, uid, weekdayAverages,
} from './src/lib';
import { PermInfo, ensurePermission, permissionInfo, reschedule } from './src/notify';
import { BudgetPanel, ExpenseSheet, IncomeSheet, SettingsPanel, SubSheet } from './src/sheets';
import { merge, useAppData } from './src/store';
import { FONTS, Theme, useTheme } from './src/theme';
import { useRates } from './src/useRates';
import { AccountSection } from './src/auth/AccountSection';
import { useAccount } from './src/auth/AccountProvider';
import { Gate } from './src/auth/Gate';
import { Amount, Bars, Button, CatIcon, SubTypeIcon, subTypeColor, DailyChart, InsightList, Ionicons, Label, MenuSection, Pill, Progress, SideMenu } from './src/ui';
import {
  BalanceCard, BudgetCard, BudgetOverview, CategoriesCard, CurrencyMenu, DASH_MAX, DashHeader, DashboardSkeleton, ErrorState, IncomeIcon, InlineNotice, Pair, QuickActions,
  RecentCard, SpendingCard, SubsCard, TAB_BAR_H, TabBar,
} from './src/dashboard';

/** Web: tarayıcının kenardan "geri git" kaydırması uygulamanın kendi geri hareketiyle çakışmasın. */
function useWebOverscroll() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.textContent = 'html,body{overscroll-behavior-x:none;overscroll-behavior-y:none}';
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);
}

export default function App() {
  useWebOverscroll();
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <Gate>
        <Main />
      </Gate>
    </SafeAreaProvider>
  );
}

/**
 * Geri hareketi: sağa doğru (yatay baskın) bu kadar (px) ya da hızlıca kaydırılırsa tetiklenir. Ekranın her yerinde çalışır;
 * ana ekranda (gidecek yer yokken) yan menüyü yalnızca sol kenardaki bu genişlikte (px) başlayan kaydırma açar.
 */
const EDGE = 32;
const SWIPE_DIST = 60;

type Screen = 'ozet' | 'harcamalar' | 'raporlar' | 'abonelikler' | 'butce' | 'ayarlar';
type ExpenseSheetState = { key: number; initial: Expense | null; prefill?: { amount?: number; cat?: string } } | null;
type SubSheetState = { key: number; initial: Sub | null } | null;
type IncomeSheetState = { key: number; initial: Income | null } | null;

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
 *   ...&channel-name=ayarlar → Ayarlar ekranı (dil, para birimi, kurlar, renkler)
 *   ...&channel-name=main  → normal açılış (Özet)
 * Uygulama arka plandan döndüğünde hiçbir şey kendiliğinden açılmaz.
 */
function launchMode(u: string | null | undefined): 'ekle' | 'butce' | 'ayarlar' | null {
  if (!u) return null;
  if (/[?&]channel-name=ekle\b/.test(u) || /\/--\/ekle\b/.test(u)) return 'ekle';
  if (/[?&]channel-name=butce\b/.test(u) || /\/--\/butce\b/.test(u)) return 'butce';
  if (/[?&]channel-name=ayarlar\b/.test(u) || /\/--\/ayarlar\b/.test(u)) return 'ayarlar';
  return null;
}

// Kestirmeler / bağlantı: .../ekle?tutar=125,50&kategori=market
const SLUG: Record<string, string> = {
  market: 'Market', yeme: 'Yeme-İçme', ulasim: 'Ulaşım', fatura: 'Fatura',
  saglik: 'Sağlık', eglence: 'Eğlence', giyim: 'Giyim', diger: 'Diğer',
};

function Main() {
  const insets = useSafeAreaInsets();
  const { data, update, status, reload, recovered, saveFailed } = useAppData();
  const { notice, setNotice } = useAccount();
  const rs = useRates();
  // Dil çizim sırasında (alt bileşenlerden önce) ayarlanır; değişince <LanguageProvider> ağacı yeniden çizdirir.
  const lang = data?.settings.language ?? deviceLanguage();
  setLanguage(lang);
  // Ana para birimi de aynı şekilde çizim sırasında ayarlanır; ekranlar `money()` ile bu birimde gösterir.
  const main = data?.settings.currency ?? 'TRY';
  setMainCurrency(main);
  // Saklanan kayıtlar girildikleri para biriminde kalır; ekranlar için güncel kurla ana birime çevrilmiş görünüm üretilir.
  const view = useMemo(() => (data ? viewData(data, main, rs.rates) : null), [data, main, rs.rates]);
  const t = useTheme(data?.settings.theme, data?.settings.tint, data?.settings.accent);
  const st = useMemo(() => makeStyles(t), [t]);
  const [screen, setScreen] = useState<Screen>('ozet');
  const [history, setHistory] = useState<Screen[]>([]); // geri gitmek için önceki ekranlar
  const [budgetFocusKey, setBudgetFocusKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ym, setYm] = useState(todayIso().slice(0, 7));
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [expSheet, setExpSheet] = useState<ExpenseSheetState>(null);
  const [subSheet, setSubSheet] = useState<SubSheetState>(null);
  const [incSheet, setIncSheet] = useState<IncomeSheetState>(null);
  const [curMenu, setCurMenu] = useState(false);
  const [recoveredSeen, setRecoveredSeen] = useState(false);
  const [txnTab, setTxnTab] = useState<'expenses' | 'income'>('expenses');
  const [toastMsg, setToastMsg] = useState('');
  const [toastAction, setToastAction] = useState<{ label: string; run: () => void } | null>(null);
  const [query, setQuery] = useState('');
  // Bildirim izninin gerçek durumu (web'de yerel bildirim yok: null). İzin değişince `permTick` bildirimleri yeniden kurdurur.
  const [perm, setPerm] = useState<PermInfo | null>(null);
  const [permTick, setPermTick] = useState(0);
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
  const openAddIncome = () => setIncSheet({ key: Date.now(), initial: null });

  /* ---------- Kaydırma hareketleri ----------
   * Ekranın sol kenarından sağa kaydırma = geri (önceki ekran; ana ekranda yan menüyü açar).
   * Yan menü ve alt sayfalar da kaydırarak kapanır (yan menü: sola; alt sayfa: sol kenardan sağa). */
  const slide = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false); // geri oku yalnızca kaydırma sırasında çizilir
  const nav = useRef({ screen, history, blocked: false, canBack: false });
  nav.current = { screen, history, blocked: menuOpen || curMenu || !!expSheet || !!subSheet || !!incSheet, canBack: history.length > 0 || screen !== 'ozet' };
  const swipeBack = () => {
    const { screen: cur, history: hist } = nav.current;
    if (hist.length) {
      setScreen(hist[hist.length - 1]);
      setHistory(hist.slice(0, -1));
    } else if (cur !== 'ozet') setScreen('ozet');
    else setMenuOpen(true);
    setBudgetFocusKey(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    buzz('light');
  };
  const swipeBackRef = useRef(swipeBack);
  swipeBackRef.current = swipeBack;
  // PanResponder'ın x0/dx/dy/vx değerleri hareket yakalanınca sıfırlanır ya da önceki hareketlerden kalıntı taşıyabilir; bu yüzden dokunuşu kendimiz izleriz
  const touchX = useRef({ start: 0, startY: 0, last: 0, lastY: 0, prev: 0, prevT: 0, lastT: 0 });
  const shouldSwipe = (pageX: number, pageY: number, capture: boolean) => {
    const dx = pageX - touchX.current.start, dy = pageY - touchX.current.startY;
    if (nav.current.blocked || dx < 14 || dx < Math.abs(dy) * 2.2) return false;
    return capture ? touchX.current.start <= EDGE : nav.current.canBack;
  };
  const edgePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        const { pageX, pageY } = e.nativeEvent, now = Date.now();
        touchX.current = { start: pageX, startY: pageY, last: pageX, lastY: pageY, prev: pageX, prevT: now, lastT: now };
        return false;
      },
      // Kenardan başlayan hareket iç içe kaydırıcılardan önce yakalanır; ekranın başka yerinde yalnızca gidecek bir ekran varsa ve iç öğe (ör. yatay çipler) almadıysa
      onMoveShouldSetPanResponderCapture: (e) => shouldSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY, true),
      onMoveShouldSetPanResponder: (e) => shouldSwipe(e.nativeEvent.pageX, e.nativeEvent.pageY, false),
      onPanResponderGrant: () => setSwiping(true),
      onPanResponderMove: (e) => {
        const c = touchX.current, now = Date.now();
        if (now - c.lastT > 0) { c.prev = c.last; c.prevT = c.lastT; }
        c.last = e.nativeEvent.pageX; c.lastY = e.nativeEvent.pageY; c.lastT = now;
        slide.setValue(Math.max(0, Math.min(c.last - c.start, 140)) * 0.5);
      },
      onPanResponderRelease: () => {
        Animated.spring(slide, { toValue: 0, bounciness: 0, useNativeDriver: true }).start(() => setSwiping(false));
        const c = touchX.current, dx = c.last - c.start, dy = c.lastY - c.startY;
        const vx = (c.last - c.prev) / Math.max(1, c.lastT - c.prevT);
        // Tüm hareket boyunca yatay baskın olmalı; hız kestirmesi de yalnızca sağa doğru ve yeterince yatay harekette geçerli
        const horizontal = dx > Math.abs(dy) * 1.5;
        if (horizontal && (dx > SWIPE_DIST || (dx > 24 && vx > 0.6))) swipeBackRef.current();
      },
      onPanResponderTerminate: () => Animated.spring(slide, { toValue: 0, bounciness: 0, useNativeDriver: true }).start(() => setSwiping(false)),
    }),
  ).current;

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
          prefill = { amount: amount && amount <= MAX_AMOUNT ? amount : undefined, cat: SLUG[String(q.kategori ?? '').toLowerCase()] };
        } catch {}
        setMenuOpen(false);
        setExpSheet({ key: Date.now(), initial: null, prefill });
      } else if (mode === 'butce') {
        setMenuOpen(false);
        setExpSheet(null);
        setSubSheet(null);
        setHistory([]);
        setScreen('butce');
        setBudgetFocusKey(Date.now());
      } else if (mode === 'ayarlar') {
        setMenuOpen(false);
        setExpSheet(null);
        setSubSheet(null);
        setHistory([]);
        setScreen('ayarlar');
      }
    };
    Linking.getInitialURL()
      .then((u) => handle(u || Constants.experienceUrl || null))
      .catch(() => handle(Constants.experienceUrl || null));
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // Bildirimleri veri ya da izin değiştikçe yeniden kur (art arda değişikliklerde bir kez)
  useEffect(() => {
    if (!data) return;
    const h = setTimeout(() => reschedule(data.settings, data.subs, data.items), 1200);
    return () => clearTimeout(h);
  }, [data, permTick]);

  const refreshPerm = async () => {
    if (Platform.OS === 'web') return;
    setPerm(await permissionInfo());
    setPermTick((n) => n + 1);
  };
  // İzin durumunu aç; sistem ayarlarından dönüldüğünde de güncelle
  useEffect(() => {
    if (Platform.OS === 'web') return;
    permissionInfo().then(setPerm);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshPerm(); });
    return () => sub.remove();
  }, []);
  // Daha önce abonelik eklenmiş ama izin hiç sorulmamışsa (varsayılan açık uyarı) açılışta bir kez sor; aboneliği olmayana sorulmaz
  const askedOnStart = useRef(false);
  useEffect(() => {
    if (!data || !perm || askedOnStart.current) return;
    askedOnStart.current = true;
    if (perm.state === 'undetermined' && data.settings.subRemind && data.subs.length) ensurePermission().then(refreshPerm);
  }, [data, perm]);

  // Hesap akışından gelen başarı durumları (e-posta doğrulandı, parola güncellendi) uygulamaya geçince bildirilir
  useEffect(() => {
    if (!data || !notice) return;
    if (notice.kind === 'verified') toast(tr('auth.notice.verified'));
    else if (notice.kind === 'resetDone') toast(tr('auth.notice.resetDone'));
    else return;
    setNotice(null);
  }, [data, notice]);

  if (status === 'error') return <LanguageProvider value={lang}><ErrorState t={t} onRetry={reload} topInset={insets.top} /></LanguageProvider>;
  if (!data || !view) return <LanguageProvider value={lang}><DashboardSkeleton t={t} topInset={insets.top} /></LanguageProvider>;

  const { items, subs, settings } = view;
  const incomes = view.incomes ?? [];
  // Kur yokken çevrilemeyen kayıtlar toplamlara girmez (items/subs/incomes yalnızca çevrilenleri içerir); yalnızca listelerde özgün tutar/birimle gösterilir.
  // Abonelik "ödendi" denetimi ise çevrilemeyen ödemeleri de görmelidir (yoksa aynı dönem yeniden ödenebilir görünür).
  const un = view.unconverted;
  const payItems = items.concat(un.items);
  const amountOf = (x: { amount: number; cur?: Cur; unconv?: true }) => (x.unconv ? fmtMoney(x.amount, x.cur ?? 'TRY') : money(x.amount));
  const convSum = (xs: { amount: number; unconv?: true }[]) => sum(xs.filter((x) => !x.unconv));
  const stored = {
    item: (id: string) => data.items.find((x) => x.id === id),
    sub: (id: string) => data.subs.find((x) => x.id === id),
    income: (id: string) => data.incomes.find((x) => x.id === id),
  };
  const converting = needsRates(data, main);
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
    if (key !== screen) setHistory((h) => [...h.slice(-19), screen]);
    setScreen(key as Screen);
    setBudgetFocusKey(0); // menüden Ayarlar'a girince klavye kendiliğinden açılmasın
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const changeMonth = (n: number) => {
    setYm(addMonths(ym, n));
    setFilterDay(null);
  };
  const saveExpense = (e: Expense) => {
    const isNew = !data.items.some((x) => x.id === e.id);
    update((d) => ({ ...d, items: d.items.filter((x) => x.id !== e.id).concat([e]) }));
    setExpSheet(null);
    setYm(e.date.slice(0, 7));
    buzz('success');
    toast(isNew ? tr('toast.added', { amount: fmtMoney(e.amount, e.cur ?? main), cat: catName(e.cat) }) : tr('toast.updated'));
  };
  const deleteExpense = (id: string) => {
    const removed = stored.item(id);
    update((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) }));
    setExpSheet(null);
    buzz('warn');
    toast(tr('toast.deleted'), removed ? {
      label: tr('toast.undo'),
      run: () => update((d) => ({ ...d, items: d.items.filter((x) => x.id !== removed.id).concat([removed]) })),
    } : undefined);
  };
  const saveIncome = (x: Income) => {
    const isNew = !data.incomes.some((i) => i.id === x.id);
    update((d) => ({ ...d, incomes: d.incomes.filter((i) => i.id !== x.id).concat([x]) }));
    setIncSheet(null);
    setYm(x.date.slice(0, 7));
    buzz('success');
    toast(isNew ? tr('toast.incomeAdded', { amount: fmtMoney(x.amount, x.cur ?? main) }) : tr('toast.incomeUpdated'));
  };
  const deleteIncome = (id: string) => {
    const removed = stored.income(id);
    update((d) => ({ ...d, incomes: d.incomes.filter((i) => i.id !== id) }));
    setIncSheet(null);
    buzz('warn');
    toast(tr('toast.incomeDeleted'), removed ? {
      label: tr('toast.undo'),
      run: () => update((d) => ({ ...d, incomes: d.incomes.filter((i) => i.id !== removed.id).concat([removed]) })),
    } : undefined);
  };
  const saveSub = (s: Sub) => {
    update((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== s.id).concat([s]) }));
    setSubSheet(null);
    buzz('success');
    // Ödeme günü uyarısı varsayılan açıktır ama izin yoktur: ilk abonelik kaydında (tam gerektiği anda) izin istenir. Kalıcı reddedildiyse sorulmaz; Ayarlar'da uyarı görünür.
    if (settings.subRemind && Platform.OS !== 'web') {
      permissionInfo().then(async (p) => {
        if (p.state === 'undetermined' || (p.state === 'denied' && p.canAskAgain)) await ensurePermission();
        await refreshPerm();
      });
    }
  };
  const deleteSub = (id: string) => {
    update((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== id) }));
    setSubSheet(null);
  };
  const paySub = (s: Sub) => {
    const sst = subStatus(s, payItems);
    // Ödeme, aboneliğin kendi para biriminde ve tutarıyla yazılır (çevrilmiş değerle değil)
    const own = stored.sub(s.id) ?? s;
    const e: Expense = { id: uid(), amount: own.amount, cat: s.cat, note: s.name, date: iso(sst.due), ts: Date.now(), sub: s.id, period: sst.period, cur: own.cur ?? 'TRY' };
    update((d) => ({ ...d, items: d.items.concat([e]) }));
    buzz('success');
    toast(tr('toast.subAdded', { name: s.name }));
  };
  const skipSub = (s: Sub) => {
    const period = subStatus(s, payItems).period;
    update((d) => ({ ...d, subs: d.subs.map((x) => (x.id === s.id ? { ...x, skip: period } : x)) }));
  };
  const changeSettings = async (next: Settings) => {
    const turnedOn = (next.remind && !settings.remind) || (next.subRemind && !settings.subRemind);
    update((d) => ({ ...d, settings: fromViewSettings(next, d.settings, settings) }));
    if (next.budget !== settings.budget) toast(next.budget ? tr('toast.budgetSaved') : tr('toast.budgetRemoved'));
    if (turnedOn) {
      const granted = await ensurePermission();
      await refreshPerm();
      if (!granted) toast(tr('toast.noNotifPermission'));
    }
  };
  // Ayarlar'daki izin uyarısı: sorulabiliyorsa izin iste, kalıcı reddedilmişse sistem ayarlarını aç
  const fixNotifPermission = async () => {
    if (perm && !perm.canAskAgain) {
      Linking.openSettings().catch(() => toast(tr('toast.noNotifPermission')));
      return;
    }
    const granted = await ensurePermission();
    await refreshPerm();
    if (!granted) toast(tr('toast.noNotifPermission'));
  };
  const doExport = async (which: string | null) => {
    try {
      const note = converting && rs.rates ? tr('xl.ratesNote', { cur: main, time: fmtStamp(rs.rates.fetchedAt, fmtTime, monthShortName) }) : null;
      const ok = await exportExcel(items, subs, which, main, note, incomes);
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

  // Çevrilen tutar varken kurların ne zaman güncellendiği (dokununca Ayarlar'daki kur bölümü açılır)
  const rateNote = converting ? (
    <Pressable onPress={() => go('ayarlar')} hitSlop={6} accessibilityRole="button" style={st.rateNote}>
      <Ionicons name="swap-horizontal" size={14} color={rs.rates ? t.muted : t.warn} />
      <Text style={[st.meta, { flexShrink: 1 }, !rs.rates && { color: t.warn }]}>
        {rs.rates ? tr('rates.note', { time: fmtStamp(rs.rates.fetchedAt, fmtTime, monthShortName) }) : tr('rates.noteNone')}
      </Text>
    </Pressable>
  ) : null;

  const expenseRow = (x: Expense, i: number, showDate = false) => (
    <Pressable
      key={x.id}
      onPress={() => setExpSheet({ key: Date.now(), initial: stored.item(x.id) ?? x })}
      style={({ pressed }) => [st.item, i > 0 && st.topLine, pressed && { backgroundColor: t.bg }]}
      accessibilityLabel={tr('expense.rowA11y', { cat: catName(x.cat), amount: amountOf(x) })}
    >
      <CatIcon cat={x.cat} t={t} />
      <View style={{ flex: 1 }}>
        <Text style={st.itemCat} numberOfLines={1}>{x.note || catName(x.cat)}</Text>
        <Text style={st.meta} numberOfLines={1}>{[x.note ? catName(x.cat) : '', showDate ? dayLabel(x.date) : '', x.sub ? tr('expense.subscriptionTag') : '', x.orig ? fmtMoney(x.orig.amount, x.orig.cur) : ''].filter(Boolean).join(' · ') || catName(x.cat)}</Text>
      </View>
      <Text style={st.itemAmt}>{amountOf(x)}</Text>
      <Ionicons name="chevron-forward" size={16} color={t.muted} />
    </Pressable>
  );

  const curYm = todayIso().slice(0, 7);
  const curItems = items.filter((x) => x.date.slice(0, 7) === curYm);
  const curTotal = sum(curItems);
  const byCat: Record<string, number> = {};
  curItems.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + x.amount));
  const pendingSubs = subs.filter((x) => subStatus(x, payItems).state === 'pending').length;
  const limitAlerts = Object.keys(settings.catBudgets).filter((c) => (byCat[c] || 0) >= settings.catBudgets[c] * 0.8).length;

  const txnToggle = (
    <View style={[st.seg, { backgroundColor: t.surface, borderColor: t.line }]} accessibilityRole="tablist">
      {(['expenses', 'income'] as const).map((k) => (
        <Pressable key={k} testID={`txn-tab-${k}`} onPress={() => setTxnTab(k)} accessibilityRole="tab" aria-selected={txnTab === k}
          style={[st.segBtn, txnTab === k && { backgroundColor: t.accent }]}>
          <Text style={{ color: txnTab === k ? t.accentFg : t.muted, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{tr('txn.' + k)}</Text>
        </Pressable>
      ))}
    </View>
  );
  const incomeRow = (x: Income, i: number) => (
    <Pressable
      key={x.id}
      testID={`income-row-${i}`}
      onPress={() => setIncSheet({ key: Date.now(), initial: stored.income(x.id) ?? x })}
      style={({ pressed }) => [st.item, i > 0 && st.topLine, pressed && { backgroundColor: t.bg }]}
      accessibilityLabel={tr('income.rowA11y', { cat: incomeCatName(x.cat), amount: amountOf(x) })}
    >
      <IncomeIcon cat={x.cat} t={t} />
      <View style={{ flex: 1 }}>
        <Text style={st.itemCat} numberOfLines={1}>{x.note || incomeCatName(x.cat)}</Text>
        <Text style={st.meta} numberOfLines={1}>{[x.note ? incomeCatName(x.cat) : '', x.orig ? fmtMoney(x.orig.amount, x.orig.cur) : ''].filter(Boolean).join(' · ') || incomeCatName(x.cat)}</Text>
      </View>
      <Amount text={`+${amountOf(x)}`} style={[st.itemAmt, { color: t.good }]} />
      <Ionicons name="chevron-forward" size={16} color={t.muted} />
    </Pressable>
  );

  const ctx: Ctx = { t, st, a, ym, items, payItems, subs, monthItems, budget, settings };
  const notes = insights(items, ym, settings);

  let body: ReactNode = null;
  if (screen === 'ozet') {
    const pending = subs.map((s) => ({ s, x: subStatus(s, payItems) })).filter((r) => r.x.state === 'pending');
    const bal = balanceFor(items, incomes, ym);
    const todayAmount = a.isCur ? sum(items.filter((x) => x.date === todayIso())) : null;
    const slices = recentTransactions(items, incomes, 4);
    body = (
      <View style={st.dashBody}>
        <DashHeader t={t} name={settings.name} initials={initials(settings.name)} currency={main} onCurrency={() => setCurMenu(true)} onMenu={() => setMenuOpen(true)} alertDot={!!(pendingSubs || limitAlerts)} />
        {monthSwitcher}
        <BalanceCard t={t} bal={bal} hidden={settings.hideBalance} vsLabel={tr('bal.vsLast')} onAddIncome={openAddIncome}
          onToggle={() => changeSettings({ ...settings, hideBalance: !settings.hideBalance })} />
        <QuickActions t={t} onExpense={openAdd} onIncome={openAddIncome} onReports={() => go('raporlar')} onBudgets={() => { go('butce'); setBudgetFocusKey(budget ? 0 : Date.now()); }} />
        {converting && (rs.failed || (!rs.rates && (un.count > 0 || un.limits > 0))) ? (
          <>
            <InlineNotice t={t} kind="warn" text={rs.rates ? tr('dash.ratesFailed') : un.count > 0 ? tr('dash.unconverted', { n: un.count }) + (un.limits > 0 ? ' ' + tr('dash.limitsUnavailable', { n: un.limits }) : '') : un.limits > 0 ? tr('dash.limitsUnavailable', { n: un.limits }) : tr('dash.ratesNone')} action={rs.refreshing ? undefined : tr('state.retry')}
              onAction={async () => { const ok = await rs.refresh(); toast(ok ? tr('rates.refreshed') : tr('rates.refreshFailed')); }} />
            {rs.rates ? rateNote : null}
          </>
        ) : rateNote}
        <Pair>
          <SpendingCard t={t} a={a} ym={ym} todayAmount={todayAmount} monthTitle={monthLabel(ym)} />
          <CategoriesCard t={t} monthItems={monthItems} monthTitle={monthLabel(ym)} />
        </Pair>
        <Pair>
          <BudgetCard t={t} spent={a.total} budget={budget} periodLabel={monthLabel(ym)} onBudget={() => { go('butce'); setBudgetFocusKey(budget ? 0 : Date.now()); }} />
          <SubsCard t={t} subs={subs} items={payItems} onAll={() => go('abonelikler')} onAdd={() => setSubSheet({ key: Date.now(), initial: null })} onOpen={(x) => setSubSheet({ key: Date.now(), initial: stored.sub(x.id) ?? x })} />
        </Pair>
        {pending.length ? (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Label t={t}>{tr('section.pendingSubs')}</Label>
              <Pressable onPress={() => go('abonelikler')} hitSlop={8}><Text style={st.link}>{tr('common.all')}</Text></Pressable>
            </View>
            {pending.map(({ s }, i) => (
              <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: stored.sub(s.id) ?? s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
            ))}
          </View>
        ) : null}
        {notes.length ? (
          <View style={st.card}>
            <View style={st.cardHead}>
              <Label t={t}>{tr('section.highlights')}</Label>
              {notes.length > 3 ? <Pressable onPress={() => go('raporlar')} hitSlop={8}><Text style={st.link}>{tr('common.all')}</Text></Pressable> : null}
            </View>
            <InsightList list={notes.slice(0, 3)} t={t} />
          </View>
        ) : null}
        <Tiles ctx={ctx} />
        <RecentCard t={t} list={slices} onAll={() => go('harcamalar')}
          onOpen={(r) => (r.kind === 'income' ? setIncSheet({ key: Date.now(), initial: stored.income(r.x.id) ?? r.x }) : setExpSheet({ key: Date.now(), initial: stored.item(r.x.id) ?? r.x }))} />
      </View>
    );
  } else if (screen === 'harcamalar' && txnTab === 'income') {
    const monthIncomes = incomes.concat(un.incomes).filter((x) => x.date.slice(0, 7) === ym);
    const groups: Record<string, Income[]> = {};
    monthIncomes.forEach((x) => (groups[x.date] = groups[x.date] || []).push(x));
    const days = Object.keys(groups).sort().reverse();
    body = (
      <>
        {txnToggle}
        {monthSwitcher}
        {rateNote}
        <View style={st.summaryRow}>
          <Text style={st.meta}>{tr('list.count', { n: monthIncomes.length })}</Text>
          <Amount text={money(convSum(monthIncomes))} style={st.summaryVal} symbolColor={t.gold} />
        </View>
        {days.length ? (
          <>
            <Text style={[st.meta, { paddingHorizontal: 4 }]}>{tr('txn.incomeHint')}</Text>
            {days.map((d) => {
              const its = groups[d].sort((p, q) => q.ts - p.ts);
              return (
                <View key={d} style={{ gap: 6 }}>
                  <View style={st.dayHead}>
                    <Label t={t}>{dayLabel(d)}</Label>
                    {its.some((x) => !x.unconv) ? <Label t={t}>{money(convSum(its))}</Label> : null}
                  </View>
                  <View style={st.items}>{its.map((x, i) => incomeRow(x, i))}</View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={st.empty} testID="income-empty">
            <Ionicons name="cash-outline" size={40} color={t.muted} />
            <Text style={st.emptyTitle}>{tr('txn.incomeEmpty')}</Text>
            <Text style={[st.meta, { textAlign: 'center' }]}>{tr('txn.incomeEmptyHint')}</Text>
            <Button label={tr('qa.income')} kind="ghost" onPress={openAddIncome} t={t} style={{ marginTop: 12, minWidth: 180 }} />
          </View>
        )}
      </>
    );
  } else if (screen === 'harcamalar') {
    const q = lower(query.trim());
    // Arama tüm aylarda yapılır; arama yokken seçili ay listelenir
    const listMonth = monthItems.concat(un.items.filter((x) => x.date.slice(0, 7) === ym));
    const pool = q ? payItems : listMonth;
    const shown = pool.filter((x) => (!filterCat || x.cat === filterCat) && (!filterDay || x.date === filterDay) &&
      (!q || lower(x.note).includes(q) || lower(x.cat).includes(q) || lower(catName(x.cat)).includes(q) || amountOf(x).includes(q)));
    const groups: Record<string, Expense[]> = {};
    shown.forEach((x) => (groups[x.date] = groups[x.date] || []).push(x));
    const days = Object.keys(groups).sort().reverse();
    const cats = Array.from(new Set(listMonth.map((x) => x.cat)));
    body = (
      <>
        {txnToggle}
        <View style={st.search}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={tr('search.placeholder')} placeholderTextColor={t.muted}
            style={st.searchInput} returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel={tr('search.a11y')} />
        </View>
        {q ? null : monthSwitcher}
        {rateNote}
        <View style={st.summaryRow}>
          <Text style={st.meta}>{q ? tr('search.results', { n: shown.length }) : tr('list.count', { n: shown.length })}</Text>
          <Amount text={money(convSum(shown))} style={st.summaryVal} symbolColor={t.gold} />
        </View>
        {cats.length > 1 ? (
          <View onStartShouldSetResponderCapture={() => { touchX.current.start = 99999; return false; }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cats.map((c) => (
              <Pressable key={c} onPress={() => setFilterCat(filterCat === c ? null : c)}
                style={[st.catChip, { backgroundColor: filterCat === c ? t.accentSoft : t.surface, borderColor: filterCat === c ? t.gold : t.line }]}>
                <CatIcon cat={c} t={t} size={22} />
                <Text style={{ color: filterCat === c ? t.gold : t.fg, fontSize: 14 }}>{catName(c)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          </View>
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
                    {its.some((x) => !x.unconv) ? <Label t={t}>{money(convSum(its))}</Label> : null}
                  </View>
                  <View style={st.items}>{its.map((x, i) => expenseRow(x, i))}</View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={st.empty}>
            <Ionicons name={q ? 'search' : 'wallet-outline'} size={40} color={t.muted} />
            <Text style={st.emptyTitle}>{q ? tr('empty.noResults') : listMonth.length ? tr('empty.noMatch') : tr('empty.noMonth')}</Text>
            <Text style={[st.meta, { textAlign: 'center' }]}>
              {q ? tr('empty.tryOther') : listMonth.length ? tr('empty.removeFilter') : tr('empty.useButton')}
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
        rateNote={rateNote}
      />
    );
  } else if (screen === 'abonelikler') {
    const rank = { pending: 0, upcoming: 1, paid: 2, skipped: 2 };
    const when = (x: ReturnType<typeof subStatus>) => ('next' in x ? x.next : x.due).getTime();
    const rows = subs.concat(un.subs)
      .map((s) => ({ s, x: subStatus(s, payItems) }))
      .sort((p, q) => rank[p.x.state] - rank[q.x.state] || when(p.x) - when(q.x));
    const monthly = subs.reduce((s, x) => s + monthlyCost(x), 0); // yalnızca çevrilebilenler
    // Türlere göre grupla; en pahalı tür üstte
    const groups = SUB_TYPES.map((tp) => {
      const list = rows.filter((r) => r.s.type === tp.key);
      return { tp, list, total: list.reduce((m, r) => m + (r.s.unconv ? 0 : monthlyCost(r.s)), 0) };
    }).filter((g) => g.list.length).sort((p, q) => q.total - p.total);
    const pendingCount = rows.filter((r) => r.x.state === 'pending').length;
    body = (
      <>
        {rateNote}
        {subs.length ? (
          <View style={st.subSum}>
            <View><Amount text={money(monthly)} style={st.subSumVal} symbolColor={t.gold} /><Text style={st.tileSub}>{tr('subs.monthly')}</Text></View>
            <View><Amount text={money0(monthly * 12)} style={st.subSumVal} symbolColor={t.gold} /><Text style={st.tileSub}>{tr('subs.yearly')}</Text></View>
            {budget ? <View><Text style={st.subSumVal}>{fmtPercent(Math.round((monthly / budget) * 100))}</Text><Text style={st.tileSub}>{tr('subs.ofBudget')}</Text></View> : null}
          </View>
        ) : null}
        {groups.length > 1 && monthly > 0 ? (
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
                <Text style={st.itemAmt}>{money(g.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {groups.length ? (
          groups.map((g) => (
            <View key={g.tp.key} style={{ gap: 6 }}>
              <View style={st.dayHead}>
                <Label t={t}>{subLabel(g.tp.key)}</Label>
                {g.list.some((r) => !r.s.unconv) ? <Label t={t}>{tr('subs.perMonthTotal', { amount: money(g.total) })}</Label> : null}
              </View>
              <View style={[st.card, { paddingVertical: 6 }]}>
                {g.list.map(({ s }, i) => (
                  <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: stored.sub(s.id) ?? s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
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
      <View style={{ gap: 14 }}>
      {rateNote}
      {/* Üstte bu ayın ilerlemesi (görünüm verisi: ana para biriminde, çevrilemeyenler yok); altta form */}
      <BudgetOverview t={t} p={budgetProgress(items, settings, todayIso().slice(0, 7))} periodLabel={monthLabel(todayIso().slice(0, 7))} />
      <Label t={t}>{tr('budget.editTitle')}</Label>
      <View style={st.card}>
        <BudgetPanel key={budgetFocusKey} focusBudget={budgetFocusKey > 0} settings={settings} onChange={changeSettings} t={t} />
      </View>
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
          notifWarn={perm && perm.state !== 'granted' && (settings.remind || settings.subRemind) ? { canAskAgain: perm.canAskAgain, onFix: fixNotifPermission } : null}
          account={<AccountSection t={t} />}
          ym={ym}
          monthLabel={monthOnly(ym)}
          rates={rs.rates}
          refreshing={rs.refreshing}
          failed={rs.failed}
          onRefresh={async () => { const ok = await rs.refresh(); toast(ok ? tr('rates.refreshed') : tr('rates.refreshFailed')); }}
          t={t}
        />
      </View>
    );
  }

  // Hızlı "Ekle" düğmesi: panelde hızlı eylemler var; Harcamalar ekranının Gelirler sekmesinde gelir ekler
  const showFab = screen === 'harcamalar' || screen === 'raporlar';
  const barH = TAB_BAR_H + insets.bottom;

  /* ---------- Yan menü verisi (her zaman içinde bulunulan ay) ---------- */
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
  const menuPins = Object.keys(byCat).sort((p, q) => byCat[q] - byCat[p]).slice(0, 3).map((c) => ({ cat: c, amount: money0(byCat[c]) }));
  const lastTs = items.reduce((m, x) => Math.max(m, x.ts || 0), 0);
  const curMonthName = monthOnly(curYm);

  return (
    <LanguageProvider value={lang}>
    <View style={st.root}>
      <StatusBar style={t.statusBar} />
      <Animated.View style={{ flex: 1, transform: [{ translateX: slide }] }} {...edgePan.panHandlers}>
      {screen !== 'ozet' ? (
        <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => setMenuOpen(true)} style={st.menuBtn} hitSlop={8} accessibilityLabel={tr('menu.open')} accessibilityRole="button" testID="menu-open">
            <Ionicons name="menu" size={24} color={t.fg} />
            {pendingSubs || limitAlerts ? <View style={[st.menuDot, { borderColor: t.bg }]} /> : null}
          </Pressable>
          <Text style={[st.h1, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{screenTitle(screen)}</Text>
        </View>
      ) : null}
      <ScrollView ref={scrollRef} contentContainerStyle={[st.scroll, screen === 'ozet' && { paddingTop: insets.top + 8 }, { paddingBottom: barH + (showFab ? 96 : 28) }]} keyboardShouldPersistTaps="handled">
        <View style={st.wrap}>
          {/* Veri sorunları kalıcı bandla bildirilir (kısa bir bildirim gözden kaçabilir): kurtarılan bozuk kayıt / yazılamayan değişiklik */}
          {recovered && !recoveredSeen ? <InlineNotice t={t} kind="warn" text={tr('state.recovered')} action={tr('state.dismiss')} onAction={() => setRecoveredSeen(true)} /> : null}
          {saveFailed ? <InlineNotice t={t} kind="warn" text={tr('state.saveFailed')} /> : null}
          {body}
        </View>
      </ScrollView>

      {showFab ? (
        <View style={[st.fabBar, { bottom: barH, paddingBottom: 10 }]} pointerEvents="box-none">
          <Button label={screen === 'harcamalar' && txnTab === 'income' ? `+  ${tr('qa.income')}` : tr('fab.add')} kind="primary" onPress={screen === 'harcamalar' && txnTab === 'income' ? openAddIncome : openAdd} t={t} style={st.fab} />
        </View>
      ) : null}
      </Animated.View>
      <TabBar t={t} current={screen} onSelect={(k) => go(k)} bottomInset={insets.bottom} />
      {/* Geri hareketi sırasında kenardan beliren ok: bırakınca ne olacağını gösterir (geri ya da ana ekranda menü) */}
      {swiping ? (
      <Animated.View pointerEvents="none" style={[st.backHint, {
        opacity: slide.interpolate({ inputRange: [0, 12, 30], outputRange: [0, 0.5, 1], extrapolate: 'clamp' }),
        transform: [{ translateX: slide.interpolate({ inputRange: [0, 30], outputRange: [-46, 8], extrapolate: 'clamp' }) }],
      }]}>
        <Ionicons name={history.length > 0 || screen !== 'ozet' ? 'chevron-back' : 'menu'} size={22} color={t.accentFg} />
      </Animated.View>
      ) : null}

      {toastMsg ? (
        <View pointerEvents={toastAction ? 'auto' : 'none'} style={[st.toast, { bottom: barH + (showFab ? 82 : 18) }]}>
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
          amount: money0(curTotal),
          total: money0(settings.budget),
          over: curTotal > settings.budget,
        } : null}
        onBudget={() => { go('butce'); setBudgetFocusKey(settings.budget ? 0 : Date.now()); }}
        status={lastTs ? tr('menu.lastSaved', { ago: agoText(lastTs) }) : tr('menu.noRecords')}
        profile={{ name: settings.name || tr('menu.defaultName'), sub: tr('menu.profileSub', { theme: tr(settings.theme === 'ivory' ? 'settings.themeIvory' : settings.theme === 'system' ? 'settings.themeSystem' : 'settings.themeNoir') }), initials: initials(settings.name) }}
        top={insets.top}
        bottom={insets.bottom}
        t={t}
      />

      <CurrencyMenu visible={curMenu} t={t} current={main} rates={rs.rates} onClose={() => setCurMenu(false)}
        onPick={(c) => { setCurMenu(false); if (c !== main) changeSettings({ ...settings, currency: c }); }} />
      {incSheet ? (
        <IncomeSheet key={incSheet.key} visible initial={incSheet.initial} main={main} rates={rs.rates} onSave={saveIncome} onDelete={deleteIncome} onClose={() => setIncSheet(null)} t={t} />
      ) : null}
      {expSheet ? (
        <ExpenseSheet key={expSheet.key} visible initial={expSheet.initial} prefill={expSheet.prefill} frequent={frequentEntries(items)} lastCat={items.reduce<Expense | null>((a, e) => (!a || e.ts > a.ts ? e : a), null)?.cat} main={main} rates={rs.rates} onSave={saveExpense} onDelete={deleteExpense} onClose={() => setExpSheet(null)} t={t} />
      ) : null}
      {subSheet ? (
        <SubSheet key={subSheet.key} visible initial={subSheet.initial} main={main} rates={rs.rates} onSave={saveSub} onDelete={deleteSub} onClose={() => setSubSheet(null)} t={t} />
      ) : null}
    </View>
    </LanguageProvider>
  );
}

/* ---------- Ekran parçaları ---------- */
type Styles = ReturnType<typeof makeStyles>;
type Ctx = { t: Theme; st: Styles; a: Analysis; ym: string; items: Expense[]; payItems: Expense[]; subs: Sub[]; monthItems: Expense[]; budget: number; settings: Settings };

function Tiles({ ctx }: { ctx: Ctx }) {
  const { t, st, a, monthItems, budget } = ctx;
  const tiles: { label: string; value: string; sub?: ReactNode }[] = [];
  if (!monthItems.length) {
    [tr('tile.avg'), tr('tile.vsLast'), tr('tile.busiest'), a.isCur ? tr('tile.projection') : tr('tile.count')].forEach((l) => tiles.push({ label: l, value: '—' }));
  } else {
    tiles.push({ label: tr('tile.avg'), value: money0(a.avg), sub: <Text style={st.tileSub}>{tr('tile.avgSub', { n: a.elapsed })}</Text> });
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
    tiles.push({ label: tr('tile.busiest'), value: money0(a.perDay[a.topDay!]), sub: <Text style={st.tileSub}>{shortDay(a.topDay!)}</Text> });
    if (a.isCur) {
      tiles.push({
        label: tr('tile.projection'),
        value: money0(a.projection),
        sub: budget ? <Pill kind={a.projection > budget ? 'up' : 'down'} label={a.projection > budget ? tr('tile.willExceed') : tr('tile.withinBudget')} t={t} /> : <Text style={st.tileSub}>{tr('tile.pace')}</Text>,
      });
    } else {
      tiles.push({ label: tr('tile.count'), value: String(monthItems.length), sub: <Text style={st.tileSub}>{tr('tile.average', { amount: money0(a.total / monthItems.length) })}</Text> });
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
  const { t, st, payItems } = ctx;
  const x = subStatus(s, payItems);
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
          {s.unconv ? fmtMoney(s.amount, s.cur ?? 'TRY') : money(s.amount)}
          <Text style={st.meta}>/{tr(s.freq === 'yearly' ? 'sub.perYear' : 'sub.perMonth')}</Text>
          {s.orig ? <Text style={st.meta}>{'\n'}{fmtMoney(s.orig.amount, s.orig.cur)}</Text> : null}
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

function Reports({ ctx, notes, filterDay, onDay, onCat, onShowDay, onMonth, onExport, monthSwitcher, rateNote }: {
  ctx: Ctx; notes: ReturnType<typeof insights>; filterDay: string | null; onDay: (d: string) => void; onCat: (c: string) => void; onShowDay: () => void;
  onMonth: (ym: string) => void; onExport: () => void; monthSwitcher: ReactNode; rateNote: ReactNode;
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
      {rateNote}
      {notes.length ? (
        <View style={st.card}>
          <Label t={t}>{tr('section.highlights')}</Label>
          <InsightList list={notes} t={t} />
        </View>
      ) : null}
      <View style={st.card}>
        <View style={st.cardHead}>
          <Label t={t}>{tr('reports.last6')}</Label>
          {avg6 ? <Text style={st.meta}>{tr('tile.average', { amount: money0(avg6) })}</Text> : null}
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
            <Text style={st.meta}>{tr('reports.dayTotal', { day: dayLabel(filterDay), amount: money(a.perDay[filterDay] || 0) })}</Text>
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
          {busiest.value ? <Text style={st.meta}>{tr('reports.busiestDay', { day: busiest.label, amount: money0(busiest.value) })}</Text> : null}
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
                    {settings.catBudgets[c] ? ` · ${tr('reports.limit', { amount: money0(settings.catBudgets[c]) })}` : ''}
                  </Text>
                  {settings.catBudgets[c] ? <Progress value={by[c]} max={settings.catBudgets[c]} t={t} /> : null}
                </View>
                <Text style={st.itemAmt}>{money(by[c])}</Text>
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
              <Text style={st.itemAmt}>{money(x.amount)}</Text>
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
    scroll: { paddingHorizontal: 16, paddingTop: 8 },
    wrap: { width: '100%', maxWidth: DASH_MAX, alignSelf: 'center', gap: 16 },
    dashBody: { gap: 14 },
    seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 99, padding: 4, gap: 4 },
    segBtn: { flex: 1, minHeight: 40, borderRadius: 99, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
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
    backHint: { position: 'absolute', left: 0, top: '45%', width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    rateNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
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
    itemAmt: { textAlign: 'right', fontSize: 16, fontWeight: '500', color: t.fg, fontVariant: ['tabular-nums'] },
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
