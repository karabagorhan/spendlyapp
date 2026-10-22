import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import { CURRENCIES, Cur, Rates, currencyName, fmtMoney, money, money0, symbolOf } from './currency';
import { fmtPercent, t as tr } from './i18n';
import { Analysis, Balance, Expense, Sub, Txn, catIndex, catName, categorySlices, dayLabelShort, greetingKey, incomeCatName, iso, pad, shortDay, subStatus } from './lib';
import { rgba } from './palette';
import { FONTS, Theme } from './theme';
import { Amount, Button, CatIcon, IconName, Ionicons, SubTypeIcon, fitFont } from './ui';

/** Geniş ekranlarda (tablet, web) içerik bu genişlikte ortalanır. */
export const DASH_MAX = 920;
/** Bu genişliğin altında ikili kartlar alt alta dizilir (çok dar telefonlar). */
const STACK_BELOW = 340;

export const TAB_BAR_H = 64;

const hit = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const card = (t: Theme) => ({
  backgroundColor: t.surface,
  borderColor: t.line,
  borderWidth: 1,
  borderRadius: 24,
  padding: 14,
  boxShadow: t.name === 'ivory' ? '0 8px 22px rgba(40,34,20,0.07)' : '0 8px 22px rgba(0,0,0,0.35)',
});

export function Card({ t, children, style, onPress, testID, a11y }: { t: Theme; children: ReactNode; style?: object; onPress?: () => void; testID?: string; a11y?: string }) {
  const body = [card(t), style];
  if (!onPress) return <View style={body} testID={testID}>{children}</View>;
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [body, { opacity: pressed ? 0.9 : 1 }]}>
      {children}
    </Pressable>
  );
}

function CardHead({ t, title, sub, action, onAction, actionTestID }: { t: Theme; title: string; sub?: string; action?: string; onAction?: () => void; actionTestID?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={[s.head, { alignItems: 'flex-start' }]}>
        <Text style={{ color: t.fg, fontSize: 14, lineHeight: 18, fontWeight: '700', flexShrink: 1 }} numberOfLines={2} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={hit} accessibilityRole="button" testID={actionTestID}>
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {sub ? <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

/* ---------- Üst başlık: marka, selamlama, para birimi, profil ---------- */
export function DashHeader({ t, name, initials, currency, onCurrency, onMenu, alertDot }: {
  t: Theme; name: string; initials: string; currency: Cur; onCurrency: () => void; onMenu: () => void; alertDot: boolean;
}) {
  const hour = new Date().getHours();
  const key = greetingKey(hour);
  const greeting = tr('dash.greeting.' + key);
  const line = name.trim() ? tr('dash.greetName', { greeting, name: name.trim() }) : greeting;
  return (
    <View style={s.headerRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.fg, fontSize: 34, lineHeight: 40, fontFamily: FONTS.display, letterSpacing: -0.5 }} numberOfLines={1} accessibilityRole="header">{tr('app.name')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: t.fg, fontSize: 17, fontWeight: '600', flexShrink: 1 }} numberOfLines={1} testID="dash-greeting">{line}</Text>
          <Ionicons name={key === 'morning' || key === 'afternoon' ? 'sunny' : 'moon'} size={16} color={t.accent} />
        </View>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{tr('dash.tagline')}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 10 }}>
        <Pressable onPress={onCurrency} testID="cur-pill" accessibilityRole="button" accessibilityLabel={tr('dash.currencyA11y', { cur: currency })} hitSlop={hit}
          style={({ pressed }) => [s.pill, { backgroundColor: t.surface, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
          <View style={[s.symbolDot, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontSize: 12, fontWeight: '800' }}>{symbolOf(currency)}</Text></View>
          <Text style={{ color: t.fg, fontSize: 14, fontWeight: '700' }}>{currency}</Text>
          <Ionicons name="chevron-down" size={14} color={t.muted} />
        </Pressable>
        <Pressable onPress={onMenu} testID="menu-open" accessibilityRole="button" accessibilityLabel={tr('menu.open')} hitSlop={hit}
          style={[s.avatar, { backgroundColor: t.accent, borderColor: t.goldLine }]}>
          <Text style={{ color: t.accentFg, fontSize: 17, fontFamily: FONTS.display }}>{initials}</Text>
          {alertDot ? <View style={[s.dot, { backgroundColor: t.warn, borderColor: t.bg }]} /> : null}
        </Pressable>
      </View>
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
const HIDDEN = '••••••';

export function BalanceCard({ t, bal, hidden, onToggle, onAddIncome, vsLabel }: { t: Theme; bal: Balance; hidden: boolean; onToggle: () => void; onAddIncome: () => void; vsLabel: string }) {
  const showNet = bal.hasIncome;
  const big = showNet ? bal.net : bal.spent;
  const delta = bal.deltaPct;
  return (
    <LinearGradient colors={t.heroGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { borderColor: rgba(t.heroFill, 0.4) }]} testID="balance-card">
      <View pointerEvents="none" style={[s.orb, { right: -50, top: -60, width: 190, height: 190, backgroundColor: rgba(t.heroFill, 0.1) }]} />
      <View pointerEvents="none" style={[s.orb, { left: -40, bottom: -70, width: 150, height: 150, backgroundColor: rgba(t.heroFill, 0.07) }]} />
      <View style={s.heroCols}>
        <View style={{ flex: 11, gap: 6, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: t.heroMuted, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{tr(showNet ? 'bal.netTitle' : 'bal.spentTitle')}</Text>
            <Pressable onPress={onToggle} testID="bal-eye" hitSlop={hit} accessibilityRole="button" accessibilityLabel={tr(hidden ? 'bal.show' : 'bal.hide')} aria-pressed={hidden}
              style={[s.eye, { backgroundColor: rgba(t.heroFill, 0.16) }]}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={16} color={t.heroLabel} />
            </Pressable>
          </View>
          {hidden
            ? <Text testID="bal-amount" style={{ color: t.heroFg, fontSize: 36, fontFamily: FONTS.display, letterSpacing: 2 }}>{HIDDEN}</Text>
            : <Amount fit text={money(big)} style={{ color: t.heroFg, fontSize: fitFont(money(big), 36, 8), fontFamily: FONTS.display, letterSpacing: -0.5 }} symbolColor={t.heroLabel} />}
          {!hidden && showNet && delta !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={[s.delta, { backgroundColor: delta >= 0 ? rgba(t.good, 0.22) : rgba(t.warn, 0.22) }]}>
                <Ionicons name={delta >= 0 ? 'trending-up' : 'trending-down'} size={13} color={delta >= 0 ? t.good : t.warn} />
                <Text style={{ color: delta >= 0 ? t.good : t.warn, fontSize: 12, fontWeight: '700' }} testID="bal-delta">{`${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmtPercent(Math.abs(delta) > 999 ? '999+' : Math.abs(delta))}`}</Text>
              </View>
              <Text style={{ color: t.heroMuted, fontSize: 12 }}>{vsLabel}</Text>
            </View>
          ) : null}
          {!showNet ? <Text style={{ color: t.heroMuted, fontSize: 12, lineHeight: 17 }}>{tr('bal.noIncomeHint')}</Text> : null}
        </View>
        <View style={{ flex: 9, gap: 8, minWidth: 0 }}>
          <MiniStat t={t} icon="arrow-down" color={t.good} label={tr('bal.income')} testID="bal-income"
            value={bal.hasIncome ? (hidden ? HIDDEN : money(bal.income)) : null} cta={tr('bal.addShort')} onCta={onAddIncome} />
          <MiniStat t={t} icon="arrow-up" color={t.warn} label={tr('bal.expenses')} testID="bal-expenses" value={hidden ? HIDDEN : money(bal.spent)} />
        </View>
      </View>
    </LinearGradient>
  );
}

function MiniStat({ t, icon, color, label, value, cta, onCta, testID }: { t: Theme; icon: IconName; color: string; label: string; value: string | null; cta?: string; onCta?: () => void; testID?: string }) {
  return (
    <View style={[s.mini, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }]} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[s.miniIcon, { backgroundColor: rgba(color, 0.24) }]}><Ionicons name={icon} size={12} color={color} /></View>
        <Text style={{ color: t.heroMuted, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      {value !== null
        ? <Amount fit text={value} style={{ color: t.heroFg, fontSize: fitFont(value, 15, 10), fontWeight: '700' }} symbolColor={t.heroLabel} />
        : (
          <Pressable onPress={onCta} hitSlop={hit} accessibilityRole="button" testID="bal-add-income">
            <Text style={{ color: t.heroLabel, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>+ {cta}</Text>
          </Pressable>
        )}
    </View>
  );
}

/* ---------- Hızlı eylemler ---------- */
export function QuickActions({ t, onExpense, onIncome, onReports, onBudgets }: { t: Theme; onExpense: () => void; onIncome: () => void; onReports: () => void; onBudgets: () => void }) {
  const items: { id: string; label: string; icon: IconName; color: string; on: () => void }[] = [
    { id: 'expense', label: tr('qa.expense'), icon: 'add', color: t.cats[0], on: onExpense },
    { id: 'income', label: tr('qa.income'), icon: 'add', color: t.cats[2], on: onIncome },
    { id: 'reports', label: tr('qa.reports'), icon: 'bar-chart', color: t.cats[5], on: onReports },
    { id: 'budgets', label: tr('qa.budgets'), icon: 'wallet', color: t.cats[1], on: onBudgets },
  ];
  return (
    <View style={s.qaRow}>
      {items.map((x) => (
        <Pressable key={x.id} onPress={x.on} testID={`qa-${x.id}`} accessibilityRole="button" accessibilityLabel={x.label}
          style={({ pressed }) => [s.qa, { backgroundColor: rgba(x.color, t.name === 'ivory' ? 0.14 : 0.16), borderColor: rgba(x.color, 0.3), opacity: pressed ? 0.8 : 1 }]}>
          <View style={[s.qaIcon, { backgroundColor: x.color }]}><Ionicons name={x.icon} size={20} color="#ffffff" /></View>
          <Text style={{ color: t.fg, fontSize: 11, fontWeight: '600', textAlign: 'center' }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{x.label}</Text>
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
          <View style={{ height: 22, justifyContent: 'flex-end' }}>
            {pick !== null ? (
              <View style={[s.tip, { backgroundColor: t.fg, alignSelf: pick > a.dim / 2 ? 'flex-end' : 'flex-start' }]} testID="spending-tip">
                <Text style={{ color: t.bg, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{shortDay(days[pick])} · {money0(values[pick])}</Text>
              </View>
            ) : todayAmount !== null ? (
              <Text style={{ color: t.muted, fontSize: 11 }} numberOfLines={1}>{tr('bal.today', { amount: money0(todayAmount) })}</Text>
            ) : null}
          </View>
          <View style={{ flex: 1, minHeight: 128, flexDirection: 'row', alignItems: 'flex-end' }} onLayout={(e) => setH(Math.max(128, e.nativeEvent.layout.height))} accessibilityLabel={tr('dash.chartA11y')} role="img">
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'space-between' }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />)}
            </View>
            {values.map((v, i) => {
              const future = a.isCur && i > todayIdx;
              const h = v > 0 ? Math.max(5, (v / max) * (H - 6)) : 3;
              const active = pick === i;
              return (
                <Pressable key={i} testID={`bar-${i + 1}`} onPress={() => setSel(active ? null : i)} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button"
                  accessibilityLabel={`${shortDay(days[i])}: ${money0(v)}`} style={s.barCell}>
                  <View style={{ width: '64%', height: h, borderRadius: 3, backgroundColor: active ? t.accent : v === max && v > 0 ? rgba(t.accent, 0.9) : v > 0 ? rgba(t.accent, 0.38) : future ? 'transparent' : rgba(t.muted, 0.25) }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {labels.map((d) => <Text key={d} style={{ color: t.muted, fontSize: 10 }}>{d}</Text>)}
          </View>
        </View>
      )}
    </Card>
  );
}

/* ---------- Kategori dağılımı: halka grafik ---------- */
export function CategoriesCard({ t, monthItems, monthTitle }: { t: Theme; monthItems: Expense[]; monthTitle: string }) {
  const { total, rows, other } = categorySlices(monthItems, 4);
  const SIZE = 104;
  const R = 40;
  const C = 2 * Math.PI * R;
  const slices = [...rows.map((r) => ({ key: r.cat, label: catName(r.cat), pct: r.pct, color: t.cats[catIndex(r.cat)] })), ...(other ? [{ key: '_o', label: tr('dash.others'), pct: other.pct, color: t.muted }] : [])];
  let acc = 0;
  return (
    <Card t={t} style={s.half} testID="card-categories">
      <CardHead t={t} title={tr('card.categories')} sub={monthTitle} />
      {total === 0 ? (
        <View style={s.cardEmpty}>
          <Ionicons name="pie-chart-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }} testID="categories-empty">{tr('dash.emptySpending')}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ alignSelf: 'center', width: SIZE, height: SIZE }} accessibilityLabel={tr('dash.donutA11y')} role="img">
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              <G rotation="-90" origin="50, 50">
                <Circle cx="50" cy="50" r={R} stroke={t.line} strokeWidth={13} fill="none" />
                {slices.map((sl) => {
                  const len = Math.max(0, sl.pct * C - (slices.length > 1 ? 1.6 : 0));
                  const off = -acc * C;
                  acc += sl.pct;
                  return <Circle key={sl.key} cx="50" cy="50" r={R} stroke={sl.color} strokeWidth={13} fill="none" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off} />;
                })}
              </G>
            </Svg>
            <View pointerEvents="none" style={s.donutCenter}>
              <Text style={{ color: t.muted, fontSize: 9 }} numberOfLines={1}>{tr('dash.totalSpent')}</Text>
              <Amount fit text={money0(total)} style={{ color: t.fg, fontSize: fitFont(money0(total), 14, 6), fontWeight: '800' }} symbolColor={t.accent} />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            {slices.map((sl) => (
              <View key={sl.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: sl.color }} />
                <Text style={{ flex: 1, color: t.fg, fontSize: 12 }} numberOfLines={1}>{sl.label}</Text>
                <Text style={{ color: t.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{fmtPercent(Math.round(sl.pct * 100))}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

/* ---------- Aylık bütçe: ilerleme halkası ---------- */
export function BudgetCard({ t, spent, budget, onBudget, periodLabel }: { t: Theme; spent: number; budget: number; onBudget: () => void; periodLabel: string }) {
  const SIZE = 88;
  const R = 38;
  const C = 2 * Math.PI * R;
  const pct = budget > 0 ? spent / budget : 0;
  const left = budget - spent;
  const color = pct > 1 ? t.warn : pct >= 0.8 ? t.cats[1] : t.accent;
  return (
    <Card t={t} style={s.half} testID="card-budget" onPress={onBudget} a11y={tr('card.budget')}>
      <CardHead t={t} title={tr('card.budget')} sub={periodLabel} />
      {budget > 0 ? (
        <View style={{ gap: 10, alignItems: 'center' }}>
          <View style={{ width: SIZE, height: SIZE }} accessibilityLabel={tr('dash.budgetA11y', { pct: fmtPercent(Math.round(pct * 100)) })} role="img">
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              <G rotation="-90" origin="50, 50">
                <Circle cx="50" cy="50" r={R} stroke={t.line} strokeWidth={11} fill="none" />
                <Circle cx="50" cy="50" r={R} stroke={color} strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray={`${Math.min(1, pct) * C} ${C}`} />
              </G>
            </Svg>
            <View pointerEvents="none" style={s.donutCenter}>
              <Text style={{ color: t.fg, fontSize: 18, fontFamily: FONTS.bold }} testID="budget-pct">{fmtPercent(Math.round(pct * 100))}</Text>
              <Text style={{ color: t.muted, fontSize: 9 }} numberOfLines={1}>{tr('dash.budgetUsed')}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: 1 }}>
            <Amount fit text={money0(spent)} style={{ color: t.fg, fontSize: fitFont(money0(spent), 18, 8), fontWeight: '800' }} symbolColor={t.accent} />
            <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{tr('dash.budgetOf', { total: money0(budget) })}</Text>
          </View>
          <View style={[s.leftRow, { backgroundColor: left >= 0 ? t.goodSoft : t.warnSoft }]}>
            <Ionicons name={left >= 0 ? 'wallet-outline' : 'alert-circle-outline'} size={16} color={left >= 0 ? t.good : t.warn} />
            <View style={{ flex: 1 }}>
              <Amount fit text={money0(Math.abs(left))} style={{ color: t.fg, fontSize: fitFont(money0(Math.abs(left)), 13, 8), fontWeight: '700' }} symbolColor={t.accent} />
              <Text style={{ color: t.muted, fontSize: 10 }} numberOfLines={1}>{tr(left >= 0 ? 'dash.budgetLeft' : 'dash.budgetOver')}</Text>
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
        <View style={{ gap: 10 }}>
          {rows.map(({ sub, x }) => {
            const when = 'next' in x ? x.next : x.due;
            return (
              <Pressable key={sub.id} onPress={() => onOpen(sub)} accessibilityRole="button" accessibilityLabel={`${tr('sub.rowA11y', { name: sub.name })}${x.state === 'pending' ? ', ' + tr('sub.pendingOn', { date: shortDay(iso(x.due)) }) : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SubTypeIcon type={sub.type} t={t} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{sub.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    {x.state === 'pending' ? <Ionicons name="alert-circle" size={12} color={t.warn} /> : null}
                    <Text style={{ color: x.state === 'pending' ? t.warn : t.muted, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>{shortDay(iso(x.state === 'pending' ? x.due : when))}</Text>
                  </View>
                  <Text style={{ color: t.fg, fontSize: 11, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                    {money0(sub.amount)}<Text style={{ color: t.muted }}> · {tr(sub.freq === 'yearly' ? 'dash.yearly' : 'dash.monthly')}</Text>
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
const INCOME_ICON: Record<string, IconName> = { salary: 'cash-outline', freelance: 'laptop-outline', investment: 'trending-up-outline', gift: 'gift-outline', other: 'ellipsis-horizontal-circle-outline' };
export const incomeIcon = (c: string): IconName => INCOME_ICON[c] ?? 'cash-outline';

export function IncomeIcon({ cat, t, size = 36 }: { cat: string; t: Theme; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: rgba(t.good, 0.4), backgroundColor: rgba(t.good, 0.14), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={incomeIcon(cat)} size={size * 0.46} color={t.good} />
    </View>
  );
}

export function RecentCard({ t, list, onAll, onOpen }: { t: Theme; list: Txn[]; onAll: () => void; onOpen: (x: Txn) => void }) {
  return (
    <Card t={t} testID="card-recent">
      <CardHead t={t} title={tr('section.recent')} action={list.length ? tr('common.all') : undefined} onAction={onAll} actionTestID="recent-all" />
      {list.length ? (
        <View style={{ marginTop: 4 }}>
          {list.map((r, i) => {
            const income = r.kind === 'income';
            const title = r.x.note || (income ? incomeCatName(r.x.cat) : catName(r.x.cat));
            // Başka para biriminde girilmiş kayıtta özgün tutar da gösterilir (çevrilmiş tutarın yanında)
            const meta = [dayLabelShort(r.x.date), income ? incomeCatName(r.x.cat) : catName(r.x.cat), r.x.orig ? fmtMoney(r.x.orig.amount, r.x.orig.cur) : ''].filter(Boolean).join(' · ');
            return (
              <Pressable key={r.kind + r.x.id} onPress={() => onOpen(r)} testID={`recent-${i}`} accessibilityRole="button"
                accessibilityLabel={income ? tr('income.rowA11y', { cat: incomeCatName(r.x.cat), amount: money(r.x.amount) }) : tr('expense.rowA11y', { cat: catName(r.x.cat), amount: money(r.x.amount) })}
                style={({ pressed }) => [s.txn, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }, pressed && { opacity: 0.8 }]}>
                {income ? <IncomeIcon cat={r.x.cat} t={t} /> : <CatIcon cat={r.x.cat} t={t} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{meta}</Text>
                </View>
                <Amount text={`${income ? '+' : '−'}${money(r.x.amount)}`} style={{ color: income ? t.good : t.warn, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }} />
                <Ionicons name="chevron-forward" size={15} color={t.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={s.cardEmpty}>
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

/* ---------- Alt sekme çubuğu ---------- */
export type TabKey = 'ozet' | 'harcamalar' | 'butce' | 'raporlar' | 'ayarlar';
const TABS: { key: TabKey; icon: IconName; on: IconName; label: string }[] = [
  { key: 'ozet', icon: 'home-outline', on: 'home', label: 'tab.home' },
  { key: 'harcamalar', icon: 'list-outline', on: 'list', label: 'tab.transactions' },
  { key: 'butce', icon: 'pie-chart-outline', on: 'pie-chart', label: 'tab.budget' },
  { key: 'raporlar', icon: 'bar-chart-outline', on: 'bar-chart', label: 'tab.reports' },
  { key: 'ayarlar', icon: 'settings-outline', on: 'settings', label: 'tab.settings' },
];

export function TabBar({ t, current, onSelect, bottomInset }: { t: Theme; current: string; onSelect: (k: TabKey) => void; bottomInset: number }) {
  return (
    <View style={[s.tabBar, { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: bottomInset, height: TAB_BAR_H + bottomInset }]} accessibilityRole="tablist" testID="tab-bar">
      <View style={s.tabInner}>
        {TABS.map((x) => {
          const on = current === x.key;
          return (
            <Pressable key={x.key} onPress={() => onSelect(x.key)} testID={`tab-${x.key}`} accessibilityRole="tab" aria-selected={on} accessibilityLabel={tr(x.label)} style={s.tab}>
              <View style={[s.tabPill, on && { backgroundColor: t.accentSoft }]}>
                <Ionicons name={on ? x.on : x.icon} size={22} color={on ? t.accent : t.muted} />
                <Text style={{ color: on ? t.accent : t.muted, fontSize: 10, fontWeight: on ? '700' : '500' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tr(x.label)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  const block = (h: number, extra: object = {}) => ({ height: h, borderRadius: 24, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, ...extra });
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset + 12, paddingHorizontal: 16, gap: 14 }} accessible accessibilityLabel={tr('state.loading')} accessibilityRole="progressbar" testID="dash-skeleton">
      <View style={{ width: '100%', maxWidth: DASH_MAX, alignSelf: 'center', gap: 14 }}>
        <Pulse style={block(64, { width: '60%', borderRadius: 16 })} />
        <Pulse style={block(170)} />
        <Pulse style={{ flexDirection: 'row', gap: 10 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={block(84, { flex: 1 })} />)}</Pulse>
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
      <Text style={{ color: t.fg, fontSize: 24, fontFamily: FONTS.bold, textAlign: 'center' }} accessibilityRole="header">{tr('state.errorTitle')}</Text>
      <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 420 }}>{tr('state.errorBody')}</Text>
      <Button label={tr('state.retry')} onPress={onRetry} t={t} style={{ minWidth: 180 }} />
    </View>
  );
}

/** Kısa uyarı bandı (kur alınamadı gibi): metin + isteğe bağlı eylem. */
export function InlineNotice({ t, kind, text, action, onAction }: { t: Theme; kind: 'warn' | 'info'; text: string; action?: string; onAction?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, alignItems: 'center', backgroundColor: kind === 'warn' ? t.warnSoft : t.accentSoft }} testID="inline-notice">
      <Ionicons name={kind === 'warn' ? 'cloud-offline-outline' : 'information-circle-outline'} size={20} color={kind === 'warn' ? t.warn : t.accent} />
      <Text style={{ flex: 1, color: t.fg, fontSize: 13, lineHeight: 18 }}>{text}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={hit} accessibilityRole="button" testID="notice-action"><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  half: { flex: 1, minWidth: 0, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingVertical: 6, paddingLeft: 6, paddingRight: 10 },
  symbolDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, gap: 10 },
  curRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  hero: { borderRadius: 28, padding: 18, borderWidth: 1, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  heroCols: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  eye: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  mini: { gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 },
  miniIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaRow: { flexDirection: 'row', gap: 10 },
  qa: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 2 },
  qaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, flexGrow: 1 },
  smallBtn: { height: 40, borderRadius: 14, paddingHorizontal: 12 },
  tip: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  barCell: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  donutCenter: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, alignSelf: 'stretch' },
  txn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  tabInner: { flexDirection: 'row', height: TAB_BAR_H, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 640, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill: { alignItems: 'center', gap: 2, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 2, alignSelf: 'stretch', marginHorizontal: 1 },
});
