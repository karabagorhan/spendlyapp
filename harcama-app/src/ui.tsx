import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { fmtPercent, t as tr, upper } from './i18n';
import { Analysis, Insight, catIndex, catName, compact, pad, subLabel, subType, subTypeIndex } from './lib';
import { FONTS, Theme } from './theme';

export function Chip({ label, active, color, icon, onPress, t }: { label: string; active: boolean; color?: string; icon?: IconName; onPress: () => void; t: Theme }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: active ? t.accent : t.bg, borderColor: active ? t.accent : t.line, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? t.accentFg : color ?? t.fg} /> : color ? <View style={[s.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={{ color: active ? t.accentFg : t.fg, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ kind, label, t }: { kind: 'up' | 'down' | 'flat'; label: string; t: Theme }) {
  const bg = kind === 'up' ? t.warnSoft : kind === 'down' ? t.goodSoft : t.bg;
  const fg = kind === 'up' ? t.warn : kind === 'down' ? t.good : t.muted;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', t, style, disabled }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'dark'; t: Theme; style?: ViewStyle; disabled?: boolean;
}) {
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.warn : kind === 'dark' ? t.fg : t.surface;
  const fg = kind === 'primary' ? t.accentFg : kind === 'danger' ? t.surface : kind === 'dark' ? t.bg : t.fg;
  const border = kind === 'ghost' ? t.goldLine : bg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: 16, letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children, t, color }: { children: string; t: Theme; color?: string }) {
  return <Text style={[s.label, { color: color ?? t.muted }]}>{upper(children)}</Text>;
}

/** Seçili ayın günlük harcama çubukları; ortalama ve günlük bütçe kesikli çizgi. */
export function DailyChart({ a, ym, budget, selected, onSelect, t }: {
  a: Analysis; ym: string; budget: number; selected: string | null; onSelect: (day: string) => void; t: Theme;
}) {
  const [w, setW] = useState(0);
  const H = 160, L = 34, R = 4, T = 8, B = 20;
  const iw = Math.max(0, w - L - R), ih = H - T - B, n = a.dim;
  const budgetDay = budget ? budget / a.dim : 0;
  const vals = Array.from({ length: n }, (_, i) => a.perDay[`${ym}-${pad(i + 1)}`] || 0);
  const raw = Math.max(...vals, a.avg, budgetDay, 1) * 1.05;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const max = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const y = (v: number) => T + ih - (v / max) * ih;
  const slot = iw / n, bw = Math.max(2, slot * 0.68);
  const todayD = a.isCur ? new Date().getDate() : 0;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <>
          <Svg width={w} height={H}>
            {[0, 0.5, 1].map((f) => (
              <Line key={f} x1={L} x2={w - R} y1={y(max * f)} y2={y(max * f)} stroke={t.line} strokeWidth={1} />
            ))}
            {[0, 0.5, 1].map((f) => (
              <SvgText key={'l' + f} x={L - 6} y={y(max * f) + 3} fontSize={10} fill={t.muted} textAnchor="end">
                {compact(max * f)}
              </SvgText>
            ))}
            {vals.map((v, i) => {
              if (!v) return null;
              const d = i + 1;
              const h = Math.max(2, (v / max) * ih);
              const day = `${ym}-${pad(d)}`;
              const fill = selected === day ? t.fg : budgetDay && v > budgetDay ? t.warn : d === todayD ? t.accent : t.bar;
              return <Rect key={d} x={L + i * slot + (slot - bw) / 2} y={T + ih - h} width={bw} height={h} rx={1.5} fill={fill} />;
            })}
            {vals.map((_, i) => {
              const d = i + 1;
              if (!(d === 1 || (d % 5 === 0 && n - d >= 2) || d === n)) return null;
              return (
                <SvgText key={'x' + d} x={L + i * slot + slot / 2} y={H - 5} fontSize={10} fill={t.muted} textAnchor="middle">
                  {String(d)}
                </SvgText>
              );
            })}
            {a.avg > 0 && <Line x1={L} x2={w - R} y1={y(a.avg)} y2={y(a.avg)} stroke={t.muted} strokeWidth={1.5} strokeDasharray="4 3" />}
            {budgetDay > 0 && <Line x1={L} x2={w - R} y1={y(budgetDay)} y2={y(budgetDay)} stroke={t.warn} strokeWidth={1.5} strokeDasharray="4 3" />}
          </Svg>
          <View style={[StyleSheet.absoluteFill, { left: L, right: R, flexDirection: 'row' }]}>
            {vals.map((_, i) => (
              <Pressable
                key={i}
                style={{ flex: 1 }}
                onPress={() => onSelect(`${ym}-${pad(i + 1)}`)}
                accessibilityLabel={tr('chart.dayLabel', { day: i + 1 })}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Tutar metni: rakamlar serif yazı tipinde, ₺ işareti (yazı tipinde bulunmadığı için) sistem yazı tipinde
 * ve daha küçük yazılır.
 */
export function Amount({ text, style, symbolColor }: { text: string; style: StyleProp<TextStyle>; symbolColor?: string }) {
  const flat = StyleSheet.flatten(style) || {};
  const size = (flat.fontSize ?? 16) * 0.6;
  const parts = text.split('₺');
  return (
    <Text style={[style, { fontVariant: ['lining-nums'] }]}>
      {parts.map((p, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={{ fontFamily: 'System', fontSize: size, fontWeight: '400', color: symbolColor ?? flat.color, letterSpacing: 0 }}>₺</Text> : null}
          {p}
        </Text>
      ))}
    </Text>
  );
}

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };
export const catIconName = (c: string): IconName => CAT_ICONS[catIndex(c)];

export type MenuBadge = { text: string; kind: 'gold' | 'warn' | 'muted' };
export type MenuItem = { key: string; label: string; icon: IconName; badge?: MenuBadge | null };
export type MenuSection = { title: string; items: MenuItem[] };
export type MenuPin = { cat: string; amount: string };
export type MenuBudget = { label: string; pct: number; amount: string; total: string; over: boolean } | null;

const MENU_W = 304;

/** Soldan kayarak açılan yan menü: hesap kartı, bölümler, bu ayın kategorileri, bütçe kartı ve profil. */
export function SideMenu({ open, onClose, header, sections, pins, current, onSelect, onPin, budget, onBudget, status, profile, top, bottom, t }: {
  open: boolean; onClose: () => void;
  header: { title: string; sub: string };
  sections: MenuSection[]; pins: MenuPin[]; current: string;
  onSelect: (key: string) => void; onPin: (cat: string) => void;
  budget: MenuBudget; onBudget: () => void; status: string;
  profile: { name: string; sub: string; initials: string };
  top: number; bottom: number; t: Theme;
}) {
  const x = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(x, { toValue: 0, duration: 240, useNativeDriver: true }).start();
    } else {
      Animated.timing(x, { toValue: 1, duration: 190, useNativeDriver: true }).start(({ finished }) => finished && setMounted(false));
    }
  }, [open, x]);
  if (!mounted) return null;
  const badgeStyle = (b: MenuBadge) =>
    b.kind === 'gold' ? { bg: t.gold, fg: t.accentFg, border: t.gold }
      : b.kind === 'warn' ? { bg: t.warnSoft, fg: t.warn, border: t.warnSoft }
      : { bg: t.raised, fg: t.muted, border: t.line };
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: x.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={tr('menu.close')} />
      </Animated.View>
      <Animated.View
        accessibilityRole="menu"
        style={[s.menu, { width: MENU_W, backgroundColor: t.surface, borderColor: t.goldLine, paddingTop: top + 14, paddingBottom: bottom + 14,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -(MENU_W + 24)] }) }] }]}
      >
        {/* Hesap kartı */}
        <Pressable onPress={() => onSelect('ozet')} style={({ pressed }) => [s.account, { backgroundColor: t.raised, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient colors={['#e4c98f', '#c9a86a', '#8a6a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.monogram}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#0b0b0d' }}>{tr('app.monogram')}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: t.fg }} numberOfLines={1}>{header.title}</Text>
            <Text style={{ fontSize: 13, color: t.muted }} numberOfLines={1}>{header.sub}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={t.muted} />
        </Pressable>

        {/* Kısa ekranlarda bütçe kartı dahil her şey kayar; uzun ekranlarda kart en alta yaslanır */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {sections.map((sec) => (
            <View key={sec.title}>
              <Text style={[s.secTitle, { color: t.muted }]}>{upper(sec.title)}</Text>
              {sec.items.map((it) => {
                const active = it.key === current;
                const b = it.badge ? badgeStyle(it.badge) : null;
                return (
                  <Pressable
                    key={it.key}
                    onPress={() => onSelect(it.key)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [s.menuItem, {
                      backgroundColor: active ? t.accentSoft : pressed ? t.raised : 'transparent',
                      borderColor: active ? t.goldLine : 'transparent',
                    }]}
                  >
                    {active ? <View style={[s.menuBar, { backgroundColor: t.gold }]} /> : null}
                    <Ionicons name={it.icon} size={20} color={active ? t.gold : t.muted} />
                    <Text style={{ flex: 1, color: active ? t.gold : t.fg, fontSize: 16, fontWeight: active ? '600' : '400' }}>{it.label}</Text>
                    {b && it.badge ? (
                      <View style={[s.badge, { backgroundColor: b.bg, borderColor: b.border }]}>
                        <Text style={{ color: b.fg, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{it.badge.text}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {pins.length ? (
            <View>
              <Text style={[s.secTitle, { color: t.muted }]}>{upper(tr('menu.topCategories'))}</Text>
              {pins.map((p) => (
                <Pressable key={p.cat} onPress={() => onPin(p.cat)} style={({ pressed }) => [s.pin, { backgroundColor: pressed ? t.raised : 'transparent' }]}
                  accessibilityLabel={tr('menu.pinLabel', { cat: catName(p.cat), amount: p.amount })}>
                  <CatIcon cat={p.cat} t={t} size={26} />
                  <Text style={{ flex: 1, fontSize: 15, color: t.fg }}>{catName(p.cat)}</Text>
                  <Text style={{ fontSize: 14, color: t.muted, fontVariant: ['tabular-nums'] }}>{p.amount}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexGrow: 1, minHeight: 14 }} />
          {/* Bütçe kartı */}
          <Pressable onPress={onBudget} style={({ pressed }) => [s.budget, { backgroundColor: t.raised, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}
            accessibilityLabel={budget ? `${budget.label}: ${budget.amount} / ${budget.total}` : tr('menu.setBudget')}>
            {budget ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={[s.secLabel, { color: t.muted }]}>{upper(budget.label)}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: budget.over ? t.warn : t.gold }}>{fmtPercent(budget.pct)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Amount text={budget.amount} style={{ fontFamily: FONTS.display, fontSize: 24, color: t.fg }} symbolColor={t.gold} />
                  <Text style={{ fontSize: 14, color: t.muted }}>/ {budget.total}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: t.heroTrack, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, budget.pct)}%`, height: 4, borderRadius: 2, backgroundColor: budget.over ? t.warn : t.gold }} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="wallet-outline" size={20} color={t.gold} />
                <Text style={{ flex: 1, fontSize: 15, color: t.fg }}>{tr('menu.setBudget')}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.muted} />
              </View>
            )}
          </Pressable>
        </ScrollView>

        {/* Profil */}
        <View style={s.profile}>
          <View style={[s.avatar, { backgroundColor: t.line, borderColor: t.goldLine }]}>
            <Text style={{ color: t.gold, fontSize: 14, fontWeight: '600' }}>{profile.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.fg }} numberOfLines={1}>{profile.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.good }} />
              <Text style={{ fontSize: 12, color: t.muted, flexShrink: 1 }} numberOfLines={1}>{status}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('menu.close')} style={[s.close, { borderColor: t.line }]}>
            <Ionicons name="close" size={18} color={t.muted} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/** Basit dikey çubuk grafik (6 aylık toplamlar, haftanın günleri). */
export function Bars({ data, selected, onSelect, t, height = 150 }: {
  data: { key: string; label: string; value: number }[]; selected?: string; onSelect?: (key: string) => void; t: Theme; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barMax = height - 46;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d) => {
        const on = d.key === selected;
        return (
          <Pressable key={d.key} disabled={!onSelect} onPress={() => onSelect?.(d.key)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}
            accessibilityLabel={`${d.label}: ${compact(d.value)}`}>
            <Text style={{ fontSize: 11, color: on ? t.fg : t.muted, fontWeight: on ? '700' : '400' }}>{d.value ? compact(d.value) : ''}</Text>
            <View style={{ width: '100%', maxWidth: 34, height: d.value ? Math.max(4, (d.value / max) * barMax) : 3, borderRadius: 7, backgroundColor: on ? t.accent : t.bar }} />
            <Text style={{ fontSize: 12, color: on ? t.fg : t.muted, fontWeight: on ? '700' : '400' }}>{d.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CAT_ICONS: IconName[] = ['bag-handle-outline', 'restaurant-outline', 'car-outline', 'receipt-outline', 'medkit-outline', 'film-outline', 'shirt-outline', 'ellipsis-horizontal'];

/** Kategori simgesi: kategorinin renginde yumuşak bir daire içinde. */
export function CatIcon({ cat, t, size = 36 }: { cat: string; t: Theme; size?: number }) {
  const color = t.cats[catIndex(cat)];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color + '66', backgroundColor: color + '14', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={CAT_ICONS[catIndex(cat)]} size={size * 0.46} color={color} />
    </View>
  );
}

/** Abonelik türü simgesi (kategori simgesiyle aynı görünüm). */
export function SubTypeIcon({ type, t, size = 36 }: { type: string | undefined; t: Theme; size?: number }) {
  const color = t.cats[subTypeIndex(type) % t.cats.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: color + '66', backgroundColor: color + '14', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={subType(type).icon as IconName} size={size * 0.46} color={color} />
    </View>
  );
}
export const subTypeColor = (type: string | undefined, t: Theme) => t.cats[subTypeIndex(type) % t.cats.length];

/** Otomatik yorumlar listesi. */
export function InsightList({ list, t }: { list: Insight[]; t: Theme }) {
  return (
    <View style={{ gap: 10 }}>
      {list.map((x, i) => {
        const color = x.kind === 'warn' ? t.warn : x.kind === 'good' ? t.good : t.accent;
        const bg = x.kind === 'warn' ? t.warnSoft : x.kind === 'good' ? t.goodSoft : t.accentSoft;
        const icon: IconName = x.kind === 'warn' ? 'alert-circle' : x.kind === 'good' ? 'checkmark-circle' : 'sparkles';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={16} color={color} />
            </View>
            <Text style={{ flex: 1, color: t.fg, fontSize: 15, lineHeight: 21, paddingTop: 3 }}>{x.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** İnce ilerleme çubuğu (kategori limitleri). */
export function Progress({ value, max, t }: { value: number; max: number; t: Theme }) {
  const over = value > max;
  const near = !over && value >= max * 0.8;
  return (
    <View style={{ height: 6, borderRadius: 99, backgroundColor: t.bg, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', borderRadius: 99, backgroundColor: over || near ? t.warn : t.accent }} />
    </View>
  );
}

const s = StyleSheet.create({
  menu: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: 1, paddingHorizontal: 14, gap: 8, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1 },
  monogram: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: 11, letterSpacing: 1.6, fontWeight: '600', paddingTop: 14, paddingBottom: 4, paddingHorizontal: 12 },
  secLabel: { fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, height: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 2 },
  menuBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 14, borderRadius: 12 },
  budget: { padding: 12, borderRadius: 18, borderWidth: 1, gap: 8 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 6, paddingTop: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  pill: { alignSelf: 'flex-start', borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1 },
  label: { fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
});
