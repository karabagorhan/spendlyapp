import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cur, amountsHidden, fmtMoney, fmtShown, fmtStamp, needsRates, setHideAmounts, setMainCurrency, viewData, fromViewSettings } from './src/currency';
import { BackupFormatError, exportBackup, exportExcel, pickBackup } from './src/files';
import { LanguageProvider, deviceLanguage, fmtPercent, fmtTime, lower, setLanguage, t as tr, upper } from './src/i18n';
import {
  Analysis, Expense, Income, SUB_TYPES, Settings, Sub, addMonths, analyse, budgetProgress, catIndex, catName, categoryCompare, dayLabel, money, money0, frequentEntries,
  MAX_AMOUNT, balanceFor, incomeCatName, insights, iso, monthLabel, monthName, monthOnly, monthShortName, monthlyCost, parseAmount, recentTransactions, shortDay, subLabel, subStatus, sum, todayIso, uid, weekdayAverages,
} from './src/lib';
import { LockLayer, authenticate, useAppLock, useLockSupported } from './src/lock';
import { PermInfo, ensurePermission, permissionInfo, reschedule } from './src/notify';
import { BudgetPanel, ExpenseSheet, IncomeSheet, SettingsPanel, SubSheet } from './src/sheets';
import { merge, useAppData } from './src/store';
import { FONTS, Theme, useTheme } from './src/theme';
import { useRates } from './src/useRates';
import { AccountSection } from './src/auth/AccountSection';
import { useAccount } from './src/auth/AccountProvider';
import { Gate } from './src/auth/Gate';
import { Amount, Bars, Button, CatIcon, EmptyState, IconBox, IconName, InsightList, Ionicons, MenuSection, Pill, PillButton, Progress, RingsChart, Segmented, SideMenu, SoftPill, SubTypeIcon, Tone, TxnRow, catIconName, DailyChart, fitWidth, subTypeColor } from './src/ui';
import {
  BalanceCard, BudgetCard, BudgetOverview, CardHead, CategoriesCard, CurrencyMenu, DASH_MAX, DashHeader, DashboardSkeleton, ErrorState, HomeBrand, IncomeIcon, InlineNotice, Pair, QuickActions,
  RecentCard, SpendingCard, SubsCard, SubsHero, TabBar, tabBarSpace,
} from './src/dashboard';
import { RADIUS, SPACE, bigAmount, cardBase, cardShadow, selectedFill, selectedLine, trackOf } from './src/design';

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
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold });
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
  const narrow = useWindowDimensions().width < 360;
  const { data, update, status, reload, recovered, saveFailed } = useAppData();
  const { notice, setNotice } = useAccount();
  const rs = useRates();
  const lock = useAppLock(!!data?.settings.lock);
  const lockSupported = useLockSupported();
  // Dil çizim sırasında (alt bileşenlerden önce) ayarlanır; değişince <LanguageProvider> ağacı yeniden çizdirir.
  const lang = data?.settings.language ?? deviceLanguage();
  setLanguage(lang);
  // Ana para birimi de aynı şekilde çizim sırasında ayarlanır; ekranlar `money()` ile bu birimde gösterir.
  const main = data?.settings.currency ?? 'TRY';
  setMainCurrency(main);
  // Gizlilik kipi de çizim sırasında ayarlanır: açıkken bütün ekranlardaki tutarlar maskelenir (veri ve dışa aktarım etkilenmez).
  setHideAmounts(data?.settings.hideBalance ?? false);
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
  const scrollRef = useRef<ScrollViewInstance>(null);

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

  // Kilitlenince açık sayfa/menüler kapanır (yerel Modal'lar kilit katmanının üstünde kalmasın)
  useEffect(() => {
    if (!lock.locked) return;
    setExpSheet(null); setSubSheet(null); setIncSheet(null); setCurMenu(false); setMenuOpen(false);
  }, [lock.locked]);

  const lockLayer = <LockLayer locked={lock.locked} covered={lock.covered} onUnlock={lock.unlock} t={t} />;
  if (status === 'error') return <LanguageProvider value={lang}><ErrorState t={t} onRetry={reload} topInset={insets.top} /></LanguageProvider>;
  if (!data || !view) return <LanguageProvider value={lang}><DashboardSkeleton t={t} topInset={insets.top} /></LanguageProvider>;

  const { items, subs, settings } = view;
  const incomes = view.incomes ?? [];
  // Kur yokken çevrilemeyen kayıtlar toplamlara girmez (items/subs/incomes yalnızca çevrilenleri içerir); yalnızca listelerde özgün tutar/birimle gösterilir.
  // Abonelik "ödendi" denetimi ise çevrilemeyen ödemeleri de görmelidir (yoksa aynı dönem yeniden ödenebilir görünür).
  const un = view.unconverted;
  const payItems = items.concat(un.items);
  const amountOf = (x: { amount: number; cur?: Cur; unconv?: true }) => (x.unconv ? fmtShown(x.amount, x.cur ?? 'TRY') : money(x.amount));
  // Ekran okuyucu etiketi: gizliyken "gizli tutar"; arama ise her zaman gerçek tutar metniyle eşleşir (yazılan şey zaten görünür)
  const amountA11y = (x: { amount: number; cur?: Cur; unconv?: true }) => (amountsHidden() ? tr('amount.hidden') : amountOf(x));
  const amountRaw = (x: { amount: number; cur?: Cur; unconv?: true }) => fmtMoney(x.amount, x.unconv ? x.cur ?? 'TRY' : main);
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
    toast(isNew ? tr('toast.added', { amount: fmtShown(e.amount, e.cur ?? main), cat: catName(e.cat) }) : tr('toast.updated'));
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
    toast(isNew ? tr('toast.incomeAdded', { amount: fmtShown(x.amount, x.cur ?? main) }) : tr('toast.incomeUpdated'));
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
    // Uygulama kilidi açılmadan önce doğrulama başarılı olmalı (kilitli kalıp çıkamama riskine karşı)
    if (next.lock && !settings.lock) {
      if ((await authenticate()) !== 'ok') { toast(tr('toast.lockFailed')); return; }
      lock.markUnlocked();
    }
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
    <View style={{ gap: 8 }}>
      <View style={st.months}>
        <Pressable style={st.mBtn} onPress={() => changeMonth(-1)} accessibilityLabel={tr('month.prev')}>
          <Ionicons name="chevron-back" size={20} color={t.fg} />
        </Pressable>
        <Text style={st.mLabel}>{monthLabel(ym)}</Text>
        <Pressable style={[st.mBtn, { opacity: a.isCur ? 0.35 : 1 }]} disabled={a.isCur} onPress={() => changeMonth(1)} accessibilityLabel={tr('month.next')}>
          <Ionicons name="chevron-forward" size={20} color={t.fg} />
        </Pressable>
      </View>
      {/* Seçili ay içinde bulunulan ay değilse: tek dokunuşla bu aya dön */}
      {a.isCur ? null : (
        <Pressable testID="month-today" onPress={() => { setYm(todayIso().slice(0, 7)); setFilterDay(null); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('month.backToCurrent')}
          style={st.monthNow}>
          <Ionicons name="return-up-back-outline" size={16} color={t.muted} />
          <Text style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{tr('month.backToCurrent')}</Text>
        </Pressable>
      )}
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

  // İşlem satırı (ortak TxnRow): başlık not ya da kategori, alt yazı kategori (not varsa) ve abonelik etiketi; başka birimde girilmişse özgün tutar tutarın altında
  const expenseRow = (x: Expense, i: number) => (
    <TxnRow key={x.id} t={t} kind="expense" cat={x.cat} first={i === 0}
      title={x.note || catName(x.cat)}
      subtitle={[x.note ? catName(x.cat) : '', x.sub ? tr('expense.subscriptionTag') : ''].filter(Boolean).join(' · ')}
      amount={amountOf(x)} orig={x.orig ? fmtShown(x.orig.amount, x.orig.cur) : undefined}
      onPress={() => setExpSheet({ key: Date.now(), initial: stored.item(x.id) ?? x })}
      a11y={tr('expense.rowA11y', { cat: catName(x.cat), amount: amountA11y(x) })} />
  );
  // Gün kartı: üstte "Bugün · ₺540" düzeninde gün adı (solda) ve gün toplamı (sağda), altında o günün satırları
  const dayCard = (d: string, total: string | null, rows: ReactNode) => (
    <View key={d} style={st.dayCard}>
      <View style={st.dayHead}>
        <Text style={st.dayLbl} numberOfLines={1}>{dayLabel(d)}</Text>
        {total !== null ? <Text style={st.dayTot}>{total}</Text> : null}
      </View>
      {rows}
    </View>
  );
  // Ay özeti kartı: işlem sayısı + toplam (iri tutar), solda gider/gelir simgesi
  const summaryCard = (kind: 'expense' | 'income', label: string, total: string) => (
    <View style={st.sumCard} testID={`txn-summary-${kind}`}>
      <IconBox icon={kind === 'income' ? 'arrow-down' : 'arrow-up'} rotate color={kind === 'income' ? t.good : t.warn} t={t} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={st.sumLbl}>{label}</Text>
        <Amount text={total} style={st.sumVal} symbolColor={t.accent} />
      </View>
    </View>
  );

  const curYm = todayIso().slice(0, 7);
  const curItems = items.filter((x) => x.date.slice(0, 7) === curYm);
  const curTotal = sum(curItems);
  const byCat: Record<string, number> = {};
  curItems.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + x.amount));
  const pendingSubs = subs.concat(un.subs).filter((x) => subStatus(x, payItems).state === 'pending').length; // rozet: çevrilemeyen abonelikler de ödeme bekler
  const limitAlerts = Object.keys(settings.catBudgets).filter((c) => (byCat[c] || 0) >= settings.catBudgets[c] * 0.8).length;

  const txnToggle = (
    <Segmented t={t} value={txnTab} onChange={setTxnTab}
      items={[{ key: 'expenses', label: tr('txn.expenses'), testID: 'txn-tab-expenses' }, { key: 'income', label: tr('txn.income'), testID: 'txn-tab-income' }]} />
  );
  const incomeRow = (x: Income, i: number) => (
    <TxnRow key={x.id} t={t} kind="income" cat={x.cat} first={i === 0} testID={`income-row-${i}`}
      title={x.note || incomeCatName(x.cat)}
      subtitle={x.note ? incomeCatName(x.cat) : ''}
      amount={amountOf(x)} orig={x.orig ? fmtShown(x.orig.amount, x.orig.cur) : undefined}
      onPress={() => setIncSheet({ key: Date.now(), initial: stored.income(x.id) ?? x })}
      a11y={tr('income.rowA11y', { cat: incomeCatName(x.cat), amount: amountA11y(x) })} />
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
        <DashHeader t={t} initials={initials(settings.name)} currency={main} onCurrency={() => setCurMenu(true)} onMenu={() => setMenuOpen(true)} onSettings={() => go('ayarlar')} alertDot={!!(pendingSubs || limitAlerts)} />
        {monthSwitcher}
        <BalanceCard t={t} bal={bal} hidden={settings.hideBalance} vsLabel={tr('bal.vsLast')} onAddIncome={openAddIncome} budget={budget}
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
            <CardHead t={t} title={tr('section.pendingSubs')} action={tr('common.all')} onAction={() => go('abonelikler')} />
            {pending.map(({ s }, i) => (
              <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: stored.sub(s.id) ?? s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
            ))}
          </View>
        ) : null}
        {notes.length ? (
          <View style={st.card}>
            <CardHead t={t} title={tr('section.highlights')} action={notes.length > 3 ? tr('common.all') : undefined} onAction={() => go('raporlar')} />
            <InsightList list={notes.slice(0, 3)} t={t} />
          </View>
        ) : null}
        <Tiles ctx={ctx} />
        <RecentCard t={t} list={slices} onAll={() => go('harcamalar')}
          onOpen={(r) => (r.kind === 'income' ? setIncSheet({ key: Date.now(), initial: stored.income(r.x.id) ?? r.x }) : setExpSheet({ key: Date.now(), initial: stored.item(r.x.id) ?? r.x }))} />
        <HomeBrand t={t} />
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
        {monthIncomes.length ? summaryCard('income', tr('list.count', { n: monthIncomes.length }), money0(convSum(monthIncomes))) : null}
        {days.length ? (
          <>
            <Text style={st.hint}>{tr('txn.incomeHint')}</Text>
            {days.map((d) => {
              const its = groups[d].sort((p, q) => q.ts - p.ts);
              return dayCard(d, its.some((x) => !x.unconv) ? money(convSum(its)) : null, its.map((x, i) => incomeRow(x, i)));
            })}
          </>
        ) : (
          <EmptyState t={t} testID="income-empty" icon="cash-outline" title={tr('txn.incomeEmpty')} hint={tr('txn.incomeEmptyHint')} action={tr('qa.income')} onAction={openAddIncome} />
        )}
      </>
    );
  } else if (screen === 'harcamalar') {
    const q = lower(query.trim());
    // Arama tüm aylarda yapılır; arama yokken seçili ay listelenir
    const listMonth = monthItems.concat(un.items.filter((x) => x.date.slice(0, 7) === ym));
    const pool = q ? payItems : listMonth;
    const shown = pool.filter((x) => (!filterCat || x.cat === filterCat) && (!filterDay || x.date === filterDay) &&
      (!q || lower(x.note).includes(q) || lower(x.cat).includes(q) || lower(catName(x.cat)).includes(q) || amountRaw(x).includes(q)));
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
            style={[st.searchInput, narrow && { fontSize: 14 }]} returnKeyType="search" accessibilityLabel={tr('search.a11y')} />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('search.clear')} style={st.searchClear}>
              <Ionicons name="close" size={14} color={t.surface} />
            </Pressable>
          ) : null}
        </View>
        {q ? null : monthSwitcher}
        {rateNote}
        {/* Boş ayda özet kartı yok (boş durum kartı anlatır); arama ya da filtre sonucu 0 olsa da gösterilir */}
        {q || listMonth.length ? summaryCard('expense', q ? tr('search.results', { n: shown.length }) : tr('list.count', { n: shown.length }), money0(convSum(shown))) : null}
        {cats.length > 1 ? (
          <View onStartShouldSetResponderCapture={() => { touchX.current.start = 99999; return false; }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[null, ...cats].map((c) => {
              const on = c === filterCat;
              return (
                <Pressable key={c ?? '_all'} onPress={() => setFilterCat(c === null || on ? null : c)} accessibilityRole="button" accessibilityState={{ selected: on }} aria-selected={on}
                  style={({ pressed }) => [st.catChip, on ? { backgroundColor: selectedFill(t), borderColor: selectedLine(t) } : { backgroundColor: t.surface, borderColor: t.line }, pressed && { opacity: 0.8 }, !c && { paddingLeft: 16 }]}>
                  {c ? <IconBox icon={catIconName(c)} color={t.cats[catIndex(c)]} t={t} size={24} /> : null}
                  <Text style={{ color: t.fg, fontSize: 14, lineHeight: 18, fontFamily: on ? FONTS.bold : FONTS.semi }}>{c ? catName(c) : tr('common.all')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          </View>
        ) : null}
        {filterDay ? (
          <View style={st.filters}>
            <Text style={st.filterLbl}>{tr('filter.day')}</Text>
            <Pressable style={st.fchip} onPress={() => setFilterDay(null)} accessibilityRole="button" accessibilityLabel={`${tr('filter.clear')}: ${shortDay(filterDay)}`}>
              <Text style={st.fchipTxt}>{shortDay(filterDay)}</Text>
              <Ionicons name="close" size={16} color={t.muted} />
            </Pressable>
          </View>
        ) : null}
        {days.length ? (
          <>
            <Text style={st.hint}>{tr('list.hint')}</Text>
            {days.map((d) => {
              const its = groups[d].sort((p, q) => q.ts - p.ts);
              return dayCard(d, its.some((x) => !x.unconv) ? money(convSum(its)) : null, its.map((x, i) => expenseRow(x, i)));
            })}
          </>
        ) : q ? (
          <EmptyState t={t} icon="search" title={tr('empty.noResults')} hint={tr('empty.tryOther')} action={tr('search.clear')} actionIcon="close" onAction={() => setQuery('')} />
        ) : listMonth.length ? (
          <EmptyState t={t} icon="funnel-outline" title={tr('empty.noMatch')} hint={tr('empty.removeFilter')} action={tr('filter.clear')} actionIcon="close" onAction={() => { setFilterCat(null); setFilterDay(null); }} />
        ) : (
          <EmptyState t={t} icon="wallet-outline" title={tr('empty.noMonth')} hint={tr('empty.useButton')} action={tr('qa.expense')} onAction={openAdd} />
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
          <SubsHero t={t} monthly={money0(monthly)} yearly={money0(monthly * 12)} share={budget ? fmtPercent(Math.round((monthly / budget) * 100)) : null} pending={pendingCount} />
        ) : null}
        {groups.length > 1 && monthly > 0 ? (
          <View style={st.card} testID="subs-types">
            <CardHead t={t} title={tr('subs.byType')} />
            <View style={st.stack}>
              {groups.filter((g) => g.total > 0).map((g) => <View key={g.tp.key} style={{ flex: g.total, borderRadius: 99, backgroundColor: subTypeColor(g.tp.key, t) }} />)}
            </View>
            <View style={{ marginBottom: -8 }}>
              {groups.map((g, i) => (
                <View key={g.tp.key} style={[st.catRow, i > 0 && st.topLine]}>
                  <SubTypeIcon type={g.tp.key} t={t} size={40} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={st.nameLine}>
                      <Text style={[st.itemCat, { flex: 1, minWidth: 0 }]}>{subLabel(g.tp.key)}</Text>
                      <Amount text={money0(g.total)} style={st.itemAmt} />
                    </View>
                    <Text style={st.meta}>{tr('subs.countShare', { n: g.list.length, pct: Math.round((g.total / monthly) * 100) })}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {groups.length ? (
          groups.map((g) => (
            <View key={g.tp.key} style={st.dayCard}>
              <View style={st.dayHead}>
                <Text style={st.dayLbl} numberOfLines={1}>{subLabel(g.tp.key)}</Text>
                {g.list.some((r) => !r.s.unconv) ? <Text style={st.dayTot}>{tr('subs.perMonthTotal', { amount: money(g.total) })}</Text> : null}
              </View>
              {g.list.map(({ s }, i) => (
                <SubRow key={s.id} s={s} ctx={ctx} first={i === 0} onEdit={() => setSubSheet({ key: Date.now(), initial: stored.sub(s.id) ?? s })} onPay={() => paySub(s)} onSkip={() => skipSub(s)} />
              ))}
            </View>
          ))
        ) : (
          <EmptyState t={t} icon="repeat-outline" title={tr('subs.emptyTitle')} hint={tr('subs.empty')} action={tr('sub.newTitle')} onAction={() => setSubSheet({ key: Date.now(), initial: null })} />
        )}
        {groups.length ? <Button label={tr('subs.add')} kind="ghost" onPress={() => setSubSheet({ key: Date.now(), initial: null })} t={t} /> : null}
      </>
    );
  } else if (screen === 'butce') {
    body = (
      <View style={{ gap: SPACE.gap }}>
      {rateNote}
      {/* Üstte bu ayın ilerlemesi (görünüm verisi: ana para biriminde, çevrilemeyenler yok); altta form */}
      <BudgetOverview t={t} p={budgetProgress(items, settings, todayIso().slice(0, 7))} periodLabel={monthLabel(todayIso().slice(0, 7))} />
      <Text style={st.section} accessibilityRole="header">{tr('budget.editTitle')}</Text>
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
          lockAvailable={lockSupported || settings.lock}
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

  // Ekleme artık sekme çubuğunun ortasındaki "+" ile (her ekranda; Harcama / Gelir seçimi); ayrı ekran düğmesi yok
  const barH = tabBarSpace(insets.bottom);

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
  const lastTs = payItems.reduce((m, x) => Math.max(m, x.ts || 0), 0);
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
          <Text style={[st.h1, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header" testID="screen-title">{screenTitle(screen)}</Text>
        </View>
      ) : null}
      <ScrollView ref={scrollRef} contentContainerStyle={[st.scroll, screen === 'ozet' && { paddingTop: insets.top + 8 }, { paddingBottom: barH + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={st.wrap}>
          {/* Veri sorunları kalıcı bandla bildirilir (kısa bir bildirim gözden kaçabilir): kurtarılan bozuk kayıt / yazılamayan değişiklik */}
          {recovered && !recoveredSeen ? <InlineNotice t={t} kind="warn" text={tr('state.recovered')} action={tr('state.dismiss')} onAction={() => setRecoveredSeen(true)} /> : null}
          {saveFailed ? <InlineNotice t={t} kind="warn" text={tr('state.saveFailed')} /> : null}
          {body}
        </View>
      </ScrollView>

      </Animated.View>
      <TabBar t={t} current={screen} onSelect={(k) => go(k)} bottomInset={insets.bottom} onAddExpense={openAdd} onAddIncome={openAddIncome} />
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
        <View pointerEvents={toastAction ? 'auto' : 'none'} style={[st.toast, { bottom: barH + 36 }]}>
          <Text style={{ color: t.fg, fontSize: 14, flexShrink: 1 }}>{toastMsg}</Text>
          {toastAction ? (
            <Pressable hitSlop={10} onPress={() => { toastAction.run(); setToastMsg(''); setToastAction(null); buzz(); }}>
              <Text style={{ color: t.gold, fontSize: 14, fontWeight: '600' }}>{toastAction.label}</Text>
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

      <CurrencyMenu visible={curMenu && !lock.locked} t={t} current={main} rates={rs.rates} onClose={() => setCurMenu(false)}
        onPick={(c) => { setCurMenu(false); if (c !== main) changeSettings({ ...settings, currency: c }); }} />
      {/* Kilitliyken yerel Modal sayfaları çizilmez (kilit katmanının üstünde açılıp veriyi göstermesinler; ör. kilitliyken gelen derin bağlantı) */}
      {incSheet && !lock.locked ? (
        <IncomeSheet key={incSheet.key} visible initial={incSheet.initial} main={main} rates={rs.rates} onSave={saveIncome} onDelete={deleteIncome} onClose={() => setIncSheet(null)} t={t} />
      ) : null}
      {expSheet && !lock.locked ? (
        <ExpenseSheet key={expSheet.key} visible initial={expSheet.initial} prefill={expSheet.prefill} frequent={frequentEntries(items)} lastCat={items.reduce<Expense | null>((a, e) => (!a || e.ts > a.ts ? e : a), null)?.cat} main={main} rates={rs.rates} onSave={saveExpense} onDelete={deleteExpense} onClose={() => setExpSheet(null)} t={t} />
      ) : null}
      {subSheet && !lock.locked ? (
        <SubSheet key={subSheet.key} visible initial={subSheet.initial} main={main} rates={rs.rates} onSave={saveSub} onDelete={deleteSub} onClose={() => setSubSheet(null)} t={t} />
      ) : null}
      {lockLayer}
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
          <Text style={st.tileLbl}>{x.label}</Text>
          <Amount text={x.value} style={st.tileVal} symbolColor={t.muted} />
          {x.sub}
        </View>
      ))}
    </View>
  );
}

/**
 * Abonelik satırı: tür simgesi, ad, ödeme takvimi ve sağda tutar; altında durum hapı (bekliyor: uyarı, yaklaşan: nötr,
 * ödendi: iyi, atlandı: soluk). Ödeme bekliyorsa tek satırda iki küçük hap düğme: "Ödendi" (vurgu) ve "Atla" (hayalet).
 */
function SubRow({ s, ctx, first, onEdit, onPay, onSkip }: { s: Sub; ctx: Ctx; first: boolean; onEdit: () => void; onPay: () => void; onSkip: () => void }) {
  const { t, st, payItems } = ctx;
  const x = subStatus(s, payItems);
  const chip: { tone: Tone; icon: IconName; label: string } =
    x.state === 'pending' ? { tone: 'warn', icon: 'time-outline', label: tr('sub.pendingOn', { date: shortDay(iso(x.due)) }) }
      : x.state === 'upcoming' ? { tone: 'neutral', icon: 'calendar-clear-outline', label: tr('sub.inDays', { n: x.days }) }
      : x.state === 'paid' ? { tone: 'good', icon: 'checkmark-circle-outline', label: tr('sub.paidNext', { date: shortDay(iso(x.next)) }) }
      : { tone: 'muted', icon: 'play-skip-forward-outline', label: tr('sub.skippedNext', { date: shortDay(iso(x.next)) }) };
  return (
    <View style={[st.subWrap, !first && st.topLine]}>
      <Pressable onPress={onEdit} style={({ pressed }) => [st.subRow, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={tr('sub.rowA11y', { name: s.name })}>
        <SubTypeIcon type={s.type} t={t} size={44} />
        {/* Tutar ad satırında; takvim satırı tutarın altına da uzanır (dar ekranda ve uzun dillerde gereksiz kırılmasın) */}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={st.nameLine}>
            <Text style={[st.itemCat, { flex: 1, minWidth: 0 }]} numberOfLines={2}>{s.name}</Text>
            <Text style={{ textAlign: 'right', flexShrink: 0 }}>
              <Amount text={s.unconv ? fmtShown(s.amount, s.cur ?? 'TRY') : money(s.amount)} style={st.itemAmt} />
              <Text style={st.meta}>/{tr(s.freq === 'yearly' ? 'sub.perYear' : 'sub.perMonth')}</Text>
            </Text>
          </View>
          <View style={st.nameLine}>
            <Text style={[st.meta, { flex: 1, minWidth: 0 }]}>{s.freq === 'yearly' ? tr('sub.yearlyOn', { day: s.day, month: monthName(s.month - 1) }) : tr('sub.everyMonth', { day: s.day })}</Text>
            {s.orig ? <Text style={[st.meta, { fontSize: 12, fontVariant: ['tabular-nums'] }]}>{fmtShown(s.orig.amount, s.orig.cur)}</Text> : null}
          </View>
        </View>
      </Pressable>
      <View style={st.subFoot}>
        <SoftPill tone={chip.tone} icon={chip.icon} label={chip.label} t={t} />
      </View>
      {x.state === 'pending' ? (
        <View style={st.subFoot}>
          <PillButton label={tr('sub.paidShort')} a11y={tr('sub.markPaid')} icon="checkmark" onPress={onPay} t={t} testID={`sub-pay-${s.id}`} />
          <PillButton label={tr('sub.skipShort')} a11y={tr('sub.skip')} icon="play-skip-forward-outline" kind="ghost" onPress={onSkip} t={t} testID={`sub-skip-${s.id}`} />
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
  const { width } = useWindowDimensions();
  const [ringW, setRingW] = useState(0);
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

  // Eşmerkezli yaylar: en çok 4 kategori halka olur; kalanlar açıklamada "Diğerleri" satırında toplanır
  const ringTop = catRows.slice(0, 4);
  const restTotal = catRows.slice(4).reduce((m, c) => m + by[c], 0);
  const legend = [
    ...ringTop.map((c) => ({ key: c, label: catName(c), value: by[c], color: t.cats[catIndex(c)] })),
    ...(restTotal ? [{ key: '_o', label: tr('dash.others'), value: restTotal, color: t.muted }] : []),
  ];
  // Geniş ekranda grafik solda, açıklama sağda; dar ekranda alt alta
  const side = width >= 360;
  const ringSize = side ? Math.min(156, Math.max(132, Math.round((ringW || 280) * 0.5))) : Math.min(184, ringW || 184);
  const ringStroke = ringSize >= 170 ? 10 : 9;
  const ringGap = 3;
  const hole = 2 * (ringSize / 2 - ringStroke - (ringTop.length - 1) * (ringStroke + ringGap));
  const totalText = money0(a.total);

  return (
    <>
      {monthSwitcher}
      {rateNote}
      <View style={st.card} testID="reports-rings">
        <CardHead t={t} title={tr('reports.overview')} sub={monthLabel(ym)} />
        {catRows.length ? (
          <View style={[{ gap: 20, alignItems: 'center' }, side && { flexDirection: 'row' }]} onLayout={(e) => setRingW(e.nativeEvent.layout.width)}>
            <RingsChart rings={ringTop.map((c) => ({ key: c, share: a.total ? by[c] / a.total : 0, color: t.cats[catIndex(c)] }))} size={ringSize} stroke={ringStroke} gap={ringGap}
              track={trackOf(t)} a11y={tr('dash.donutA11y')}>
              <Text style={{ color: t.muted, fontSize: 11, lineHeight: 14 }} numberOfLines={1}>{tr('dash.totalSpent')}</Text>
              <Amount fit text={totalText} style={{ color: t.fg, fontSize: fitWidth(totalText, 18, hole - 14, -0.3), fontFamily: FONTS.display }} symbolColor={t.muted} />
            </RingsChart>
            <View style={[{ gap: 12, alignSelf: 'stretch', justifyContent: 'center' }, side ? { flex: 1, minWidth: 0 } : { paddingHorizontal: 4 }]}>
              {legend.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color, marginTop: 4 }} />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={{ color: t.fg, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{r.label}</Text>
                    <Text style={{ color: t.muted, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>
                      {money0(r.value)} · {fmtPercent(Math.round((r.value / a.total) * 100))}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={st.cardEmpty}>
            <IconBox icon="pie-chart-outline" color={t.muted} t={t} size={48} />
            <Text style={[st.meta, { textAlign: 'center' }]}>{tr('reports.noExpenses')}</Text>
          </View>
        )}
      </View>

      {notes.length ? (
        <View style={st.card}>
          <CardHead t={t} title={tr('section.highlights')} />
          <InsightList list={notes} t={t} />
        </View>
      ) : null}

      <View style={st.card}>
        <CardHead t={t} title={tr('reports.last6')} sub={avg6 ? tr('tile.average', { amount: money0(avg6) }) : undefined} />
        <Bars data={months} selected={ym} onSelect={onMonth} t={t} />
      </View>

      <View style={st.card}>
        <CardHead t={t} title={tr('reports.daily')} />
        <View style={st.legend}>
          <View style={st.legendItem}><View style={[st.dash, { borderColor: t.muted }]} /><Text style={st.legendTxt}>{tr('reports.legendAvg')}</Text></View>
          {budget ? <View style={st.legendItem}><View style={[st.dash, { borderColor: t.warn }]} /><Text style={st.legendTxt}>{tr('reports.legendBudget')}</Text></View> : null}
        </View>
        <DailyChart a={a} ym={ym} budget={budget} selected={filterDay} onSelect={onDay} t={t} />
        {filterDay ? (
          <Pressable onPress={onShowDay} style={[st.metaRow, { justifyContent: 'space-between' }]} accessibilityRole="button">
            <Text style={[st.meta, { flexShrink: 1 }]}>{tr('reports.dayTotal', { day: dayLabel(filterDay), amount: money(a.perDay[filterDay] || 0) })}</Text>
            <Text style={st.link}>{tr('reports.showExpenses')}</Text>
          </Pressable>
        ) : (
          <Text style={st.meta}>{tr('reports.pickDay')}</Text>
        )}
      </View>

      {monthItems.length ? (
        <View style={st.card}>
          <CardHead t={t} title={tr('reports.weekday')} sub={tr('reports.perDayAvg')} />
          <Bars data={week} selected={busiest.value ? busiest.key : undefined} t={t} height={136} />
          {busiest.value ? <Text style={st.meta}>{tr('reports.busiestDay', { day: busiest.label, amount: money0(busiest.value) })}</Text> : null}
        </View>
      ) : null}

      <View style={[st.card, { gap: 8 }]}>
        <CardHead t={t} title={tr('reports.byCategory')} sub={monthItems.length ? tr('list.count', { n: monthItems.length }) : undefined} />
        {catRows.length ? (
          <View>
            {catRows.map((c, i) => (
              <Pressable key={c} onPress={() => onCat(c)} accessibilityRole="button" style={({ pressed }) => [st.catRow, i > 0 && st.topLine, pressed && { opacity: 0.75 }]}>
                <CatIcon cat={c} t={t} size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={st.nameLine}>
                    <View style={[st.metaRow, { flex: 1, minWidth: 0 }]}>
                      <Text style={st.itemCat}>{catName(c)}</Text>
                      <CatChange cur={cur[c] || 0} prev={prev[c] || 0} t={t} />
                    </View>
                    <Amount text={money0(by[c])} style={st.itemAmt} />
                  </View>
                  <Text style={st.meta}>
                    {tr('reports.catLine', { pct: Math.round((by[c] / a.total) * 100), n: cnt[c] })}
                    {settings.catBudgets[c] ? ` · ${tr('reports.limit', { amount: money0(settings.catBudgets[c]) })}` : ''}
                  </Text>
                  {settings.catBudgets[c] ? <Progress value={by[c]} max={settings.catBudgets[c]} t={t} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={st.meta}>{tr('reports.noExpenses')}</Text>
        )}
      </View>

      {top.length ? (
        <View style={[st.card, { gap: 8 }]}>
          <CardHead t={t} title={tr('reports.top')} />
          <View>
            {top.map((x, i) => (
              <TxnRow key={x.id} t={t} kind="expense" cat={x.cat} first={i === 0} title={x.note || catName(x.cat)}
                subtitle={x.note ? `${catName(x.cat)} · ${shortDay(x.date)}` : shortDay(x.date)} amount={money(x.amount)}
                a11y={tr('expense.rowA11y', { cat: catName(x.cat), amount: amountsHidden() ? tr('amount.hidden') : money(x.amount) })} />
            ))}
          </View>
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
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACE.edge, paddingBottom: 8, backgroundColor: t.bg },
    menuDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: t.gold, borderWidth: 2 },
    menuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...cardShadow(t) },
    scroll: { paddingHorizontal: SPACE.edge, paddingTop: 8 },
    wrap: { width: '100%', maxWidth: DASH_MAX, alignSelf: 'center', gap: 16 },
    dashBody: { gap: SPACE.gap },
    h1: { fontSize: 28, lineHeight: 34, fontFamily: FONTS.display, color: t.fg, letterSpacing: -0.5 },
    link: { color: t.gold, fontSize: 14, fontWeight: '600' },
    months: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...cardShadow(t) },
    monthNow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: trackOf(t) },
    mLabel: { fontSize: 17, fontFamily: FONTS.bold, color: t.fg },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { flexGrow: 1, flexBasis: '45%', ...cardBase(t), padding: 16, gap: 8 },
    tileVal: { fontSize: 22, fontFamily: FONTS.display, color: t.fg, fontVariant: ['tabular-nums'] },
    tileSub: { fontSize: 13, color: t.muted },
    tileLbl: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: t.muted },
    card: { ...cardBase(t), gap: 16 },
    sumCard: { ...cardBase(t), flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
    sumLbl: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: t.muted },
    sumVal: { ...bigAmount, fontSize: 24, lineHeight: 31, color: t.fg },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.pill, minHeight: 40, paddingVertical: 4, paddingLeft: 8, paddingRight: 16 },
    subWrap: { gap: 12, paddingVertical: 12 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nameLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    subFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingLeft: 56 },
    backHint: { position: 'absolute', left: 0, top: '45%', width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    rateNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    topLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
    legend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendTxt: { fontSize: 12, color: t.muted },
    dash: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
    stack: { flexDirection: 'row', height: 12, borderRadius: RADIUS.pill, overflow: 'hidden', gap: 4 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    cardEmpty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16 },
    filters: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    filterLbl: { fontSize: 13, fontWeight: '600', color: t.muted },
    fchip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: selectedFill(t), borderWidth: 1, borderColor: selectedLine(t), borderRadius: RADIUS.pill, paddingVertical: 4, paddingLeft: 12, paddingRight: 8 },
    fchipTxt: { color: t.fg, fontSize: 14, fontFamily: FONTS.semi },
    dayCard: { ...cardBase(t), paddingTop: 16, paddingBottom: 4 },
    dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 2 },
    dayLbl: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: t.muted },
    dayTot: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: t.muted, fontVariant: ['tabular-nums'], textAlign: 'right' },
    itemCat: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: t.fg },
    itemAmt: { textAlign: 'right', fontSize: 15, fontWeight: '600', color: t.fg, fontVariant: ['tabular-nums'] },
    meta: { fontSize: 13, lineHeight: 18, color: t.muted },
    hint: { fontSize: 13, lineHeight: 18, color: t.muted, paddingHorizontal: 4 },
    section: { fontSize: 18, lineHeight: 24, fontFamily: FONTS.bold, color: t.fg, paddingHorizontal: 4, marginTop: 4 },
    toast: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', backgroundColor: t.raised, borderWidth: 1, borderColor: t.goldLine, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, backgroundColor: t.surface, paddingHorizontal: 16, ...cardShadow(t) },
    searchInput: { flex: 1, minWidth: 0, fontSize: 15, color: t.fg, height: '100%' },
    searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.muted, alignItems: 'center', justifyContent: 'center' },
  });
}
