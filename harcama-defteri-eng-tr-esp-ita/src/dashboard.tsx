// Özet ekranı (gösterge paneli): cam yüzeyler, bento ızgarası, bağlama göre parlayan çerçeveler.
// Renkler `makeGlass` (koyu/açık mod + 4 kartela) ile gelir; uygulamanın geri kalanı kendi temasını kullanır.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, RefObject, useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fmtMoney } from './currency';
import { fmtPercent, getLanguage, t as tr, upper } from './i18n';
import {
  Analysis, Expense, Insight, Settings, Sub, SubState, catIndex, catName, dayLabel, monthLabel, money, money0, pad, shortDay, subStatus, subType, sum, todayIso,
} from './lib';
import { Glass, rgba } from './palette';
import { FONTS, Theme } from './theme';
import { IconName, catIconName } from './ui';

type Screen = 'harcamalar' | 'raporlar' | 'abonelikler' | 'ayarlar';

export type DashboardProps = {
  g: Glass;
  t: Theme;
  a: Analysis;
  ym: string;
  items: Expense[];
  monthItems: Expense[];
  subs: Sub[];
  settings: Settings;
  notes: Insight[];
  rateNote: ReactNode;
  alert: boolean;
  top: number;
  bottom: number;
  scrollRef: RefObject<ScrollView | null>;
  onMenu: () => void;
  /** Tutarlar gizli mi (göz simgesi). */
  hidden: boolean;
  onToggleHidden: () => void;
  onMonth: (n: number) => void;
  onThisMonth: () => void;
  onBudget: () => void;
  onGo: (s: Screen) => void;
  onAdd: () => void;
  onAddSub: () => void;
  onSub: (s: Sub, state: SubState['state']) => void;
  onExpense: (x: Expense) => void;
  /** Yatay kaydırılan alana dokunulunca geri hareketi devre dışı kalsın. */
  lockSwipe: () => void;
};

const SYM = ['₺', '$', '€', '£', '¥'];
/** Büyük tutar, bütçe rozetlerinin yanına sığsın diye uzunluğuna göre küçülür ("₺7.950,00" 40 px, "₺123.456,00" 28 px). */
const heroSize = (txt: string) => (txt.length <= 9 ? 40 : txt.length <= 10 ? 34 : txt.length <= 12 ? 28 : 24);

/** Serif tutar; para simgesi rakamlardan küçük ve ince. */
function Money({ text, size, color, style }: { text: string; size: number; color: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: FONTS.display, fontSize: size, color, fontVariant: ['lining-nums'] }, style]} numberOfLines={1}>
      {text.split(/([₺$€£¥])/).map((p, i) =>
        SYM.includes(p) ? <Text key={i} style={{ fontFamily: 'System', fontSize: size * 0.75, fontWeight: '400' }}>{p}</Text> : p,
      )}
    </Text>
  );
}

/** Kart üst başlığı: büyük harf, geniş aralık. */
function Cap({ children, g, color, style, lines = 1 }: { children: string; g: Glass; color?: string; style?: StyleProp<TextStyle>; lines?: number }) {
  return <Text style={[s.cap, { color: color ?? g.muted }, getLanguage() === 'zh' && { letterSpacing: 0 }, style]} numberOfLines={lines}>{upper(children)}</Text>;
}

function Card({ g, style, children }: { g: Glass; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[{ backgroundColor: g.card, borderColor: g.cardLine, borderWidth: 1 }, !g.dark && s.lightShadow, style]}>{children}</View>;
}

/** Ekranın zemini: sağ üstten sol alta derin geçiş + vurgu renginde yumuşak ambiyans ışığı. */
function Backdrop({ g }: { g: Glass }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[g.bgFrom, g.bgTo]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="amb" cx="100%" cy="0%" r="80%" fx="100%" fy="0%">
            <Stop offset="0" stopColor={g.accent} stopOpacity={g.dark ? 0.14 : 0.1} />
            <Stop offset="1" stopColor={g.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#amb)" />
      </Svg>
    </View>
  );
}

/** Bütçe ilerlemesi: ortasında yumuşak tepe yapan dalga; ilerleyen kısım vurgudan tehlike rengine geçer, altı parlar. */
function Wave({ g, progress }: { g: Glass; progress: number }) {
  const [w, setW] = useState(0);
  const H = 44;
  const p = Math.max(0, Math.min(1, progress));
  const x0 = 6, x1 = Math.max(x0, w - 8);
  const y = (x: number) => 34 - 22 * Math.exp(-Math.pow(((x - x0) / Math.max(1, x1 - x0) - 0.5) / 0.22, 2));
  const N = 64;
  const all = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  const xEnd = x0 + (x1 - x0) * p;
  const done = all.filter((x) => x < xEnd).concat([xEnd]);
  const line = (xs: number[]) => xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y(x).toFixed(1)}`).join(' ');
  const area = `${line(done)} L${xEnd.toFixed(1)} ${H} L${x0} ${H} Z`;
  return (
    <View style={{ height: H, marginVertical: 6 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Defs>
            <SvgGradient id="wl" x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g.accent} />
              <Stop offset="0.55" stopColor={g.accent} />
              <Stop offset="1" stopColor={g.danger} />
            </SvgGradient>
            <SvgGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={g.accent} stopOpacity={0.38} />
              <Stop offset="1" stopColor={g.accent} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          <Path d={line(all)} stroke={g.faint} strokeWidth={4} strokeLinecap="round" fill="none" />
          {p > 0 ? (
            <>
              <Path d={area} fill="url(#wg)" />
              <Path d={line(done)} stroke="url(#wl)" strokeOpacity={0.25} strokeWidth={11} strokeLinecap="round" fill="none" />
              <Path d={line(done)} stroke="url(#wl)" strokeWidth={4} strokeLinecap="round" fill="none" />
            </>
          ) : null}
          <Circle cx={xEnd} cy={y(xEnd)} r={6} fill={g.dark ? '#0B1114' : '#FFFFFF'} stroke={p >= 1 ? g.danger : g.accent} strokeWidth={2.5} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Mini çizgi grafik (günlük harcamalar) ve altındaki gradyan dolgu. */
function Sparkline({ g, values }: { g: Glass; values: number[] }) {
  const W = 60, H = 32;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 4) + 2, H - 3 - (v / max) * (H - 8)] as const);
  // Yumuşak eğri: ardışık noktalar arasında yatay kontrol noktalı kübik bezier
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], mx = (px + x) / 2;
    d += ` C${mx.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return (
    <Svg width={W} height={H} style={s.deco}>
      <Defs>
        <SvgGradient id="sp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={g.accent} stopOpacity={0.35} />
          <Stop offset="1" stopColor={g.accent} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={`${d} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`} fill="url(#sp)" />
      <Path d={d} stroke={g.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** En yoğun günün çevresindeki 7 gün: ortadaki (en yoğun) çubuk parlak, diğerleri soluk. */
function MiniBars({ g, values, hi }: { g: Glass; values: number[]; hi: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[s.deco, s.bars]}>
      {values.map((v, i) => (
        <View key={i} style={[s.bar, { height: Math.max(5, (v / max) * 30) },
          i === hi ? { backgroundColor: g.accent, shadowColor: g.accent, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } } : { backgroundColor: g.faint }]} />
      ))}
    </View>
  );
}

/** Küçük hap rozet; `glow` verilirse dışa doğru renkli parlama. */
function Badge({ label, color, textColor, icon, glow }: { label: string; color: string; textColor: string; icon?: IconName; glow?: boolean }) {
  return (
    <View style={[s.badge, { backgroundColor: rgba(color, 0.15), borderColor: rgba(color, 0.3) },
      glow && { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
      {icon ? <Ionicons name={icon} size={11} color={textColor} /> : null}
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function Dashboard(p: DashboardProps) {
  const { g, t, a, ym, items, monthItems, subs, settings, notes } = p;
  const budget = settings.budget;
  const left = budget - a.total;
  const over = !!budget && left < 0;
  const glassBtn = { backgroundColor: g.card, borderColor: g.cardLine, borderWidth: 1 };

  /* ---- Ödemeler: bekleyen önce, sonra yaklaşan, sonra ödenen ---- */
  const rank = { pending: 0, upcoming: 1, paid: 2, skipped: 3 };
  const payments = subs.map((x) => ({ s: x, st: subStatus(x, items) })).sort((q, r) => rank[q.st.state] - rank[r.st.state]);

  /* ---- Bento değerleri ---- */
  const has = monthItems.length > 0;
  const daily = Array.from({ length: a.elapsed }, (_, i) => a.perDay[`${ym}-${pad(i + 1)}`] || 0);
  const topD = a.topDay ? +a.topDay.slice(8) : 0;
  const start = Math.max(1, Math.min(topD - 3, a.dim - 6));
  const week = Array.from({ length: 7 }, (_, i) => a.perDay[`${ym}-${pad(start + i)}`] || 0);
  const vs = a.prevSame > 0 ? Math.round(((a.curSame - a.prevSame) / a.prevSame) * 100) : null;
  const recent = [...items].sort((q, r) => (q.date < r.date ? 1 : q.date > r.date ? -1 : r.ts - q.ts)).slice(0, 5);

  const tile = (label: string, value: ReactNode, sub: ReactNode, deco?: ReactNode) => (
    <Card g={g} style={s.tile}>
      <Cap g={g} lines={2}>{label}</Cap>
      <View style={{ gap: 4 }}>
        {value}
        {sub}
      </View>
      {deco}
    </Card>
  );
  const small = (txt: string) => <Text style={[s.small, { color: g.muted }]} numberOfLines={1}>{txt}</Text>;
  const dash = <Text style={[s.tileVal, { color: g.muted, fontFamily: FONTS.display }]}>—</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop g={g} />
      <ScrollView ref={p.scrollRef} contentContainerStyle={[s.scroll, { paddingTop: p.top + 8, paddingBottom: p.bottom + 110 }]} keyboardShouldPersistTaps="handled">
        {/* Başlık + tutarları gizle */}
        <View style={s.header}>
          <Pressable onPress={p.onMenu} style={[s.round42, glassBtn]} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr('menu.open')}>
            <Ionicons name="person-outline" size={19} color={g.fg} />
            {p.alert ? <View style={[s.alertDot, { backgroundColor: g.accent, borderColor: g.bgFrom }]} /> : null}
          </Pressable>
          <Text style={[s.h1, { color: g.fg }]} numberOfLines={1}>{tr('title.ozet')}</Text>
          <Pressable onPress={p.onToggleHidden} style={[s.round42, glassBtn]} hitSlop={6} accessibilityRole="button"
            accessibilityState={{ selected: p.hidden }} accessibilityLabel={tr(p.hidden ? 'dash.showAmounts' : 'dash.hideAmounts')}>
            <Ionicons name={p.hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={p.hidden ? g.accentText : g.fg} />
          </Pressable>
        </View>

        {/* Ay seçici */}
        <View style={s.monthRow}>
          <Pressable onPress={() => p.onMonth(-1)} style={[s.round44, glassBtn]} accessibilityRole="button" accessibilityLabel={tr('month.prev')}>
            <Ionicons name="chevron-back" size={20} color={g.fg} />
          </Pressable>
          <View style={[s.monthPill, glassBtn]}>
            <Pressable onPress={p.onThisMonth} disabled={a.isCur} style={[s.knob, { backgroundColor: g.dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.06)' }]}
              accessibilityRole="button" accessibilityLabel={tr('dash.thisMonthBtn')}>
              <Ionicons name="calendar-outline" size={15} color={a.isCur ? g.muted : g.accentText} />
            </Pressable>
            <Text style={[s.monthTxt, { color: g.fg }]} numberOfLines={1}>{monthLabel(ym)}</Text>
            <View style={{ width: 34 }} />
          </View>
          <Pressable onPress={() => p.onMonth(1)} disabled={a.isCur} style={[s.round44, glassBtn, { opacity: a.isCur ? 0.35 : 1 }]} accessibilityRole="button" accessibilityLabel={tr('month.next')}>
            <Ionicons name="chevron-forward" size={20} color={g.fg} />
          </Pressable>
        </View>

        {/* Bütçe durumu */}
        <Card g={g} style={s.hero}>
          <View style={s.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Cap g={g} lines={2}>{tr('dash.budgetStatus')}</Cap>
              <Cap g={g} style={{ marginTop: 8 }}>{a.isCur ? tr('hero.thisMonth') : tr('hero.monthTotal')}</Cap>
              <Money text={money(a.total)} size={heroSize(money(a.total))} color={g.fg} style={{ marginTop: 4, lineHeight: 48 }} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pressable onPress={p.onBudget} hitSlop={8} style={[s.budgetPill, { borderColor: g.dark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)' }]}>
                <Text style={{ color: g.fg, fontSize: 12 }}>{budget ? tr('hero.budget', { amount: money0(budget) }) : tr('hero.setBudget')}</Text>
              </Pressable>
              {budget ? (
                over
                  ? <Badge label={tr('hero.over', { amount: money0(-left) })} color={g.danger} textColor={g.dangerText} icon="warning" />
                  : <Badge label={tr('hero.left', { amount: money0(left) })} color={g.success} textColor={g.successText} icon="checkmark-circle" />
              ) : null}
            </View>
          </View>
          {/* Bütçe yoksa dalga ayın ne kadarının geçtiğini gösterir */}
          <Wave g={g} progress={budget ? a.total / budget : a.elapsed / a.dim} />
          <View style={s.heroBottom}>
            <View>
              <Cap g={g}>{a.isCur ? tr('hero.today') : tr('hero.avgDaily')}</Cap>
              <Money text={a.isCur ? money(sum(items.filter((x) => x.date === todayIso()))) : money(a.avg)} size={20} color={g.fg} style={{ marginTop: 4 }} />
            </View>
            {budget ? <Text style={[s.small, { color: over ? g.dangerText : g.muted }]}>{tr('hero.used', { pct: Math.round((a.total / budget) * 100) })}</Text> : null}
          </View>
        </Card>
        {p.rateNote}

        {/* Ödemeler (abonelikler) */}
        <View style={{ gap: 8 }}>
          <Cap g={g} style={{ paddingHorizontal: 4 }}>{tr('dash.payments')}</Cap>
          <View onStartShouldSetResponderCapture={() => { p.lockSwipe(); return false; }} style={{ marginHorizontal: -16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.payRow}>
              {payments.map(({ s: x, st }) => {
                const color = st.state === 'paid' ? g.success : st.state === 'pending' ? g.accent : null;
                const txt = st.state === 'paid' ? g.successText : st.state === 'pending' ? g.accentText : g.muted;
                const label = st.state === 'paid' ? tr('dash.paid') : st.state === 'pending' ? tr('dash.pending')
                  : st.state === 'upcoming' ? tr('sub.inDays', { n: st.days }) : tr('dash.skipped');
                return (
                  <Pressable key={x.id} onPress={() => p.onSub(x, st.state)} accessibilityRole="button" accessibilityLabel={`${x.name} · ${label}`}
                    style={({ pressed }) => [s.pay, { opacity: pressed ? 0.8 : 1 },
                      color ? { borderColor: rgba(color, st.state === 'pending' ? 1 : 0.4), backgroundColor: rgba(color, g.dark ? 0.08 : 0.1) } : { borderColor: g.cardLine, backgroundColor: g.card },
                      st.state === 'pending' && { borderWidth: 1.5, shadowColor: g.accent, shadowOpacity: 0.45, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } }]}>
                    <View style={s.payTop}>
                      <Text style={[s.payName, { color: g.fg }]} numberOfLines={1}>{x.name}</Text>
                      <View style={[s.payIcon, { backgroundColor: st.state === 'paid' ? g.success : rgba(color ?? (g.dark ? '#8A99A4' : '#64748B'), 0.18) }]}>
                        <Ionicons name={st.state === 'paid' ? 'checkmark' : (subType(x.type).icon as IconName)} size={13} color={st.state === 'paid' ? '#FFFFFF' : txt} />
                      </View>
                    </View>
                    <Text style={[s.small, { color: g.fg }]} numberOfLines={1}>
                      {money0(x.amount)}<Text style={{ color: g.muted }}>{' • '}</Text><Text style={{ color: txt, fontWeight: '600' }}>{label}</Text>
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={p.onAddSub} accessibilityRole="button" style={[s.pay, s.payAdd, { borderColor: g.faint }]}>
                <Ionicons name="add-circle-outline" size={22} color={g.muted} />
                <Text style={[s.small, { color: g.muted }]} numberOfLines={1}>{tr('subs.add').replace(/^\+\s*/, '')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>

        {/* Bento ızgarası */}
        <View style={s.grid}>
          {tile(tr('tile.avg'), has ? <Money text={money0(a.avg)} size={24} color={g.fg} /> : dash, small(tr('tile.avgSub', { n: a.elapsed })),
            has && daily.length > 1 ? <Sparkline g={g} values={daily} /> : null)}
          {tile(tr('tile.vsLast'),
            vs === null || !has ? dash : <Text style={[s.tileVal, { color: g.fg }]}>{`${vs > 0 ? '+' : vs < 0 ? '−' : ''}${fmtPercent(Math.abs(vs))}`}</Text>,
            vs === null || !has ? small(tr('tile.noLast'))
              : <View style={{ flexDirection: 'row' }}><Badge label={vs > 0 ? tr('tile.more') : vs < 0 ? tr('tile.less') : tr('tile.same')}
                  color={vs > 0 ? g.danger : vs < 0 ? g.success : g.accent} textColor={vs > 0 ? g.dangerText : vs < 0 ? g.successText : g.accentText} /></View>)}
          {tile(tr('tile.busiest'), has && a.topDay ? <Money text={money0(a.perDay[a.topDay])} size={24} color={g.fg} /> : dash,
            small(has && a.topDay ? shortDay(a.topDay) : ' '), has && a.topDay ? <MiniBars g={g} values={week} hi={topD - start} /> : null)}
          {a.isCur
            ? tile(tr('tile.projection'), has ? <Money text={money0(a.projection)} size={24} color={g.fg} /> : dash,
              has && budget ? (
                <View style={{ flexDirection: 'row' }}>
                  {a.projection > budget
                    ? <Badge label={tr('tile.willExceed')} color={g.danger} textColor={g.dangerText} glow />
                    : <Badge label={tr('tile.withinBudget')} color={g.success} textColor={g.successText} />}
                </View>
              ) : small(tr('tile.pace')))
            : tile(tr('tile.count'), has ? <Text style={[s.tileVal, { color: g.fg }]}>{String(monthItems.length)}</Text> : dash,
              has ? small(tr('tile.average', { amount: money0(a.total / monthItems.length) })) : small(' '))}
        </View>

        {/* Öne çıkanlar */}
        {notes.length ? (
          <Card g={g} style={s.block}>
            <View style={s.blockHead}>
              <Cap g={g}>{tr('section.highlights')}</Cap>
              <Pressable onPress={() => p.onGo('raporlar')} hitSlop={8}><Text style={[s.link, { color: g.accentText }]}>{tr('common.all')}</Text></Pressable>
            </View>
            <View style={{ gap: 14, marginTop: 12 }}>
              {notes.slice(0, 3).map((n, i) => {
                const c = n.kind === 'good' ? g.success : n.kind === 'warn' ? g.danger : g.accent;
                const ic: IconName = n.kind === 'warn' ? 'alert' : n.kind === 'good' ? 'checkmark' : 'sparkles';
                return (
                  <View key={i} style={s.note}>
                    <View style={[s.noteIcon, { backgroundColor: rgba(n.kind === 'warn' ? g.accent : c, 0.2) }]}>
                      <Ionicons name={ic} size={15} color={n.kind === 'warn' ? g.accentText : n.kind === 'good' ? g.successText : g.accentText} />
                    </View>
                    <Text style={[s.noteTxt, { color: g.fg }]}>{n.text}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Son harcamalar */}
        <Card g={g} style={s.block}>
          <View style={s.blockHead}>
            <Cap g={g}>{tr('section.recent')}</Cap>
            {recent.length ? <Pressable onPress={() => p.onGo('harcamalar')} hitSlop={8}><Text style={[s.link, { color: g.accentText }]}>{tr('common.all')}</Text></Pressable> : null}
          </View>
          {recent.length ? (
            <View style={{ marginTop: 6 }}>
              {recent.map((x, i) => {
                const c = t.cats[catIndex(x.cat)];
                return (
                  <Pressable key={x.id} onPress={() => p.onExpense(x)} style={({ pressed }) => [s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: g.cardLine }, pressed && { opacity: 0.7 }]}
                    accessibilityLabel={tr('expense.rowA11y', { cat: catName(x.cat), amount: money(x.amount) })}>
                    <View style={[s.rowIcon, { backgroundColor: rgba(c, 0.18) }]}>
                      <Ionicons name={catIconName(x.cat)} size={17} color={c} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.rowTitle, { color: g.fg }]} numberOfLines={1}>{x.note || catName(x.cat)}</Text>
                      <Text style={[s.small, { color: g.muted }]} numberOfLines={1}>{[x.note ? catName(x.cat) : '', dayLabel(x.date), x.orig ? fmtMoney(x.orig.amount, x.orig.cur) : ''].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Text style={[s.rowAmt, { color: g.fg }]}>{money(x.amount)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : <Text style={[s.small, { color: g.muted, marginTop: 10, lineHeight: 18 }]}>{tr('recent.empty')}</Text>}
        </Card>
      </ScrollView>

      {/* Yüzen alt menü */}
      <View style={[s.dock, { bottom: p.bottom + 10, backgroundColor: g.dock, borderColor: g.cardLine }]}>
        <View style={s.dockItem}>
          <Ionicons name="home" size={22} color={g.fg} />
          <View style={[s.dockDot, { backgroundColor: g.fg }]} />
        </View>
        <Pressable onPress={() => p.onGo('raporlar')} style={s.dockItem} accessibilityRole="button" accessibilityLabel={tr('menu.reports')}>
          <Ionicons name="stats-chart-outline" size={21} color={g.muted} />
        </Pressable>
        <Pressable onPress={p.onAdd} accessibilityRole="button"
          style={({ pressed }) => [s.add, { borderColor: g.accent, backgroundColor: rgba(g.accent, g.dark ? 0.14 : 0.12), shadowColor: g.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={{ color: g.fg, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{tr('fab.add')}</Text>
        </Pressable>
        <Pressable onPress={() => p.onGo('harcamalar')} style={s.dockItem} accessibilityRole="button" accessibilityLabel={tr('menu.expenses')}>
          <Ionicons name="card-outline" size={21} color={g.muted} />
        </Pressable>
        <Pressable onPress={() => p.onGo('ayarlar')} style={s.dockItem} accessibilityRole="button" accessibilityLabel={tr('menu.settings')}>
          <Ionicons name="settings-outline" size={21} color={g.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  lightShadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  cap: { fontSize: 11, fontWeight: '500', letterSpacing: 0.9 },
  small: { fontSize: 12 },
  link: { fontSize: 12, fontWeight: '500' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 34, fontFamily: FONTS.display, letterSpacing: -0.3, flex: 1 },
  round42: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  round44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  alertDot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthPill: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  knob: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthTxt: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: FONTS.bold },
  hero: { borderRadius: 26, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  budgetPill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  payRow: { gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  pay: { minWidth: 138, maxWidth: 190, borderRadius: 18, padding: 12, borderWidth: 1, gap: 14 },
  payAdd: { borderStyle: 'dashed', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  payTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  payName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  payIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 22, padding: 16, minHeight: 120, justifyContent: 'space-between', overflow: 'hidden', gap: 10 },
  tileVal: { fontSize: 24, fontFamily: FONTS.display },
  deco: { position: 'absolute', right: 10, bottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 30 },
  bar: { width: 5, borderRadius: 3 },
  block: { borderRadius: 24, padding: 16 },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noteIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noteTxt: { flex: 1, fontSize: 13, lineHeight: 18, paddingTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowAmt: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  dock: { position: 'absolute', left: 12, right: 12, maxWidth: 400, alignSelf: 'center', borderRadius: 99, padding: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  dockItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dockDot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2 },
  add: { flexShrink: 1, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 99, borderWidth: 1.5, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
});
