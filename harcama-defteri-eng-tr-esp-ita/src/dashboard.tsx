import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { CURRENCIES, Cur, Rates, currencyName, fmtShown, money, money0, money0A11y, moneyA11y, symbolOf } from './currency';
import { fmtPercent, fmtPercentPoss, t as tr } from './i18n';
import { Analysis, Balance, BudgetProgress, Expense, Sub, Txn, catIndex, catName, categorySlices, dayLabelShort, greetingKey, incomeCatName, iso, pad, shortDay, subStatus } from './lib';
import { mix, rgba } from './palette';
import { FONTS, Theme } from './theme';
import { RADIUS, SPACE, bigAmount, cardBase, cardShadow, cardTitle, trackOf } from './design';
import { Amount, Button, CatIcon, IconBox, IconName, IncomeIcon, Ionicons, Progress, RingsChart, SoftPill, SubTypeIcon, TxnRow, fitFont, fitWidth, incomeIcon } from './ui';

export { IncomeIcon, incomeIcon };

/** Geniş ekranlarda (tablet, web) içerik bu genişlikte ortalanır. */
export const DASH_MAX = 920;
/** Bu genişliğin altında ikili kartlar alt alta dizilir (çok dar telefonlar). */
const STACK_BELOW = 340;

/** Yüzen sekme çubuğu: yükseklik ve güvenli alanın üstündeki boşluk. */
export const TAB_BAR_H = 64;
const TAB_GAP = 10;
/** Sekme çubuğunun ekranın altından kapladığı toplam alan (içerik bu kadar ve biraz daha boşlukla biter). */
export const tabBarSpace = (bottomInset: number) => bottomInset + TAB_GAP + TAB_BAR_H;

const hit = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export function Card({ t, children, style, onPress, testID, a11y }: { t: Theme; children: ReactNode; style?: object; onPress?: () => void; testID?: string; a11y?: string }) {
  const body = [cardBase(t), style];
  if (!onPress) return <View style={body} testID={testID}>{children}</View>;
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [body, { opacity: pressed ? 0.9 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** Kart başlığı (16/700) + isteğe bağlı alt yazı ve sağda bağlantı ("Tümü"). */
export function CardHead({ t, title, sub, action, onAction, actionTestID }: { t: Theme; title: string; sub?: string; action?: string; onAction?: () => void; actionTestID?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={[s.head, { alignItems: 'flex-start' }]}>
        <Text style={[cardTitle(t), { flexShrink: 1 }]} numberOfLines={2} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={hit} accessibilityRole="button" testID={actionTestID}>
            <Text style={{ color: t.accent, fontSize: 13, lineHeight: 21, fontWeight: '700' }} numberOfLines={1}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {sub ? <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

/* ---------- Üst başlık: avatar (menü), selamlama + ad, para birimi, Ayarlar ---------- */
export function DashHeader({ t, name, initials, currency, onCurrency, onMenu, onSettings, alertDot }: {
  t: Theme; name: string; initials: string; currency: Cur; onCurrency: () => void; onMenu: () => void; onSettings: () => void; alertDot: boolean;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const greeting = tr('dash.greeting.' + greetingKey(new Date().getHours()));
  // Başlıkta yalnızca ilk ad (dar ekranda kesilmesin); ad yoksa marka adı
  const first = name.trim().split(/\s+/)[0] || '';
  const av = narrow ? 40 : 44;
  return (
    <View style={s.headerRow}>
      <Pressable onPress={onMenu} testID="menu-open" accessibilityRole="button" accessibilityLabel={tr('menu.open')} hitSlop={hit}
        style={({ pressed }) => [s.avatar, { width: av, height: av, borderRadius: av / 2, backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={{ color: t.accentFg, fontSize: narrow ? 15 : 16, fontFamily: FONTS.display }}>{initials}</Text>
        {alertDot ? <View style={[s.dot, { backgroundColor: t.warn, borderColor: t.bg }]} /> : null}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }} testID="dash-greeting">
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 17 }} numberOfLines={1}>{first ? tr('dash.greetLine', { greeting }) : greeting}</Text>
        <Text style={{ color: t.fg, fontSize: narrow ? 18 : 20, lineHeight: 26, fontFamily: FONTS.display, letterSpacing: -0.3 }} numberOfLines={1} accessibilityRole="header">{first || tr('app.name')}</Text>
      </View>
      <Pressable onPress={onCurrency} testID="cur-pill" accessibilityRole="button" accessibilityLabel={tr('dash.currencyA11y', { cur: currency })} hitSlop={hit}
        style={({ pressed }) => [s.pill, { backgroundColor: t.surface, opacity: pressed ? 0.8 : 1 }, cardShadow(t)]}>
        <View style={[s.symbolDot, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontSize: 13, fontWeight: '800' }}>{symbolOf(currency)}</Text></View>
        <Text style={{ color: t.fg, fontSize: 14, fontFamily: FONTS.bold }}>{currency}</Text>
        {narrow ? null : <Ionicons name="chevron-down" size={13} color={t.muted} />}
      </Pressable>
      <Pressable onPress={onSettings} testID="open-settings" accessibilityRole="button" accessibilityLabel={tr('menu.settings')} hitSlop={hit}
        style={({ pressed }) => [s.round, { backgroundColor: t.surface, opacity: pressed ? 0.8 : 1 }, cardShadow(t)]}>
        <Ionicons name="settings-outline" size={20} color={t.fg} />
      </Pressable>
    </View>
  );
}

/** Ana sayfanın en altında küçük marka imzası (uygulama adı yan menüde de görünür). */
export function HomeBrand({ t }: { t: Theme }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.accentFg, fontSize: 12, fontFamily: FONTS.display }}>{tr('app.monogram')}</Text>
        </View>
        <Text style={{ color: t.fg, fontSize: 15, fontFamily: FONTS.display, letterSpacing: -0.2 }} testID="home-brand">{tr('app.name')}</Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>{tr('dash.tagline')}</Text>
    </View>
  );
}

/* ---------- Para birimi seçici ---------- */
export function CurrencyMenu({ visible, t, current, rates, onPick, onClose }: { visible: boolean; t: Theme; current: Cur; rates: Rates | null; onPick: (c: Cur) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[s.scrim, { backgroundColor: t.scrim }]} onPress={onClose} accessibilityLabel={tr('menu.close')} accessibilityRole="button" testID="cur-scrim">
        <Pressable style={[s.sheet, { backgroundColor: t.surface, borderColor: t.line, paddingBottom: insets.bottom + 16 }]} onPress={() => {}} accessibilityViewIsModal>
          <Text style={{ color: t.fg, fontSize: 20, fontFamily: FONTS.bold }} accessibilityRole="header">{tr('dash.currencyTitle')}</Text>
          {CURRENCIES.map((c) => {
            const off = !rates && c.code !== current;
            const on = c.code === current;
            return (
              <Pressable key={c.code} testID={`cur-opt-${c.code}`} disabled={off} onPress={() => onPick(c.code)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }}
                accessibilityLabel={`${c.code}, ${currencyName(c.code)}`}
                style={[s.curRow, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.bg, opacity: off ? 0.45 : 1 }]}>
                <View style={[s.symbolDot, { backgroundColor: t.surface, width: 34, height: 34, borderRadius: 17 }]}><Text style={{ color: t.accent, fontSize: 16, fontWeight: '800' }}>{c.symbol}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700' }}>{c.code}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{currencyName(c.code)}</Text>
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={t.accent} /> : null}
              </Pressable>
            );
          })}
          {!rates ? <Text style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{tr('dash.currencyNeedRates')}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Bakiye kartı ---------- */
/** Kart üstünde "dikkat" (%80–100) tonu: koyu kartta okunur kehribar. */
const HERO_AMBER = '#e2b45f';
/** Kart üstünde yarı saydam beyaz katmanlar (kart her iki temada da koyudur). */
const glass = (a: number) => `rgba(255,255,255,${a})`;

/**
 * Geometrik motif (Financy): sağ üst köşede 2×2 ızgara — solda düz kenarı sağa bakan yarım daire (ikincil renk), sağ üstte
 * çeyrek daire (vurgu), altında ona yaslanan nötr çeyrek daire. Karta kırpılır; metin alanı motifin altına girmesin diye sağdan boşluk bırakılır.
 */
function HeroMotif({ t, cell }: { t: Theme; cell: number }) {
  const S = cell, W = cell * 2;
  const neutral = mix(t.heroFg, t.heroGrad[1], 0.7);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: W, height: W }}>
      <Svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
        <Path d={`M${S} 0 V${S} A${S / 2} ${S / 2} 0 0 1 ${S} 0 Z`} fill={t.heroAlt} opacity={0.85} />
        <Path d={`M${S} ${S} V0 A${S} ${S} 0 0 1 ${W} ${S} Z`} fill={t.heroFill} opacity={0.9} />
        <Path d={`M${W} ${S} V${W} A${S} ${S} 0 0 1 ${S} ${S} Z`} fill={neutral} opacity={0.6} />
      </Svg>
    </View>
  );
}

export function BalanceCard({ t, bal, hidden, onToggle, onAddIncome, vsLabel, budget }: {
  t: Theme; bal: Balance; hidden: boolean; onToggle: () => void; onAddIncome: () => void; vsLabel: string; budget: number;
}) {
  const { width } = useWindowDimensions();
  const [cw, setCw] = useState(Math.min(width, DASH_MAX) - 2 * SPACE.edge);
  const showNet = bal.hasIncome;
  const big = showNet ? bal.net : bal.spent;
  // Geçen ay gelir yoksa ya da net işaret değiştiyse yüzde anlamsızdır: tutar farkı gösterilir ("+₺44.579")
  const delta = bal.deltaKind === 'pct' ? bal.deltaPct : bal.deltaKind === 'amount' ? bal.deltaAmount : null;
  const deltaText = delta === null ? '' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${bal.deltaKind === 'pct' ? fmtPercent(Math.abs(delta) > 999 ? '999+' : Math.abs(delta)) : money0(Math.abs(delta))}`;
  const PAD = 20;
  const CELL = cw < 300 ? 44 : 54;
  const bigText = money(big);
  const amountW = cw - 2 * PAD - (CELL - PAD + 10);
  const bigSize = fitWidth(bigText, 40, amountW, -1);
  const colW = (cw - 2 * PAD - 2 * 14 - 1 - 2 * 12) / 2; // iç kutu boşlukları ve ayırıcı düşülür
  const ratio = budget > 0 ? bal.spent / budget : 0;
  const pct = fmtPercent(Math.round(ratio * 100));
  const tone = ratio > 1 ? t.heroWarn : ratio >= 0.8 ? HERO_AMBER : t.heroGood;
  const light = t.name === 'ivory';
  return (
    <LinearGradient colors={t.heroGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} testID="balance-card" onLayout={(e) => setCw(e.nativeEvent.layout.width)}
      style={[s.hero, { borderColor: glass(0.07) }, light && { boxShadow: '0px 12px 28px rgba(11,18,32,0.18)' }]}>
      <HeroMotif t={t} cell={CELL} />
      <View style={[s.heroTop, { paddingRight: 2 * CELL - PAD + 8 }]}>
        <Text style={{ color: t.heroMuted, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{tr(showNet ? 'bal.netTitle' : 'bal.spentTitle')}</Text>
        <Pressable onPress={onToggle} testID="bal-eye" hitSlop={hit} accessibilityRole="button" accessibilityLabel={tr(hidden ? 'bal.show' : 'bal.hide')} aria-pressed={hidden}
          style={[s.eye, { backgroundColor: glass(0.1) }]}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={16} color={t.heroFg} />
        </Pressable>
      </View>
      {/* Tutar motifin altına girmesin diye sağdan boşluklu; tek satır (uzun tutarda yazı küçülür) */}
      {hidden
        ? <Amount testID="bal-amount" text={bigText} style={[bigAmount, { color: t.heroFg, fontSize: 30, lineHeight: 50, letterSpacing: 5, paddingRight: CELL - PAD + 10, marginTop: -4 }]} symbolColor={t.heroLabel} />
        : <Amount fit text={bigText} style={[bigAmount, { color: t.heroFg, fontSize: bigSize, lineHeight: Math.round(bigSize * 1.25), paddingRight: CELL - PAD + 10, marginTop: -4 }]} symbolColor={t.heroLabel} />}
      {!hidden && showNet && delta !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: -6 }}>
          <View style={[s.delta, { backgroundColor: rgba(delta >= 0 ? t.heroGood : t.heroWarn, 0.16) }]}>
            <Ionicons name={delta >= 0 ? 'trending-up' : 'trending-down'} size={13} color={delta >= 0 ? t.heroGood : t.heroWarn} />
            <Text style={{ color: delta >= 0 ? t.heroGood : t.heroWarn, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }} testID="bal-delta">{deltaText}</Text>
          </View>
          <Text style={{ color: t.heroMuted, fontSize: 12 }}>{vsLabel}</Text>
        </View>
      ) : null}
      {!showNet ? <Text style={{ color: t.heroMuted, fontSize: 12, lineHeight: 17, marginTop: -6 }}>{tr('bal.noIncomeHint')}</Text> : null}
      <View style={[s.split, { backgroundColor: glass(0.06), borderColor: glass(0.08) }]}>
        <FlowStat t={t} dir="in" label={tr('bal.income')} testID="bal-income" width={colW}
          value={bal.hasIncome ? money(bal.income) : null} cta={tr('bal.addShort')} onCta={onAddIncome} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: glass(0.12) }} />
        <FlowStat t={t} dir="out" label={tr('bal.expenses')} testID="bal-expenses" width={colW} value={money(bal.spent)} />
      </View>
      {budget > 0 ? (
        <View style={{ gap: 8 }} testID="bal-budget">
          <View style={{ height: 6, borderRadius: 3, backgroundColor: glass(0.1), overflow: 'hidden' }}
            accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(ratio * 100)) }}>
            <View style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: ratio >= 0.8 ? tone : t.heroFill }} />
          </View>
          <Text style={{ color: t.heroMuted, fontSize: 12.5, lineHeight: 17 }}>
            {ratio > 1 ? (
              <Text style={{ color: tone, fontWeight: '700' }}>{tr('bal.budgetOverLine', { pct })}</Text>
            ) : (
              <>
                {tr('bal.budgetUsed', { pct: fmtPercentPoss(Math.round(ratio * 100)) })}
                <Text> · </Text>
                <Text style={{ color: tone, fontWeight: '700' }}>{tr(ratio >= 0.8 ? 'bal.budgetCareful' : 'bal.budgetGood')}</Text>
              </>
            )}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

/** Gelir | Gider sütunu: renkli ok çipi (gelir sola-aşağı, gider sağa-yukarı), etiket ve tutar ya da "Ekle" çağrısı. */
function FlowStat({ t, dir, label, value, cta, onCta, testID, width }: { t: Theme; dir: 'in' | 'out'; label: string; value: string | null; cta?: string; onCta?: () => void; testID?: string; width: number }) {
  const color = dir === 'in' ? t.heroGood : t.heroWarn;
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={[s.flowChip, { backgroundColor: rgba(color, 0.18) }]}>
          <Ionicons name={dir === 'in' ? 'arrow-down' : 'arrow-up'} size={13} color={color} style={{ transform: [{ rotate: '45deg' }] }} />
        </View>
        <Text style={{ color: t.heroMuted, fontSize: 12, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      {value !== null
        ? <Amount fit text={value} style={{ color: t.heroFg, fontSize: fitWidth(value, 17, width), fontFamily: FONTS.bold, letterSpacing: -0.3 }} symbolColor={t.heroLabel} />
        : (
          <Pressable onPress={onCta} hitSlop={hit} accessibilityRole="button" testID="bal-add-income" style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: t.heroLabel, fontSize: 15, fontFamily: FONTS.bold }} numberOfLines={1}>+ {cta}</Text>
          </Pressable>
        )}
    </View>
  );
}

/* ---------- Hızlı eylemler ---------- */
export function QuickActions({ t, onExpense, onIncome, onReports, onBudgets }: { t: Theme; onExpense: () => void; onIncome: () => void; onReports: () => void; onBudgets: () => void }) {
  const items: { id: string; label: string; icon: IconName; color: string; rotate?: boolean; on: () => void }[] = [
    { id: 'expense', label: tr('qa.expense'), icon: 'arrow-up', rotate: true, color: t.warn, on: onExpense },
    { id: 'income', label: tr('qa.income'), icon: 'arrow-down', rotate: true, color: t.good, on: onIncome },
    { id: 'reports', label: tr('qa.reports'), icon: 'bar-chart', color: t.cats[5], on: onReports },
    { id: 'budgets', label: tr('qa.budgets'), icon: 'wallet', color: t.cats[2], on: onBudgets },
  ];
  return (
    <View style={s.qaRow}>
      {items.map((x) => (
        <Pressable key={x.id} onPress={x.on} testID={`qa-${x.id}`} accessibilityRole="button" accessibilityLabel={x.label}
          style={({ pressed }) => [s.qa, { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <View style={[s.qaBox, { backgroundColor: rgba(x.color, t.name === 'ivory' ? 0.14 : 0.16) }]}>
            <Ionicons name={x.icon} size={24} color={x.color} style={x.rotate ? { transform: [{ rotate: '45deg' }] } : undefined} />
          </View>
          <Text style={{ color: t.fg, fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{x.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- Harcama özeti: günlük çubuklar ---------- */
export function SpendingCard({ t, a, ym, todayAmount, monthTitle }: { t: Theme; a: Analysis; ym: string; todayAmount: number | null; monthTitle: string }) {
  const days = Array.from({ length: a.dim }, (_, i) => `${ym}-${pad(i + 1)}`);
  const values = days.map((d) => a.perDay[d] || 0);
  const max = Math.max(...values, 0);
  const [sel, setSel] = useState<number | null>(null);
  const pick = sel !== null && sel < days.length ? sel : null;
  const todayIdx = a.isCur ? a.elapsed - 1 : -1;
  const [H, setH] = useState(128);
  const labels = [1, 7, 14, 21, 28].filter((d) => d <= a.dim);
  return (
    <Card t={t} style={s.half} testID="card-spending">
      <CardHead t={t} title={tr('card.spending')} sub={monthTitle} />
      {max === 0 ? (
        <View style={s.cardEmpty}>
          <Ionicons name="bar-chart-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }} testID="spending-empty">{tr('dash.emptySpending')}</Text>
        </View>
      ) : (
        <View accessible={false} style={{ flex: 1 }}>
          <View style={{ height: 24, justifyContent: 'flex-end' }}>
            {pick !== null ? (
              <View style={[s.tip, { backgroundColor: t.fg, alignSelf: pick > a.dim / 2 ? 'flex-end' : 'flex-start' }]} testID="spending-tip">
                <Text style={{ color: t.bg, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{shortDay(days[pick])} · {money0(values[pick])}</Text>
              </View>
            ) : todayAmount !== null ? (
              <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{tr('bal.today', { amount: money0(todayAmount) })}</Text>
            ) : null}
          </View>
          <View style={{ flex: 1, minHeight: 128, flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }} onLayout={(e) => setH(Math.max(128, e.nativeEvent.layout.height))} accessibilityLabel={tr('dash.chartA11y')} role="img">
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'space-between' }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />)}
            </View>
            {values.map((v, i) => {
              const future = a.isCur && i > todayIdx;
              const h = v > 0 ? Math.max(6, (v / max) * (H - 6)) : 3;
              const active = pick === i;
              return (
                <Pressable key={i} testID={`bar-${i + 1}`} onPress={() => setSel(active ? null : i)} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button"
                  accessibilityLabel={`${shortDay(days[i])}: ${money0A11y(v)}`} style={s.barCell}>
                  <View style={{ width: '62%', height: h, borderRadius: 4, backgroundColor: active ? t.accent : v === max && v > 0 ? rgba(t.accent, 0.9) : v > 0 ? rgba(t.accent, 0.4) : future ? 'transparent' : rgba(t.muted, 0.22) }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {labels.map((d) => <Text key={d} style={{ color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] }}>{d}</Text>)}
          </View>
        </View>
      )}
    </Card>
  );
}

/* ---------- Kategori dağılımı: eşmerkezli yaylar ---------- */
export function CategoriesCard({ t, monthItems, monthTitle }: { t: Theme; monthItems: Expense[]; monthTitle: string }) {
  const { total, rows } = categorySlices(monthItems, 99);
  // En çok 4 halka; geri kalan kategoriler açıklamada "Diğerleri" satırında toplanır
  const top = rows.slice(0, 4);
  const rest = rows.slice(4);
  const otherPct = rest.reduce((m, r) => m + r.pct, 0);
  const [w, setW] = useState(0);
  const size = Math.round(Math.min(w || 130, 156));
  const stroke = size >= 140 ? 9 : 7.5;
  const gap = size >= 140 ? 4 : 3;
  const hole = 2 * (size / 2 - stroke - (top.length - 1) * (stroke + gap));
  const legend = [
    ...top.map((r) => ({ key: r.cat, label: catName(r.cat), pct: r.pct, color: t.cats[catIndex(r.cat)] })),
    ...(rest.length ? [{ key: '_o', label: tr('dash.others'), pct: otherPct, color: t.muted }] : []),
  ];
  const totalText = money0(total);
  return (
    <Card t={t} style={s.half} testID="card-categories">
      <CardHead t={t} title={tr('card.categories')} sub={monthTitle} />
      {total === 0 ? (
        <View style={s.cardEmpty}>
          <Ionicons name="pie-chart-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }} testID="categories-empty">{tr('dash.emptySpending')}</Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ alignItems: 'center' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            <RingsChart rings={top.map((r) => ({ key: r.cat, share: r.pct, color: t.cats[catIndex(r.cat)] }))} size={size} stroke={stroke} gap={gap} track={trackOf(t)} a11y={tr('dash.donutA11y')}>
              <Text style={{ color: t.muted, fontSize: 10, lineHeight: 13 }} numberOfLines={1}>{tr('dash.totalSpent')}</Text>
              <Amount fit text={totalText} style={{ color: t.fg, fontSize: fitWidth(totalText, 15, hole - 8), fontFamily: FONTS.display, letterSpacing: -0.3 }} symbolColor={t.accent} />
            </RingsChart>
          </View>
          <View style={{ gap: 7 }}>
            {legend.map((sl) => (
              <View key={sl.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sl.color }} />
                <Text style={{ flex: 1, color: t.fg, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{sl.label}</Text>
                <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{fmtPercent(Math.round(sl.pct * 100))}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

/** Bütçe/limit kullanım rengi: %80'e kadar vurgu, %80–100 ikincil uyarı, %100'ün üstü aşım. */
const budgetColor = (ratio: number, t: Theme) => (ratio > 1 ? t.warn : ratio >= 0.8 ? t.cats[1] : t.accent);

/* ---------- Aylık bütçe: ilerleme halkası ---------- */
export function BudgetCard({ t, spent, budget, onBudget, periodLabel }: { t: Theme; spent: number; budget: number; onBudget: () => void; periodLabel: string }) {
  const SIZE = 100;
  const SW = 12;
  const R = 50 - SW / 2 - 1;
  const C = 2 * Math.PI * R;
  const pct = budget > 0 ? spent / budget : 0;
  const left = budget - spent;
  const color = budgetColor(pct, t);
  // Yuvarlak uçlar yayı yarım kalınlık uzatır; dolu olmayan halkada oran dürüst kalsın diye düşülür
  const arc = pct >= 1 ? C : Math.max(0.01, pct * C - SW);
  return (
    <Card t={t} style={s.half} testID="card-budget" onPress={onBudget} a11y={tr('card.budget')}>
      <CardHead t={t} title={tr('card.budget')} sub={periodLabel} />
      {budget > 0 ? (
        <View style={{ gap: 10, alignItems: 'center' }}>
          <View style={{ width: SIZE, height: SIZE }} accessibilityLabel={tr('dash.budgetA11y', { pct: fmtPercent(Math.round(pct * 100)) })} role="img">
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              <G rotation="-90" origin="50, 50">
                <Circle cx="50" cy="50" r={R} stroke={trackOf(t)} strokeWidth={SW} fill="none" />
                {pct > 0 ? <Circle cx="50" cy="50" r={R} stroke={color} strokeWidth={SW} fill="none" strokeLinecap={pct >= 1 ? 'butt' : 'round'} strokeDasharray={`${arc} ${C}`} /> : null}
              </G>
            </Svg>
            <View pointerEvents="none" style={s.donutCenter}>
              <Text style={{ color: t.fg, fontSize: 18, fontFamily: FONTS.display, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }} testID="budget-pct">{fmtPercent(Math.round(pct * 100))}</Text>
              <Text style={{ color: t.muted, fontSize: 10 }} numberOfLines={1}>{tr('dash.budgetUsed')}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: 1 }}>
            <Amount fit text={money0(spent)} style={{ color: t.fg, fontSize: fitFont(money0(spent), 18, 8), fontFamily: FONTS.display, letterSpacing: -0.4 }} symbolColor={t.accent} />
            <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{tr('dash.budgetOf', { total: money0(budget) })}</Text>
          </View>
          <View style={[s.leftRow, { backgroundColor: left >= 0 ? t.goodSoft : t.warnSoft }]}>
            <Ionicons name={left >= 0 ? 'wallet-outline' : 'alert-circle-outline'} size={16} color={left >= 0 ? t.good : t.warn} />
            <View style={{ flex: 1 }}>
              <Amount fit text={money0(Math.abs(left))} style={{ color: t.fg, fontSize: fitFont(money0(Math.abs(left)), 13, 8), fontWeight: '700' }} symbolColor={t.accent} />
              <Text style={{ color: t.muted, fontSize: 11 }} numberOfLines={1}>{tr(left >= 0 ? 'dash.budgetLeft' : 'dash.budgetOver')}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.cardEmpty}>
          <Ionicons name="wallet-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>{tr('dash.budgetEmpty')}</Text>
          <Button label={tr('dash.budgetSet')} kind="ghost" onPress={onBudget} t={t} style={s.smallBtn} />
        </View>
      )}
    </Card>
  );
}

/* ---------- Bütçe ekranı: bu ayın ilerlemesi ve kategori limitleri ---------- */
/** Kart içi küçük gösterge kutusu: simge + etiket, iri tutar, isteğe bağlı alt yazı. */
function MiniStat({ t, icon, color, label, value, caption, a11y }: { t: Theme; icon: IconName; color: string; label: string; value: string; caption?: string; a11y?: string }) {
  const [w, setW] = useState(0);
  return (
    <View style={[s.mini, { backgroundColor: t.bg }]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible={!!a11y} accessibilityLabel={a11y}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBox icon={icon} color={color} t={t} size={28} />
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
      </View>
      <Amount fit text={value} style={{ color: t.fg, fontSize: fitWidth(value, 19, w - 24), fontFamily: FONTS.display, letterSpacing: -0.4 }} symbolColor={t.accent} />
      {caption ? <Text style={{ color: t.muted, fontSize: 12, lineHeight: 16 }}>{caption}</Text> : null}
    </View>
  );
}

/**
 * Kategori limiti kutucuğu (DESIGN-2 §7, Financy "Savings"): simge kutusu ve oran, ad, "₺2.500 / ₺3.000", kategorinin renginde
 * kalın yuvarlak çubuk. %80'den itibaren çubuk uyarı tonuna döner, limit aşılınca aşım renginde ve küçük "aşıldı" hapıyla.
 */
function LimitTile({ t, r }: { t: Theme; r: BudgetProgress['limits'][number] }) {
  const over = r.ratio > 1;
  const near = !over && r.ratio >= 0.8;
  const pct = fmtPercent(Math.round(r.ratio * 100));
  const bar = over ? t.warn : near ? t.cats[1] : t.cats[catIndex(r.cat)];
  return (
    <View style={[cardBase(t), s.tile]} testID={`limit-${r.cat}`} accessible
      accessibilityLabel={tr('budget.ov.rowA11y', { cat: catName(r.cat), spent: money0A11y(r.spent), limit: money0A11y(r.limit), pct })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <CatIcon cat={r.cat} t={t} size={40} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          {near ? <Ionicons name="alert-circle" size={14} color={t.cats[1]} /> : null}
          <Text style={{ color: over ? t.warn : t.fg, fontSize: 15, lineHeight: 20, fontFamily: FONTS.display, fontVariant: ['tabular-nums'] }}>{pct}</Text>
        </View>
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ color: t.fg, fontSize: 14, lineHeight: 19, fontFamily: FONTS.bold }}>{catName(r.cat)}</Text>
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 17, fontVariant: ['tabular-nums'] }}>
          <Text style={{ color: t.fg, fontWeight: '700' }}>{money0(r.spent)}</Text>{` / ${money0(r.limit)}`}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Progress value={r.spent} max={r.limit} color={bar} height={8} t={t} />
        {over ? <SoftPill tone="warn" icon="alert-circle-outline" label={tr('dash.budgetOver')} t={t} /> : null}
      </View>
    </View>
  );
}

export function BudgetOverview({ t, p, periodLabel }: { t: Theme; p: BudgetProgress; periodLabel: string }) {
  const over = p.budget > 0 && p.remaining < 0;
  const [cw, setCw] = useState(0);
  const spentText = money0(p.spent);
  // Kutucuklar ikişer ikişer dizilir; tek kalan kutucuğun yanı boş kalır (son kutucuk tüm satırı kaplamasın)
  const pairs: BudgetProgress['limits'][] = [];
  p.limits.forEach((r, i) => (i % 2 ? pairs[pairs.length - 1].push(r) : pairs.push([r])));
  return (
    <View style={{ gap: SPACE.gap }}>
      <Card t={t} testID="budget-overview">
        <View style={[s.head, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, minWidth: 0 }}><CardHead t={t} title={tr('card.budget')} sub={periodLabel} /></View>
          {p.budget > 0 ? <SoftPill tone={over ? 'warn' : p.ratio >= 0.8 ? 'neutral' : 'accent'} label={fmtPercent(Math.round(p.ratio * 100))} t={t} testID="budget-ov-pct" /> : null}
        </View>
        {p.budget > 0 ? (
          <View style={{ gap: 14, marginTop: 12 }} onLayout={(e) => setCw(e.nativeEvent.layout.width)}>
            <View style={{ gap: 2 }}>
              <Amount fit text={spentText} style={[bigAmount, { color: t.fg, fontSize: fitWidth(spentText, 34, cw, -1), lineHeight: 42 }]} symbolColor={t.accent} />
              <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{tr('dash.budgetOf', { total: money0(p.budget) })}</Text>
            </View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(p.ratio * 100)) }}>
              <Progress value={p.spent} max={p.budget} color={budgetColor(p.ratio, t)} height={10} t={t} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MiniStat t={t} icon={over ? 'alert-circle-outline' : 'wallet-outline'} color={over ? t.warn : t.good} label={tr(over ? 'budget.ov.overLabel' : 'budget.ov.leftLabel')} value={money0(Math.abs(p.remaining))}
                caption={over ? tr('budget.ov.overCaption', { pct: fmtPercent(Math.round(p.ratio * 100) - 100) }) : tr('budget.ov.leftCaption', { pct: fmtPercentPoss(100 - Math.round(p.ratio * 100)) })} />
              <MiniStat t={t} icon="calendar-outline" color={t.accent} label={tr('budget.ov.perDayShort')} value={p.perDay !== null ? money0(p.perDay) : '—'}
                caption={tr('budget.ov.daysLeft', { n: p.daysLeft })} a11y={p.perDay !== null ? `${tr('budget.ov.perDay', { amount: money0A11y(p.perDay) })}, ${tr('budget.ov.daysLeft', { n: p.daysLeft })}` : undefined} />
            </View>
          </View>
        ) : (
          <View style={s.cardEmpty}>
            <IconBox icon="wallet-outline" color={t.accent} t={t} size={48} />
            <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 300 }}>{tr('budget.ov.empty')}</Text>
          </View>
        )}
      </Card>

      <View testID="budget-limits" style={{ gap: 12 }}>
        <View style={{ paddingHorizontal: 4, gap: 2 }}>
          <Text style={[cardTitle(t), { fontSize: 17, lineHeight: 22 }]} accessibilityRole="header">{tr('budget.limitsTitle')}</Text>
          <Text style={{ color: t.muted, fontSize: 12, lineHeight: 16 }}>{periodLabel}</Text>
        </View>
        {pairs.length ? (
          pairs.map((row) => (
            <View key={row[0].cat} style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
              {row.map((r) => <LimitTile key={r.cat} t={t} r={r} />)}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))
        ) : (
          <Card t={t}>
            <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>{tr('budget.ov.noLimits')}</Text>
          </Card>
        )}
      </View>
    </View>
  );
}

/* ---------- Abonelikler ekranı: özet kartı ---------- */
/**
 * Abonelik özeti, bakiye kartıyla aynı koyu kart dilinde: aylık toplam iri tutar, onay bekleyen sayısı çipi,
 * altta yıllık toplam | bütçe payı (bütçe yoksa yalnızca yıllık).
 */
export function SubsHero({ t, monthly, yearly, share, pending }: { t: Theme; monthly: string; yearly: string; share: string | null; pending: number }) {
  const { width } = useWindowDimensions();
  const [cw, setCw] = useState(Math.min(width, DASH_MAX) - 2 * SPACE.edge);
  const PAD = 20;
  const CELL = cw < 300 ? 40 : 48;
  const size = fitWidth(monthly, 36, cw - 2 * PAD - (CELL - PAD + 10), -1);
  const light = t.name === 'ivory';
  const colW = share !== null ? (cw - 2 * PAD - 2 * 14 - 1 - 2 * 12) / 2 : cw - 2 * PAD - 2 * 14;
  return (
    <LinearGradient colors={t.heroGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} testID="subs-hero" onLayout={(e) => setCw(e.nativeEvent.layout.width)}
      style={[s.hero, { borderColor: glass(0.07) }, light && { boxShadow: '0px 12px 28px rgba(11,18,32,0.18)' }]}>
      <HeroMotif t={t} cell={CELL} />
      <Text style={{ color: t.heroMuted, fontSize: 13, lineHeight: 18, fontWeight: '600', paddingRight: 2 * CELL - PAD + 8 }}>{tr('subs.heroTitle')}</Text>
      <View style={{ gap: 10, marginTop: -6 }}>
        <Amount fit text={monthly} style={[bigAmount, { color: t.heroFg, fontSize: size, lineHeight: Math.round(size * 1.25), paddingRight: CELL - PAD + 10 }]} symbolColor={t.heroLabel} />
        {pending ? (
          <View style={[s.delta, { alignSelf: 'flex-start', backgroundColor: rgba(HERO_AMBER, 0.16) }]}>
            <Ionicons name="time-outline" size={13} color={HERO_AMBER} />
            <Text style={{ color: HERO_AMBER, fontSize: 12, fontWeight: '700' }}>{tr('subs.pendingCount', { n: pending })}</Text>
          </View>
        ) : null}
      </View>
      <View style={[s.split, { backgroundColor: glass(0.06), borderColor: glass(0.08) }]}>
        <HeroStat t={t} icon="calendar-outline" label={tr('subs.perYear')} value={yearly} width={colW} />
        {share !== null ? (
          <>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: glass(0.12) }} />
            <HeroStat t={t} icon="pie-chart-outline" label={tr('subs.budgetShare')} value={share} width={colW} />
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

function HeroStat({ t, icon, label, value, width }: { t: Theme; icon: IconName; label: string; value: string; width: number }) {
  // Etiket iki satıra kırılırsa tutarlar yine aynı hizada (alta yaslı) kalır
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6, alignSelf: 'stretch', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={[s.flowChip, { backgroundColor: glass(0.1) }]}><Ionicons name={icon} size={13} color={t.heroLabel} /></View>
        <Text style={{ color: t.heroMuted, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
      </View>
      <Amount fit text={value} style={{ color: t.heroFg, fontSize: fitWidth(value, 17, width), fontFamily: FONTS.bold, letterSpacing: -0.3 }} symbolColor={t.heroLabel} />
    </View>
  );
}

/* ---------- Abonelikler (kısa liste) ---------- */
export function SubsCard({ t, subs, items, onAll, onAdd, onOpen }: { t: Theme; subs: Sub[]; items: Expense[]; onAll: () => void; onAdd: () => void; onOpen: (s: Sub) => void }) {
  const rows = subs
    .map((sub) => ({ sub, x: subStatus(sub, items) }))
    .sort((p, q) => (p.x.state === 'pending' ? 0 : 1) - (q.x.state === 'pending' ? 0 : 1) || ('next' in p.x ? p.x.next : p.x.due).getTime() - ('next' in q.x ? q.x.next : q.x.due).getTime())
    .slice(0, 3);
  return (
    <Card t={t} style={s.half} testID="card-subs">
      <CardHead t={t} title={tr('card.subs')} action={subs.length ? tr('common.all') : undefined} onAction={onAll} actionTestID="subs-all" />
      {rows.length ? (
        <View style={{ gap: 12 }}>
          {rows.map(({ sub, x }) => {
            const when = 'next' in x ? x.next : x.due;
            return (
              <Pressable key={sub.id} onPress={() => onOpen(sub)} accessibilityRole="button" accessibilityLabel={`${tr('sub.rowA11y', { name: sub.name })}${x.state === 'pending' ? ', ' + tr('sub.pendingOn', { date: shortDay(iso(x.due)) }) : ''}`} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10 }, pressed && { opacity: 0.75 }]}>
                <SubTypeIcon type={sub.type} t={t} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{sub.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    {x.state === 'pending' ? <Ionicons name="alert-circle" size={12} color={t.warn} /> : null}
                    <Text style={{ color: x.state === 'pending' ? t.warn : t.muted, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>{shortDay(iso(x.state === 'pending' ? x.due : when))}</Text>
                  </View>
                  <Text style={{ color: t.fg, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                    {money0(sub.amount)}<Text style={{ color: t.muted, fontWeight: '400' }}> · {tr(sub.freq === 'yearly' ? 'dash.yearly' : 'dash.monthly')}</Text>
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={s.cardEmpty}>
          <Ionicons name="repeat-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>{tr('dash.subsEmpty')}</Text>
          <Button label={tr('dash.subsAdd')} kind="ghost" onPress={onAdd} t={t} style={s.smallBtn} />
        </View>
      )}
    </Card>
  );
}

/* ---------- Son işlemler ---------- */
export function RecentCard({ t, list, onAll, onOpen }: { t: Theme; list: Txn[]; onAll: () => void; onOpen: (x: Txn) => void }) {
  return (
    <Card t={t} testID="card-recent" style={{ paddingBottom: 8 }}>
      <CardHead t={t} title={tr('section.recent')} action={list.length ? tr('common.all') : undefined} onAction={onAll} actionTestID="recent-all" />
      {list.length ? (
        <View style={{ marginTop: 6 }}>
          {list.map((r, i) => {
            const income = r.kind === 'income';
            const catLabel = income ? incomeCatName(r.x.cat) : catName(r.x.cat);
            return (
              <TxnRow key={r.kind + r.x.id} t={t} kind={r.kind} cat={r.x.cat} first={i === 0} testID={`recent-${i}`}
                title={r.x.note || catLabel}
                subtitle={r.x.note ? `${dayLabelShort(r.x.date)} · ${catLabel}` : dayLabelShort(r.x.date)}
                amount={money(r.x.amount)}
                // Başka para biriminde girilmiş kayıtta özgün tutar da gösterilir (çevrilmiş tutarın altında)
                orig={r.x.orig ? fmtShown(r.x.orig.amount, r.x.orig.cur) : undefined}
                onPress={() => onOpen(r)}
                a11y={income ? tr('income.rowA11y', { cat: incomeCatName(r.x.cat), amount: moneyA11y(r.x.amount) }) : tr('expense.rowA11y', { cat: catName(r.x.cat), amount: moneyA11y(r.x.amount) })} />
            );
          })}
        </View>
      ) : (
        <View style={[s.cardEmpty, { paddingBottom: 18 }]}>
          <Ionicons name="receipt-outline" size={28} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 }} testID="recent-empty">{tr('dash.recentEmpty')}</Text>
        </View>
      )}
    </Card>
  );
}

/* ---------- İki sütunlu satır (çok dar ekranda alt alta) ---------- */
export function Pair({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const stacked = width < STACK_BELOW;
  return <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12, alignItems: 'stretch' }}>{children}</View>;
}

/* ---------- Alt sekme çubuğu: yüzen hap, ortada "+" ---------- */
export type TabKey = 'ozet' | 'harcamalar' | 'butce' | 'raporlar';
const TABS: { key: TabKey; icon: IconName; on: IconName; label: string }[] = [
  { key: 'ozet', icon: 'home-outline', on: 'home', label: 'tab.home' },
  { key: 'harcamalar', icon: 'list-outline', on: 'list', label: 'tab.transactions' },
  { key: 'butce', icon: 'pie-chart-outline', on: 'pie-chart', label: 'tab.budget' },
  { key: 'raporlar', icon: 'bar-chart-outline', on: 'bar-chart', label: 'tab.reports' },
];
const FAB = 56;
const FAB_SLOT = 72;

/**
 * Yüzen sekme çubuğu (Splitty): kenarlardan 16, güvenli alanın 10 üstünde, 64 yüksekliğinde hap; ortada çubuğun üstüne taşan
 * vurgu renginde "+". "+" küçük bir seçim balonu açar (Harcama / Gelir); dışarı dokununca kapanır.
 */
export function TabBar({ t, current, onSelect, bottomInset, onAddExpense, onAddIncome }: {
  t: Theme; current: string; onSelect: (k: TabKey) => void; bottomInset: number; onAddExpense: () => void; onAddIncome: () => void;
}) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: open ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
  }, [open, anim]);
  useEffect(() => setOpen(false), [current]);
  const side = width < 360 ? 12 : 16;
  const barW = Math.min(width - 2 * side, 560);
  const fabSlot = width < 360 ? 64 : FAB_SLOT;
  const slotW = (barW - 8 - fabSlot) / 4;
  // Yazı genişliği tahmini (~0,57 em/harf; web'de adjustsFontSizeToFit yok): tüm sekme adları aynı boyutta, en uzun ad yuvaya sığacak kadar
  const fitIn = (w: number, label: string) => Math.min(11, Math.floor(((w - 6) / (label.length * 0.57)) * 2) / 2);
  const fs = Math.min(...TABS.map((x) => fitIn(slotW, tr(x.label))));
  // Çok dar ekranda (ad 9,5 px'ten küçük kalacaksa) yalnızca seçili sekme adını gösterir ve ona daha geniş yer verir; diğerleri yalnız simge
  const shifting = fs < 9.5;
  const SEL = 1.7;
  const hasSel = TABS.some((x) => x.key === current);
  const selW = hasSel ? (slotW * 4 * SEL) / (3 + SEL) : slotW;
  const light = t.name === 'ivory';
  const choose = (fn: () => void) => { setOpen(false); fn(); };

  const tab = (x: (typeof TABS)[number]) => {
    const on = current === x.key;
    const label = tr(x.label);
    const showLabel = !shifting || on;
    return (
      <Pressable key={x.key} onPress={() => { setOpen(false); onSelect(x.key); }} testID={`tab-${x.key}`} accessibilityRole="tab" aria-selected={on} accessibilityLabel={label}
        style={[s.tab, shifting && on && { flex: SEL }]}>
        <View style={[s.tabPill, on && { backgroundColor: t.accentSoft }]}>
          <Ionicons name={on ? x.on : x.icon} size={21} color={on ? t.accent : t.muted} />
          {showLabel ? <Text style={{ color: on ? t.accent : t.muted, fontSize: shifting ? fitIn(selW, label) : fs, lineHeight: 14, fontWeight: on ? '700' : '600' }} numberOfLines={1}>{label}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      {open ? (
        <Pressable testID="fab-scrim" onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={tr('menu.close')}
          style={[StyleSheet.absoluteFill, { backgroundColor: light ? 'rgba(11,18,32,0.16)' : 'rgba(0,0,0,0.42)' }]} />
      ) : null}
      <View pointerEvents="box-none" style={[s.tabWrap, { bottom: bottomInset + TAB_GAP }]}>
        {open ? (
          <Animated.View accessibilityRole="menu" style={[s.pop, { backgroundColor: t.surface, borderColor: t.line, boxShadow: light ? '0px 14px 34px rgba(11,18,32,0.16)' : '0px 14px 34px rgba(0,0,0,0.5)' },
            { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <PopItem t={t} testID="fab-expense" icon="arrow-up" color={t.warn} label={tr('fab.expense')} onPress={() => choose(onAddExpense)} />
            <PopItem t={t} testID="fab-income" icon="arrow-down" color={t.good} label={tr('fab.income')} onPress={() => choose(onAddIncome)} />
            <View style={[s.popTip, { backgroundColor: t.surface, borderColor: t.line }]} />
          </Animated.View>
        ) : null}
        <View testID="tab-bar" accessibilityRole="tablist"
          style={[s.tabBar, { width: barW, backgroundColor: t.surface, borderColor: t.line, boxShadow: light ? '0px 10px 30px rgba(11,18,32,0.10)' : '0px 10px 30px rgba(0,0,0,0.45)' }]}>
          {TABS.slice(0, 2).map(tab)}
          <View style={[s.fabSlot, { width: fabSlot }]}>
            <Pressable testID="fab-add" onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={open ? tr('menu.close') : tr('fab.a11y')} aria-expanded={open}
              style={({ pressed }) => [s.fab, { backgroundColor: t.accent, borderColor: t.bg, boxShadow: `0px 8px 18px ${rgba(t.accent, 0.38)}`, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
              <Animated.View style={{ transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                <Ionicons name="add" size={30} color={t.accentFg} />
              </Animated.View>
            </Pressable>
          </View>
          {TABS.slice(2).map(tab)}
        </View>
      </View>
    </>
  );
}

function PopItem({ t, testID, icon, color, label, onPress }: { t: Theme; testID: string; icon: IconName; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="menuitem" accessibilityLabel={label}
      style={({ pressed }) => [s.popItem, { backgroundColor: pressed ? t.raised : t.bg }]}>
      <View style={[s.popIcon, { backgroundColor: rgba(color, t.name === 'ivory' ? 0.14 : 0.18) }]}>
        <Ionicons name={icon} size={20} color={color} style={{ transform: [{ rotate: '45deg' }] }} />
      </View>
      <Text style={{ color: t.fg, fontSize: 14, fontFamily: FONTS.bold }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Yükleniyor / hata ---------- */
function Pulse({ children, style }: { children?: ReactNode; style: object }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

export function DashboardSkeleton({ t, topInset }: { t: Theme; topInset: number }) {
  const block = (h: number, extra: object = {}) => ({ height: h, borderRadius: RADIUS.card, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, ...extra });
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset + 12, paddingHorizontal: SPACE.edge, gap: SPACE.gap }} accessible accessibilityLabel={tr('state.loading')} accessibilityRole="progressbar" testID="dash-skeleton">
      <View style={{ width: '100%', maxWidth: DASH_MAX, alignSelf: 'center', gap: SPACE.gap }}>
        <Pulse style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={block(44, { width: 44, borderRadius: 22 })} />
          <View style={block(36, { flex: 1, maxWidth: 160, borderRadius: RADIUS.inner })} />
        </Pulse>
        <Pulse style={block(230)} />
        <Pulse style={{ flexDirection: 'row', gap: 12 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={block(56, { flex: 1, borderRadius: RADIUS.inner })} />)}</Pulse>
        <Pulse style={{ flexDirection: 'row', gap: 12 }}><View style={block(220, { flex: 1 })} /><View style={block(220, { flex: 1 })} /></Pulse>
      </View>
    </View>
  );
}

export function ErrorState({ t, onRetry, topInset }: { t: Theme; onRetry: () => void; topInset: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 28, paddingTop: topInset + 28, gap: 14 }} testID="data-error">
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.warnSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={42} color={t.warn} />
      </View>
      <Text style={{ color: t.fg, fontSize: 24, fontFamily: FONTS.display, textAlign: 'center' }} accessibilityRole="header">{tr('state.errorTitle')}</Text>
      <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 420 }}>{tr('state.errorBody')}</Text>
      <Button label={tr('state.retry')} onPress={onRetry} t={t} style={{ minWidth: 180 }} />
    </View>
  );
}

/** Kısa uyarı bandı (kur alınamadı gibi): metin + isteğe bağlı eylem. */
export function InlineNotice({ t, kind, text, action, onAction }: { t: Theme; kind: 'warn' | 'info'; text: string; action?: string; onAction?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: RADIUS.inner, alignItems: 'center', backgroundColor: kind === 'warn' ? t.warnSoft : t.accentSoft }} testID="inline-notice">
      <Ionicons name={kind === 'warn' ? 'cloud-offline-outline' : 'information-circle-outline'} size={20} color={kind === 'warn' ? t.warn : t.accent} />
      <Text style={{ flex: 1, color: t.fg, fontSize: 13, lineHeight: 18 }}>{text}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={hit} accessibilityRole="button" testID="notice-action"><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  half: { flex: 1, minWidth: 0, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.pill, height: 40, paddingLeft: 5, paddingRight: 11 },
  symbolDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, gap: 10 },
  curRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.inner, padding: 12 },
  hero: { borderRadius: RADIUS.card, padding: 20, gap: 16, borderWidth: 1, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  eye: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: RADIUS.pill },
  split: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.inner, paddingVertical: 12, paddingHorizontal: 14 },
  flowChip: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  qa: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  qaBox: { width: 56, height: 56, borderRadius: RADIUS.inner, alignItems: 'center', justifyContent: 'center' },
  cardEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, flexGrow: 1 },
  smallBtn: { height: 40, borderRadius: 14, paddingHorizontal: 12 },
  tip: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  barCell: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  donutCenter: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  mini: { flex: 1, minWidth: 0, borderRadius: RADIUS.inner, padding: 12, gap: 6 },
  tile: { flex: 1, minWidth: 0, padding: 14, gap: 12, borderRadius: 20 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, alignSelf: 'stretch' },
  tabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tabBar: { flexDirection: 'row', alignItems: 'center', height: TAB_BAR_H, borderRadius: TAB_BAR_H / 2, borderWidth: 1, paddingHorizontal: 4 },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  tabPill: { alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 2, alignSelf: 'stretch', marginHorizontal: 1 },
  fabSlot: { width: FAB_SLOT, height: '100%', alignItems: 'center' },
  fab: { position: 'absolute', top: -(FAB / 2) + 4, width: FAB + 8, height: FAB + 8, borderRadius: (FAB + 8) / 2, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  pop: { position: 'absolute', bottom: TAB_BAR_H + 30, flexDirection: 'row', gap: 8, padding: 8, borderRadius: 22, borderWidth: 1 },
  popItem: { width: 116, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.inner },
  popIcon: { width: 44, height: 44, borderRadius: RADIUS.icon, alignItems: 'center', justifyContent: 'center' },
  popTip: { position: 'absolute', bottom: -7, left: '50%', marginLeft: -7, width: 14, height: 14, borderRightWidth: 1, borderBottomWidth: 1, transform: [{ rotate: '45deg' }] },
});
