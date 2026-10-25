import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t as tr } from './i18n';
import { addMonths, iso, monthLabel, monthName, parseIso, todayIso, weekdayName, weekdayShortName } from './lib';
import { Theme } from './theme';

/**
 * Hafif ay takvimi: ay ‹ › ile gezilir, hafta Pazartesi'den başlar, bugün çerçeveli, seçili gün dolu gösterilir.
 * Gelecek günler seçilemez (kayıtlar ileri tarihli olamaz). Sayfaya gömülü çalışır; "Bugün" kısayolu bugünü seçip takvimi bu aya getirir.
 */
export function DatePicker({ value, onChange, t }: { value: string; onChange: (d: string) => void; t: Theme }) {
  const today = todayIso();
  const [ym, setYm] = useState(value.slice(0, 7));
  const first = parseIso(ym + '-01');
  const lead = (first.getDay() + 6) % 7; // ayın ilk gününden önceki boş hücreler (Pazartesi = 0)
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(iso(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7) cells.push(null);
  const atNow = ym >= today.slice(0, 7);

  return (
    <View style={[s.box, { backgroundColor: t.bg, borderColor: t.line }]}>
      <View style={s.head}>
        <Pressable onPress={() => setYm(addMonths(ym, -1))} style={s.nav} accessibilityRole="button" accessibilityLabel={tr('month.prev')}>
          <Text style={[s.navTxt, { color: t.fg }]}>‹</Text>
        </Pressable>
        <Text style={{ color: t.fg, fontSize: 16, fontWeight: '600' }} accessibilityRole="header">{monthLabel(ym)}</Text>
        <Pressable onPress={() => !atNow && setYm(addMonths(ym, 1))} disabled={atNow} style={[s.nav, { opacity: atNow ? 0.3 : 1 }]}
          accessibilityRole="button" accessibilityLabel={tr('month.next')} accessibilityState={{ disabled: atNow }}>
          <Text style={[s.navTxt, { color: t.fg }]}>›</Text>
        </Pressable>
      </View>
      <View style={s.week}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Text key={i} style={[s.cell, { color: t.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' }]} numberOfLines={1}>{weekdayShortName((i + 1) % 7)}</Text>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={i} style={s.cell} />;
          const future = c > today, selected = c === value, isToday = c === today;
          return (
            <View key={i} style={s.cell}>
              <Pressable
                onPress={() => onChange(c)}
                disabled={future}
                accessibilityRole="button"
                accessibilityLabel={isToday ? `${tr('date.today')}, ${dayLabelLong(c)}` : dayLabelLong(c)}
                accessibilityState={{ selected, disabled: future }}
                style={[s.day, { backgroundColor: selected ? t.gold : 'transparent', borderColor: isToday && !selected ? t.gold : 'transparent', opacity: future ? 0.3 : 1 }]}
              >
                <Text style={{ color: selected ? t.accentFg : t.fg, fontSize: 15, fontWeight: selected || isToday ? '700' : '400', fontVariant: ['tabular-nums'] }}>{parseIso(c).getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Pressable onPress={() => { onChange(today); setYm(today.slice(0, 7)); }} style={s.todayBtn} accessibilityRole="button" accessibilityLabel={tr('date.today')}>
        <Text style={{ color: t.gold, fontSize: 15, fontWeight: '600' }}>{tr('date.today')}</Text>
      </Pressable>
    </View>
  );
}

/** Ekran okuyucu için tam gün adı: "Bugün/Dün" yerine her zaman tarih ve hafta günü ("24 Ekim, Cumartesi"). */
function dayLabelLong(s: string) {
  const d = parseIso(s);
  return tr('fmt.dayLong', { day: d.getDate(), month: monthName(d.getMonth()), weekday: weekdayName(d.getDay()) });
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTxt: { fontSize: 24, lineHeight: 28 },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', height: 40 },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
});
