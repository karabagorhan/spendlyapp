import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { MASK, amountsHidden } from './currency';
import { fmtPercent, t as tr } from './i18n';
import { contrast, mix, rgba } from './palette';
import { RADIUS, cardBase, cardShadow, selectedFill, selectedLine, trackOf } from './design';
import { Analysis, Insight, catIndex, catName, compact, pad, subType, subTypeIndex } from './lib';
import { FONTS, Theme } from './theme';

export function Chip({ label, active, color, icon, onPress, t, disabled }: { label: string; active: boolean; color?: string; icon?: IconName; onPress: () => void; t: Theme; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      aria-selected={active}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: active ? selectedFill(t) : t.bg, borderColor: active ? selectedLine(t) : t.line, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={color ?? t.fg} /> : color ? <View style={[s.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={{ color: t.fg, fontSize: 15, fontFamily: active ? FONTS.semi : undefined }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Renk kartelası: yuvarlak renk örneği; seçiliyken dış halka ve onay işareti. `inner` verilirse iç daire (zemin tonlarında yüzey rengi).
 */
export function Swatch({ fill, inner, line, selected, label, onPress, t }: {
  fill: string; inner?: string; line: string; selected: boolean; label: string; onPress: () => void; t: Theme;
}) {
  const mark = contrast(inner ?? fill, '#ffffff') > contrast(inner ?? fill, '#0b0b0d') ? '#ffffff' : '#0b0b0d';
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-selected={selected}
      style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected ? t.fg : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: fill, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' }}>
        {inner ? <View style={{ position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: inner, borderWidth: StyleSheet.hairlineWidth, borderColor: line }} /> : null}
        {selected ? <Ionicons name="checkmark" size={inner ? 14 : 20} color={mark} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Hazır tema kartı: iki renkli örnek (birincil + ikincil) ve ad; seçiliyken vurgu rengiyle çerçevelenir.
 * Dokunmak vurgu + zemin tonunu birlikte ayarlar, açık/koyu moda dokunmaz.
 */
export function PresetCard({ colors, name, label, selected, onPress, t }: {
  colors: [string, string]; name: string; label: string; selected: boolean; onPress: () => void; t: Theme;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-selected={selected}
      style={({ pressed }) => ({ flex: 1, minHeight: 76, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? t.accent : t.line, backgroundColor: selected ? selectedFill(t) : t.bg, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors[0], borderWidth: 1, borderColor: t.line }} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors[1], borderWidth: 1, borderColor: t.line, marginLeft: -8 }} />
      </View>
      <Text numberOfLines={1} style={{ color: t.fg, fontSize: 13, fontFamily: selected ? FONTS.semi : undefined, fontWeight: selected ? undefined : '500' }}>{name}</Text>
    </Pressable>
  );
}

export function Pill({ kind, label, t }: { kind: 'up' | 'down' | 'flat'; label: string; t: Theme }) {
  return <SoftPill tone={kind === 'up' ? 'warn' : kind === 'down' ? 'good' : 'muted'} label={label} t={t} />;
}

export type Tone = 'warn' | 'good' | 'neutral' | 'muted' | 'accent';

/**
 * Yumuşak zeminli durum hapı (DESIGN-2 §9): renkli metin, aynı rengin yumuşak zemini, isteğe bağlı küçük simge.
 * Abonelik durumu, limit aşımı, değişim oranı gibi kısa etiketler için. Metin kesilmez; dar yerde alt satıra geçer.
 */
export function SoftPill({ tone, label, icon, t, testID }: { tone: Tone; label: string; icon?: IconName; t: Theme; testID?: string }) {
  const fg = tone === 'warn' ? t.warn : tone === 'good' ? t.good : tone === 'accent' ? t.accent : tone === 'neutral' ? t.fg : t.muted;
  const bg = tone === 'warn' ? t.warnSoft : tone === 'good' ? t.goodSoft : tone === 'accent' ? t.accentSoft : trackOf(t);
  return (
    <View style={[s.pill, { backgroundColor: bg }]} testID={testID}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, lineHeight: 16, fontFamily: FONTS.semi, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

/**
 * Küçük hap düğme: birincil (vurgu dolgu) ya da hayalet (ince çizgi). Satır içi eylemler ve boş durum çağrıları için;
 * `md` boyutu 44 yüksekliğinde (dokunma hedefi), `sm` 36 (satır içi, `hitSlop` ile genişletilir).
 */
export function PillButton({ label, icon, onPress, kind = 'primary', size = 'sm', t, testID, a11y }: {
  label: string; icon?: IconName; onPress: () => void; kind?: 'primary' | 'ghost'; size?: 'sm' | 'md'; t: Theme; testID?: string; a11y?: string;
}) {
  const primary = kind === 'primary';
  const fg = primary ? t.accentFg : t.fg;
  const md = size === 'md';
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={md ? undefined : 4}
      style={({ pressed }) => [s.pbtn, md && s.pbtnMd, primary ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: 'transparent', borderColor: t.goldLine }, { opacity: pressed ? 0.8 : 1 }]}>
      {icon ? <Ionicons name={icon} size={md ? 18 : 14} color={primary ? t.accentFg : t.accent} /> : null}
      <Text style={{ color: fg, fontSize: md ? 15 : 13, lineHeight: md ? 20 : 17, fontFamily: FONTS.semi }}>{label}</Text>
    </Pressable>
  );
}

/** Bölmeli seçici (Harcamalar | Gelirler): 12 köşeli nötr iz, seçili bölüm bir yüzey basamağı yukarıda (vurgu dolgusu yok), birincil metin. */
export function Segmented<K extends string>({ items, value, onChange, t }: {
  items: { key: K; label: string; testID?: string }[]; value: K; onChange: (k: K) => void; t: Theme;
}) {
  return (
    <View style={[s.seg, { backgroundColor: trackOf(t), borderColor: t.line }]} accessibilityRole="tablist">
      {items.map((x) => {
        const on = x.key === value;
        return (
          <Pressable key={x.key} testID={x.testID} onPress={() => onChange(x.key)} accessibilityRole="tab" aria-selected={on} accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.segBtn, on && { backgroundColor: selectedFill(t), borderColor: t.line, borderWidth: 1 }, !on && pressed && { backgroundColor: t.raised }]}>
            <Text style={{ color: on ? t.fg : t.muted, fontSize: 14, lineHeight: 18, fontFamily: on ? FONTS.semi : FONTS.semi }} numberOfLines={1}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Boş durum çizimi (DESIGN-2 geometrik motif): 2×2 ızgarada vurgu renginde çeyrek daire, ikincil renkte yarım daire,
 * nötr çeyrek daire; sağ alttaki yuvarlak rozetin içinde durumu anlatan simge.
 */
export function EmptyArt({ t, icon, size = 112 }: { t: Theme; icon: IconName; size?: number }) {
  const S = size / 2, W = size;
  const light = t.name === 'ivory';
  const neutral = mix(t.fg, t.surface, light ? 0.86 : 0.78);
  const badge = Math.round(S * 0.92);
  return (
    <View style={{ width: W, height: W }} accessible={false}>
      <Svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
        <Path d={`M0 ${S} A${S / 2} ${S / 2} 0 0 1 ${S} ${S} Z`} fill={t.heroAlt} opacity={light ? 0.9 : 0.75} />
        <Path d={`M${S} ${S} V0 A${S} ${S} 0 0 1 ${W} ${S} Z`} fill={t.accent} opacity={light ? 0.95 : 0.85} />
        <Path d={`M${S} ${S} H0 A${S} ${S} 0 0 0 ${S} ${W} Z`} fill={neutral} />
      </Svg>
      <View style={{ position: 'absolute', right: (S - badge) / 2, bottom: (S - badge) / 2, width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={Math.round(badge * 0.46)} color={t.accent} />
      </View>
    </View>
  );
}

/** Boş durum kartı: çizim + başlık + açıklama + isteğe bağlı hap düğme. */
export function EmptyState({ t, icon, title, hint, action, actionIcon = 'add', onAction, testID }: {
  t: Theme; icon: IconName; title: string; hint: string; action?: string; actionIcon?: IconName; onAction?: () => void; testID?: string;
}) {
  return (
    <View style={[cardBase(t), s.empty]} testID={testID}>
      <EmptyArt t={t} icon={icon} />
      <View style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: t.fg, fontSize: 19, lineHeight: 25, fontFamily: FONTS.bold, textAlign: 'center' }} accessibilityRole="header">{title}</Text>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 }}>{hint}</Text>
      </View>
      {action && onAction ? <View style={{ marginTop: 12 }}><PillButton label={action} icon={actionIcon} onPress={onAction} size="md" t={t} /></View> : null}
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
      <Text style={{ color: fg, fontFamily: FONTS.semi, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Alan/bölüm etiketi: cümle düzeni (büyük harf ve harf aralığı yok), 13/500, soluk renk. */
export function Label({ children, t, color }: { children: string; t: Theme; color?: string }) {
  return <Text style={[s.label, { color: color ?? t.muted }]}>{children}</Text>;
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
  const slot = iw / n, bw = Math.max(2, slot * 0.62);
  const todayD = a.isCur ? new Date().getDate() : 0;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <>
          <Svg width={w} height={H}>
            {[0, 0.5, 1].map((f) => (
              <Line key={f} x1={L} x2={w - R} y1={y(max * f)} y2={y(max * f)} stroke={t.line} strokeWidth={1} strokeDasharray={f ? '2 4' : undefined} />
            ))}
            {[0, 0.5, 1].map((f) => (
              <SvgText key={'l' + f} x={L - 6} y={y(max * f) + 3} fontSize={10} fill={t.muted} textAnchor="end">
                {axisText(max * f)}
              </SvgText>
            ))}
            {vals.map((v, i) => {
              if (!v) return null;
              const d = i + 1;
              const h = Math.max(2, (v / max) * ih);
              const day = `${ym}-${pad(d)}`;
              const fill = selected === day ? t.accent : budgetDay && v > budgetDay ? t.warn : d === todayD ? rgba(t.accent, 0.62) : t.bar;
              return <Rect key={d} x={L + i * slot + (slot - bw) / 2} y={T + ih - h} width={bw} height={h} rx={Math.min(bw / 2, 4)} fill={fill} />;
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


/** Uzun tutar tek satırda kalsın diye yazı boyutunu metin uzunluğuna göre küçültür (web'de `adjustsFontSizeToFit` çalışmaz). `max`: bu uzunluğa kadar tam boyut. */
export const fitFont = (text: string, base: number, max: number) => (text.length <= max ? base : Math.max(base * 0.55, (base * max) / text.length));

/**
 * Genişliğe göre yazı boyutu: tutar metninin `base` boyutundaki yaklaşık genişliği (rakam ~0,64 em, ayraç ~0,3 em, küçük para simgesi ~0,42 em)
 * `width`'i aşarsa boyut orantılı küçültülür. `track`: harf başına harf aralığı (px). Web'de `adjustsFontSizeToFit` olmadığı için.
 */
export function fitWidth(text: string, base: number, width: number, track = 0) {
  if (!(width > 0)) return base;
  let em = 0;
  for (const ch of text) em += /\d/.test(ch) ? 0.64 : /[.,'   ]/.test(ch) ? 0.3 : /[₺$€£¥]/.test(ch) ? 0.42 : ch === '•' ? 0.5 : 0.62;
  const w = base * em + track * text.length;
  return w <= width ? base : Math.max(base * 0.5, Math.floor(((width - track * text.length) / em) * 10) / 10);
}

/** Grafik ekseni/çubuk üstü kısa tutar: gizlilik kipinde sayı çizilmez (çubuklar kalır). */
const axisText = (n: number) => (amountsHidden() ? '' : compact(n));

/**
 * Tutar metni: rakamlar başlık yazı tipinde (sabit genişlikli), para simgesi (₺ $ € £ ¥; yazı tipinde ₺ bulunmadığı için) sistem yazı tipinde
 * ve daha küçük yazılır. Simge sayının önünde (₺1.250) ya da sonunda (1250 €) olabilir.
 */
export function Amount({ text, style, symbolColor, fit, testID }: { text: string; style: StyleProp<TextStyle>; symbolColor?: string; fit?: boolean; testID?: string }) {
  const flat = StyleSheet.flatten(style) || {};
  const size = (flat.fontSize ?? 16) * 0.6;
  const parts = text.split(/([₺$€£¥])/);
  return (
    <Text testID={testID} style={[style, { fontVariant: ['lining-nums', 'tabular-nums'] }]} {...(text.includes(MASK) ? { accessibilityLabel: tr('amount.hidden') } : {})} {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : {})}>
      {parts.map((p, i) =>
        SYMBOL_SET.includes(p) ? (
          <Text key={i} style={{ fontFamily: 'System', fontSize: size, fontWeight: '600', color: symbolColor ?? flat.color, letterSpacing: 0, marginHorizontal: 1 }}>{p}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}
const SYMBOL_SET = ['₺', '$', '€', '£', '¥'];

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
  // Sola kaydırarak kapatma: parmakla birlikte kayar; yeterince uzun ya da yatay baskın ve hızlıysa kapanır, değilse geri yaylanır.
  // PanResponder'ın dx/dy/vx değerleri (özellikle webde) önceki hareketlerden kalıntı taşıyabilir; bu yüzden dokunuş koordinatlarını kendimiz izleriz.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const track = useRef({ x0: 0, y0: 0, x: 0, y: 0, px: 0, pt: 0, t: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        const { pageX, pageY } = e.nativeEvent, now = Date.now();
        track.current = { x0: pageX, y0: pageY, x: pageX, y: pageY, px: pageX, pt: now, t: now };
        return false;
      },
      onMoveShouldSetPanResponderCapture: (e) => {
        const dx = e.nativeEvent.pageX - track.current.x0, dy = e.nativeEvent.pageY - track.current.y0;
        return dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderMove: (e) => {
        const c = track.current, now = Date.now();
        if (now - c.t > 0) { c.px = c.x; c.pt = c.t; }
        c.x = e.nativeEvent.pageX; c.y = e.nativeEvent.pageY; c.t = now;
        x.setValue(Math.min(1, Math.max(0, -(c.x - c.x0) / (MENU_W + 24))));
      },
      onPanResponderRelease: () => {
        const c = track.current, dx = c.x - c.x0, dy = c.y - c.y0;
        const vx = (c.x - c.px) / Math.max(1, c.t - c.pt);
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
        if (horizontal && (dx < -70 || (dx < -24 && vx < -0.6))) closeRef.current();
        else Animated.timing(x, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.timing(x, { toValue: 0, duration: 160, useNativeDriver: true }).start(),
    }),
  ).current;
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
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: x.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={tr('menu.close')} />
      </Animated.View>
      <Animated.View
        accessibilityRole="menu"
        style={[s.menu, { width: MENU_W, backgroundColor: t.surface, borderColor: t.goldLine, paddingTop: top + 16, paddingBottom: bottom + 16,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -(MENU_W + 24)] }) }] }]}
      >
        {/* Hesap kartı */}
        <Pressable onPress={() => onSelect('ozet')} style={({ pressed }) => [s.account, { backgroundColor: t.raised, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[s.monogram, { backgroundColor: t.accent }]}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: t.accentFg }}>{tr('app.monogram')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, lineHeight: 24, color: t.fg }} numberOfLines={1}>{header.title}</Text>
            <Text style={{ fontSize: 12.5, lineHeight: 17, color: t.muted }} numberOfLines={2}>{header.sub}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={t.muted} />
        </Pressable>

        {/* Kısa ekranlarda bütçe kartı dahil her şey kayar; uzun ekranlarda kart en alta yaslanır */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {sections.map((sec) => (
            <View key={sec.title}>
              <Text style={[s.secTitle, { color: t.muted }]}>{sec.title}</Text>
              {sec.items.map((it) => {
                const active = it.key === current;
                const b = it.badge ? badgeStyle(it.badge) : null;
                return (
                  <Pressable
                    key={it.key}
                    onPress={() => onSelect(it.key)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [s.menuItem, { backgroundColor: active ? t.accentSoft : pressed ? t.raised : 'transparent' }]}
                  >
                    <View style={[s.menuIcon, { backgroundColor: active ? t.accent : trackOf(t) }]}>
                      <Ionicons name={it.icon} size={18} color={active ? t.accentFg : t.fg} />
                    </View>
                    <Text style={{ flex: 1, color: active ? t.accent : t.fg, fontSize: 15, lineHeight: 20, fontFamily: active ? FONTS.bold : FONTS.semi }} numberOfLines={1}>{it.label}</Text>
                    {b && it.badge ? (
                      <View style={[s.badge, { backgroundColor: b.bg, borderColor: b.border }]}>
                        <Text style={{ color: b.fg, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{it.badge.text}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {pins.length ? (
            <View>
              <Text style={[s.secTitle, { color: t.muted }]}>{tr('menu.topCategories')}</Text>
              {pins.map((p) => (
                <Pressable key={p.cat} onPress={() => onPin(p.cat)} style={({ pressed }) => [s.pin, { backgroundColor: pressed ? t.raised : 'transparent' }]}
                  accessibilityLabel={tr('menu.pinLabel', { cat: catName(p.cat), amount: p.amount })}>
                  <CatIcon cat={p.cat} t={t} size={32} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: t.fg }} numberOfLines={1}>{catName(p.cat)}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: t.muted, fontVariant: ['tabular-nums'] }}>{p.amount}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexGrow: 1, minHeight: 16 }} />
          {/* Bütçe kartı */}
          <Pressable onPress={onBudget} style={({ pressed }) => [s.budget, { backgroundColor: t.raised, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}
            accessibilityLabel={budget ? `${budget.label}: ${budget.amount} / ${budget.total}` : tr('menu.setBudget')}>
            {budget ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={[s.secLabel, { color: t.muted, flexShrink: 1 }]} numberOfLines={1}>{budget.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: budget.over ? t.warn : t.accent, fontVariant: ['tabular-nums'] }}>{fmtPercent(budget.pct)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <Amount text={budget.amount} style={{ fontFamily: FONTS.display, fontSize: 22, color: t.fg }} symbolColor={t.accent} />
                  <Text style={{ fontSize: 13, color: t.muted, fontVariant: ['tabular-nums'] }}>/ {budget.total}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: trackOf(t), overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, budget.pct)}%`, height: 8, borderRadius: 4, backgroundColor: budget.over ? t.warn : t.accent }} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBox icon="wallet-outline" color={t.muted} t={t} size={32} />
                <Text style={{ flex: 1, fontSize: 14, fontFamily: FONTS.semi, color: t.fg }}>{tr('menu.setBudget')}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.muted} />
              </View>
            )}
          </Pressable>
        </ScrollView>

        {/* Profil */}
        <View style={s.profile}>
          <View style={[s.avatar, { backgroundColor: t.accentSoft }]}>
            <Text style={{ color: t.accent, fontSize: 14, fontFamily: FONTS.display }}>{profile.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: FONTS.bold, color: t.fg }} numberOfLines={1}>{profile.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.good }} />
              <Text style={{ fontSize: 12, color: t.muted, flexShrink: 1 }} numberOfLines={2}>{status}</Text>
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

/**
 * Dikey çubuk grafik (6 aylık toplamlar, haftanın günleri): 8 köşeli yuvarlak çubuklar; seçili çubuk vurgu renginde ve
 * üstünde değer baloncuğu (gizlilik kipinde değer yazılmaz), diğerleri soluk vurgu tonunda, değeri olmayan gün/ay nötr iz.
 */
export function Bars({ data, selected, onSelect, t, height = 150 }: {
  data: { key: string; label: string; value: number }[]; selected?: string; onSelect?: (key: string) => void; t: Theme; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barMax = height - 50; // üstte değer baloncuğu, altta ad
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d) => {
        const on = d.key === selected;
        const tip = on && d.value ? axisText(d.value) : '';
        return (
          <Pressable key={d.key} disabled={!onSelect} onPress={() => onSelect?.(d.key)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 8 }}
            accessibilityLabel={amountsHidden() ? `${d.label}: ${tr('amount.hidden')}` : `${d.label}: ${compact(d.value)}`}>
            {tip ? (
              // Baloncuk çubuk yuvasından geniş olabilir: sabit genişlikte ortalanmış kutu, metin tek satırda kalır
              <View style={{ width: 72, alignItems: 'center' }}>
                <View style={[s.barTip, { backgroundColor: t.fg }]}>
                  <Text style={{ color: t.bg, fontSize: 11, lineHeight: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{tip}</Text>
                </View>
              </View>
            ) : null}
            <View style={{ width: '100%', maxWidth: 36, height: d.value ? Math.max(8, (d.value / max) * barMax) : 6, borderRadius: 8, backgroundColor: on ? t.accent : d.value ? t.bar : trackOf(t) }} />
            <Text style={{ fontSize: 12, lineHeight: 16, color: on ? t.fg : t.muted, fontWeight: on ? '600' : '500' }}>{d.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CAT_ICONS: IconName[] = ['bag-handle-outline', 'restaurant-outline', 'car-outline', 'receipt-outline', 'medkit-outline', 'film-outline', 'shirt-outline', 'ellipsis-horizontal'];

/** Simge kutusu: nötr (yazı renginin soluk tonu) yuvarlatılmış kare, simge tam renkte (kategori, gelir ve abonelik türü simgeleri). `rotate`: ok simgeleri 45° döner (gelir/gider). */
export function IconBox({ icon, color, t, size = 36, rotate }: { icon: IconName; color: string; t: Theme; size?: number; rotate?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: trackOf(t), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} style={rotate ? { transform: [{ rotate: '45deg' }] } : undefined} />
    </View>
  );
}

/** Kategori simgesi: kategorinin renginde yumuşak kutu içinde. */
export function CatIcon({ cat, t, size = 36 }: { cat: string; t: Theme; size?: number }) {
  return <IconBox icon={CAT_ICONS[catIndex(cat)]} color={t.cats[catIndex(cat)]} t={t} size={size} />;
}

/** Abonelik türü simgesi (kategori simgesiyle aynı görünüm). */
export function SubTypeIcon({ type, t, size = 36 }: { type: string | undefined; t: Theme; size?: number }) {
  return <IconBox icon={subType(type).icon as IconName} color={t.cats[subTypeIndex(type) % t.cats.length]} t={t} size={size} />;
}

const INCOME_ICON: Record<string, IconName> = { salary: 'cash-outline', freelance: 'laptop-outline', investment: 'trending-up-outline', gift: 'gift-outline', other: 'ellipsis-horizontal-circle-outline' };
export const incomeIcon = (c: string): IconName => INCOME_ICON[c] ?? 'cash-outline';

/** Gelir kategorisi simgesi: gelir renginde. */
export function IncomeIcon({ cat, t, size = 36 }: { cat: string; t: Theme; size?: number }) {
  return <IconBox icon={incomeIcon(cat)} color={t.good} t={t} size={size} />;
}

/**
 * Ortak işlem satırı (DESIGN-2 §6): 44'lük simge kutusu, başlık 15/600, alt yazı 13, sağda tutar 15/700 sabit genişlikli rakamlarla.
 * Gelir `good` renginde "+", gider yazı renginde "−" ile; başka para biriminde girilmiş kayıtta özgün tutar tutarın altında.
 * `amount` biçimlenmiş (gerekirse maskelenmiş) tutardır; erişilebilirlik etiketi çağıran tarafından verilir. Alt yazı boşsa çizilmez.
 */
export function TxnRow({ t, kind, cat, title, subtitle, amount, orig, onPress, first, testID, a11y }: {
  t: Theme; kind: 'expense' | 'income'; cat: string; title: string; subtitle: string; amount: string; orig?: string;
  onPress?: () => void; first?: boolean; testID?: string; a11y?: string;
}) {
  const income = kind === 'income';
  return (
    <Pressable onPress={onPress} disabled={!onPress} testID={testID} accessibilityRole="button" accessibilityLabel={a11y}
      style={({ pressed }) => [s.txn, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }, pressed && { opacity: 0.75 }]}>
      {income ? <IncomeIcon cat={cat} t={t} size={44} /> : <CatIcon cat={cat} t={t} size={44} />}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: t.fg, fontSize: 15, fontFamily: FONTS.semi }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 0, maxWidth: '50%' }}>
        <Amount text={`${income ? '+' : '−'}${amount}`} style={{ color: income ? t.good : t.fg, fontSize: 15, fontFamily: FONTS.semi }} />
        {orig ? <Text style={{ color: t.muted, fontSize: 12, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{orig}</Text> : null}
      </View>
    </Pressable>
  );
}

export type Ring = { key: string; share: number; color: string };

/**
 * Eşmerkezli yaylar (DESIGN-2 §5, §8): her halka bir kategori; ince çizgi renginde iz, üstünde payı (0–1) kadar uzunlukta
 * yuvarlak uçlu yay. Dıştan içe sırayla çizilir; ortaya `children` (ör. toplam) yerleşir. Panel ve Raporlar ortak kullanır.
 */
export function RingsChart({ rings, size, stroke = 8, gap = 4, track, children, a11y }: {
  rings: Ring[]; size: number; stroke?: number; gap?: number; track: string; children?: ReactNode; a11y?: string;
}) {
  const c = size / 2;
  const inner = c - stroke / 2 - (rings.length - 1) * (stroke + gap) - stroke / 2; // en içteki halkanın iç yarıçapı
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={a11y} role="img">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          {rings.map((rg, i) => {
            const r = c - stroke / 2 - i * (stroke + gap);
            const C = 2 * Math.PI * r;
            // Yuvarlak uçlar yayı iki yandan yarım kalınlık uzatır: oran dürüst kalsın diye uzunluktan düşülür
            const full = rg.share >= 0.999;
            const len = full ? C : Math.max(0.01, rg.share * C - stroke);
            return (
              <G key={rg.key}>
                <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={stroke} fill="none" />
                {rg.share > 0 ? <Circle cx={c} cy={c} r={r} stroke={rg.color} strokeWidth={stroke} fill="none" strokeLinecap={full ? 'butt' : 'round'} strokeDasharray={`${len} ${C}`} /> : null}
              </G>
            );
          })}
        </G>
      </Svg>
      {children ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: c - inner, top: c - inner, width: inner * 2, height: inner * 2, alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export const subTypeColor = (type: string | undefined, t: Theme) => t.cats[subTypeIndex(type) % t.cats.length];

/** Otomatik yorumlar listesi: nötr simge (ikincil renk) + metin; durum yalnızca küçük renkli noktayla (uyarı / iyi) anlatılır. */
export function InsightList({ list, t }: { list: Insight[]; t: Theme }) {
  return (
    <View style={{ gap: 12 }}>
      {list.map((x, i) => {
        const dot = x.kind === 'warn' ? t.warn : x.kind === 'good' ? t.good : null;
        const icon: IconName = x.kind === 'warn' ? 'alert-circle-outline' : x.kind === 'good' ? 'checkmark-circle-outline' : 'sparkles-outline';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={20} color={t.muted} />
              {dot ? <View style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: dot, borderWidth: 1, borderColor: t.surface }} /> : null}
            </View>
            <Text style={{ flex: 1, color: t.fg, fontSize: 14, lineHeight: 20 }}>{x.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Çubuk: varsayılan renk %80'e kadar vurgu, sonrası uyarı rengi; `color` verilirse onu kullanır (ör. üç kademeli bütçe çubuğu). */
export function Progress({ value, max, t, color, height = 6 }: { value: number; max: number; t: Theme; color?: string; height?: number }) {
  const over = value > max;
  const near = !over && value >= max * 0.8;
  return (
    <View style={{ height, borderRadius: 99, backgroundColor: trackOf(t), overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', borderRadius: 99, backgroundColor: color ?? (over || near ? t.warn : t.accent) }} />
    </View>
  );
}

const s = StyleSheet.create({
  txn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menu: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: 1, paddingHorizontal: 16, gap: 8, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADIUS.card - 4, borderWidth: 1 },
  monogram: { width: 44, height: 44, borderRadius: RADIUS.icon, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: 13, lineHeight: 16, fontFamily: FONTS.semi, paddingTop: 12, paddingBottom: 4, paddingHorizontal: 12 },
  secLabel: { fontSize: 12, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, paddingLeft: 8, paddingRight: 16, borderRadius: 12, marginBottom: 2 },
  menuIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 8, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingLeft: 8, paddingRight: 16, borderRadius: 12 },
  budget: { padding: 16, borderRadius: RADIUS.card - 4, borderWidth: 1, gap: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingTop: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 8, maxWidth: '100%' },
  pbtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12 },
  pbtnMd: { height: 44, borderRadius: 12, paddingHorizontal: 20, gap: 8 },
  seg: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 8 },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1 },
  label: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.semi },
  barTip: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
});
