import { ReactNode, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, PanResponder, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CURRENCIES, Cur, OLD_MS, Rates, convert, currencyName, fmtMoney, fmtShown, fmtStamp, money, symbolOf, toMain } from './currency';
import { LANGS, Lang, fmtNumber, fmtTime, t as tr } from './i18n';
import { CATS, Expense, INCOME_CATS, Income, MAX_AMOUNT, SUB_TYPES, Settings, Sub, addDays, amountText, catIndex, catName, dayLabel, incomeCatIndex, incomeCatName, guessSubType, monthShortName, parseAmount, subLabel, subType, todayIso, uid } from './lib';
import { ACCENTS, ACCENT_COLORS, PRESETS, TINTS, TINT_COLORS, presetOf, rgba } from './palette';
import { FONTS, Theme } from './theme';
import { incomeIcon } from './dashboard';
import { DatePicker } from './calendar';
import { Button, CatIcon, Chip, IconBox, IconName, Ionicons, Label, PresetCard, Swatch, catIconName, subTypeColor } from './ui';
import { bigAmount } from './design';

type SheetAction = { label: string; headerLabel?: string; onPress: () => void; disabled?: boolean };

/**
 * Alt sayfa: üstte Vazgeç / başlık / Kaydet hapı, klavye açılınca içerik yukarı kayar,
 * klavyenin hemen üstünde tam genişlikte bir Kaydet çubuğu durur (iOS).
 */
function Sheet({ visible, title, onClose, action, accessoryId, children, t }: {
  visible: boolean; title: string; onClose: () => void; action?: SheetAction; accessoryId?: string; children: ReactNode; t: Theme;
}) {
  // Sol kenardan sağa kaydırma = geri (sayfayı kapatır); aşağı kaydırarak kapatma iOS'in kendi hareketidir
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const touchX = useRef({ start: 0, last: 0 });
  const edge = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        touchX.current = { start: e.nativeEvent.pageX, last: e.nativeEvent.pageX };
        return false;
      },
      onMoveShouldSetPanResponderCapture: (e, g) => {
        const dx = e.nativeEvent.pageX - touchX.current.start;
        return touchX.current.start <= 24 && dx > 12 && dx > Math.abs(g.dy) * 1.5;
      },
      onPanResponderMove: (e) => { touchX.current.last = e.nativeEvent.pageX; },
      onPanResponderRelease: (_e, g) => { if (touchX.current.last - touchX.current.start > 70 || g.vx > 0.6) closeRef.current(); },
    }),
  ).current;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }} {...edge.panHandlers}>
        <View style={sh.head}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" style={sh.headSide}>
            <Text style={{ color: t.muted, fontSize: 16, fontFamily: FONTS.semi }}>{tr('common.cancel')}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[sh.headTitle, { color: t.fg }]}>{title}</Text>
          {action ? (
            <Pressable onPress={action.onPress} disabled={action.disabled} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.label}
              style={[sh.headSave, { backgroundColor: action.disabled ? t.surface : t.accent, borderColor: action.disabled ? t.line : t.accent }]}>
              <Text numberOfLines={1} style={{ color: action.disabled ? t.muted : t.accentFg, fontSize: 15, fontFamily: FONTS.bold }}>{action.headerLabel ?? action.label}</Text>
            </Pressable>
          ) : <View style={sh.headSide} />}
        </View>
        <ScrollView contentContainerStyle={sh.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {action && accessoryId && Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={[st.accessory, { backgroundColor: t.raised, borderTopColor: t.line }]}>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} accessibilityLabel={tr('sheet.hideKeyboard')}>
              <Text style={{ color: t.muted, fontSize: 15 }}>{tr('sheet.hideKeyboard')}</Text>
            </Pressable>
            <Pressable onPress={action.onPress} disabled={action.disabled} accessibilityRole="button"
              style={[st.accessorySave, { backgroundColor: t.accent, opacity: action.disabled ? 0.4 : 1 }]}>
              <Text style={{ color: t.accentFg, fontSize: 16, fontWeight: '700' }}>{action.label}</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Modal>
  );
}

function Field({ label, children, t }: { label: string; children: ReactNode; t: Theme }) {
  return (
    <View style={{ gap: 6 }}>
      <Label t={t}>{label}</Label>
      {children}
    </View>
  );
}

/** Form bileşenlerinin stilleri (Monibo 2.0: 16'lık köşe, yüzey rengi, hap düğmeler). */
const sh = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingTop: 16, minHeight: 60 },
  headSide: { minHeight: 44, minWidth: 44, justifyContent: 'center', flexShrink: 0 },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17, lineHeight: 22, fontFamily: FONTS.bold },
  headSave: { borderWidth: 1, borderRadius: 999, height: 38, paddingHorizontal: 18, justifyContent: 'center', flexShrink: 0 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillsC: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  pill: { height: 34, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  field: { height: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 16 },
  stepper: { height: 52, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  freq: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 200 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { height: 54, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
});

const fieldStyle = (t: Theme) => [sh.field, { backgroundColor: t.surface, borderColor: t.line, color: t.fg }, Platform.OS === 'web' ? ({ outlineColor: t.accent } as object) : null];

/** Küçük hap: para birimi, tarih kısayolu, sıklık, ay seçimi. */
function Pill({ label, active, onPress, t, disabled, color, icon }: { label: string; active: boolean; onPress: () => void; t: Theme; disabled?: boolean; color?: string; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} aria-selected={active}
      style={({ pressed }) => [sh.pill, { backgroundColor: active ? t.accent : t.surface, borderColor: active ? t.accent : t.line, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      {icon ? <Ionicons name={icon} size={15} color={active ? t.accentFg : color ?? t.fg} /> : null}
      <Text style={{ color: active ? t.accentFg : t.fg, fontSize: 14, fontFamily: FONTS.semi }}>{label}</Text>
    </Pressable>
  );
}

/** Sayfanın ana eylemi: 54 yüksekliğinde hap. */
function PrimaryButton({ label, onPress, disabled, t }: { label: string; onPress: () => void; disabled?: boolean; t: Theme }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [sh.btn, { flex: 1, backgroundColor: t.accent, borderColor: t.accent, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      <Text numberOfLines={1} style={{ color: t.accentFg, fontSize: 16, fontFamily: FONTS.bold }}>{label}</Text>
    </Pressable>
  );
}

/** Para birimi seçimi: kayıt hangi birimde girilecek. Kur yokken yalnızca ana birim seçilebilir. */
function CurrencyChips({ value, onChange, main, rates, t }: { value: Cur; onChange: (c: Cur) => void; main: Cur; rates: Rates | null; t: Theme }) {
  return (
    <View style={sh.pillsC}>
      {CURRENCIES.map((c) => (
        <Pill key={c.code} label={`${c.symbol} ${c.code}`} active={value === c.code} disabled={!rates && c.code !== main} onPress={() => onChange(c.code)} t={t} />
      ))}
    </View>
  );
}

/** Girilen tutarın ana para birimindeki karşılığı ("≈ ₺1.234,56 · 1 € = ₺50,12"). */
function ConvertHint({ amount, cur, main, rates, t }: { amount: number; cur: Cur; main: Cur; rates: Rates | null; t: Theme }) {
  if (cur === main) return null;
  if (!rates) return <Text style={{ color: t.warn, fontSize: 13, textAlign: 'center' }}>{tr('rates.noneHint')}</Text>;
  const rate = convert(1, cur, main, rates);
  return (
    <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>
      {amount ? `≈ ${fmtMoney(toMain(amount, cur, main, rates) ?? 0, main)} · ` : ''}{`1 ${cur} = ${fmtMoney(rate, main, 4)}`}
    </Text>
  );
}

/** Tutar alanı en çok bu kadar karakter alır (MAX_AMOUNT, binlik ayraçları ve ondalıklarla birlikte sığar). */
const AMOUNT_MAXLEN = 18;

/** Tutar çok büyükse alanın altında görünen satır içi hata. */
function AmountError({ value, t }: { value: number; t: Theme }) {
  if (value <= MAX_AMOUNT) return null;
  return <Text style={{ color: t.warn, fontSize: 13 }} testID="amount-too-large" accessibilityRole="alert">{tr('amount.tooLarge', { max: fmtNumber(MAX_AMOUNT, 0) })}</Text>;
}

function inputStyle(t: Theme, big = false) {
  return [st.input, big && st.big, { backgroundColor: t.bg, borderColor: t.line, color: t.fg }];
}

/** Ortada iri tutar girişi (44, Plus Jakarta Sans 800) + para birimi simgesi; altında hata, para birimi hapları ve kur ipucu. */
function AmountHero({ value, onChange, raw, cur, onCur, main, rates, t, label, a11y, testID, autoFocus, accessoryId }: {
  value: string; onChange: (s: string) => void; raw: number; cur: Cur; onCur: (c: Cur) => void; main: Cur; rates: Rates | null; t: Theme;
  label: string; a11y?: string; testID?: string; autoFocus?: boolean; accessoryId: string;
}) {
  const { width } = useWindowDimensions();
  const fs = value.length > 13 ? 30 : value.length > 10 ? 36 : 44;
  const symW = symbolOf(cur).length * fs * 0.7 + 6;
  const w = Math.min(width - 40 - symW - 8, Math.max(value.length, 4) * fs * 0.56 + 12);
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Label t={t}>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Text style={{ color: t.accent, fontSize: fs * 0.8, lineHeight: fs * 1.25, fontFamily: FONTS.display }} aria-hidden>{symbolOf(cur)}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={tr('common.amountPlaceholder')}
          placeholderTextColor={rgba(t.fg, 0.28)}
          autoFocus={autoFocus}
          inputAccessoryViewID={accessoryId}
          maxLength={AMOUNT_MAXLEN}
          accessibilityLabel={a11y ?? label}
          testID={testID}
          style={[{ width: w, height: fs * 1.4, fontSize: fs, color: t.fg, textAlign: 'center', padding: 0, borderWidth: 0 }, bigAmount, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
      </View>
      <AmountError value={raw} t={t} />
      <CurrencyChips value={cur} onChange={onCur} main={main} rates={rates} t={t} />
      <ConvertHint amount={raw > MAX_AMOUNT ? 0 : raw} cur={cur} main={main} rates={rates} t={t} />
    </View>
  );
}

/** Uzun tek sözcüklerde ("Supermercado", "Abbigliamento") dar kutucukta taşmasın diye ortaya görünmez tire koyar; yalnızca sığmadığında bölünür. */
const softWrap = (s: string) => s.split(' ').map((w) => (w.length >= 11 ? w.slice(0, Math.ceil(w.length / 2)) + '\u00AD' + w.slice(Math.ceil(w.length / 2)) : w)).join(' ');

type Tile = { key: string; label: string; icon: IconName; color: string };

/** 4 sütunlu ikon ızgarası: 56'lık renkli ikon kutusu + altında ad; seçili = vurgu halkası + kalın ad. */
function TileGrid({ items, value, onChange, t }: { items: Tile[]; value: string; onChange: (k: string) => void; t: Theme }) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginHorizontal: -2 }}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="button" accessibilityLabel={it.label} accessibilityState={{ selected: on }} aria-selected={on}
            style={({ pressed }) => ({ width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 1, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 64, height: 64, borderRadius: 22, borderWidth: 2, borderColor: on ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <IconBox icon={it.icon} color={it.color} t={t} size={54} />
            </View>
            <Text style={{ fontSize: narrow ? 11 : 12, lineHeight: 15, textAlign: 'center', color: on ? t.fg : t.muted, fontFamily: on ? FONTS.bold : FONTS.semi }}>{softWrap(it.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CatChips({ value, onChange, t }: { value: string; onChange: (c: string) => void; t: Theme }) {
  return <TileGrid items={CATS.map((c) => ({ key: c, label: catName(c), icon: catIconName(c), color: t.cats[catIndex(c)] }))} value={value} onChange={onChange} t={t} />;
}

/** Tarih: kısayol hapları + ‹ gün › çubuğu + açılır takvim. */
function DateField({ date, setDate, cal, setCal, t }: { date: string; setDate: (d: string) => void; cal: boolean; setCal: (v: boolean) => void; t: Theme }) {
  const isToday = date >= todayIso();
  return (
    <Field label={tr('expense.date')} t={t}>
      <View style={sh.pills}>
        <Pill label={tr('date.today')} active={date === todayIso()} onPress={() => setDate(todayIso())} t={t} />
        <Pill label={tr('date.yesterday')} active={date === addDays(todayIso(), -1)} onPress={() => setDate(addDays(todayIso(), -1))} t={t} />
        <Pill label={tr('date.twoDaysAgo')} active={date === addDays(todayIso(), -2)} onPress={() => setDate(addDays(todayIso(), -2))} t={t} />
      </View>
      <View style={[sh.stepper, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={8} style={st.stepBtn} accessibilityLabel={tr('date.prevDay')}>
          <Text style={[st.stepTxt, { color: t.fg }]}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setCal(!cal)} style={st.dateBtn} accessibilityRole="button" accessibilityLabel={`${tr('date.pick')}: ${dayLabel(date)}`} accessibilityState={{ expanded: cal }}>
          <Text style={{ color: t.fg, fontSize: 16, fontFamily: FONTS.semi }}>{dayLabel(date)}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>{cal ? '▲' : '▼'}</Text>
        </Pressable>
        <Pressable onPress={() => !isToday && setDate(addDays(date, 1))} hitSlop={8} style={[st.stepBtn, { opacity: isToday ? 0.3 : 1 }]} accessibilityLabel={tr('date.nextDay')}>
          <Text style={[st.stepTxt, { color: t.fg }]}>›</Text>
        </Pressable>
      </View>
      {cal ? <DatePicker value={date} onChange={(d) => { setDate(d); setCal(false); }} t={t} /> : null}
    </Field>
  );
}

/** Silme iki dokunuşla: yanlışlıkla silinmesin. Kırmızı çerçeveli hap; onay beklerken dolu kırmızı. */
function DeleteButton({ onDelete, t }: { onDelete: () => void; t: Theme }) {
  const [armed, setArmed] = useState(false);
  return (
    <Pressable onPress={() => (armed ? onDelete() : setArmed(true))} accessibilityRole="button"
      style={({ pressed }) => [sh.btn, { backgroundColor: armed ? t.warn : 'transparent', borderColor: t.warn, opacity: pressed ? 0.8 : 1 }]}>
      <Text numberOfLines={1} style={{ color: armed ? t.surface : t.warn, fontSize: 16, fontFamily: FONTS.bold }}>{armed ? tr('common.confirmDelete') : tr('common.delete')}</Text>
    </Pressable>
  );
}

/* ---------- Harcama ekle / düzenle ---------- */
export function ExpenseSheet({ visible, initial, prefill, frequent = [], lastCat, main, rates, onSave, onDelete, onClose, t }: {
  visible: boolean;
  initial: Expense | null;
  prefill?: { amount?: number; cat?: string };
  frequent?: { cat: string; note: string; amount: number }[];
  lastCat?: string; // en son eklenen harcamanın kategorisi: yeni kayıtta varsayılan
  main: Cur;
  rates: Rates | null;
  onSave: (e: Expense) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  t: Theme;
}) {
  const [amount, setAmount] = useState(initial ? amountText(initial.amount) : prefill?.amount ? amountText(prefill.amount) : '');
  const [cat, setCat] = useState(initial?.cat ?? prefill?.cat ?? (lastCat && CATS.includes(lastCat) ? lastCat : CATS[0]));
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [cal, setCal] = useState(false); // takvim açık mı
  // Kayıt girildiği para biriminde gösterilir ve saklanır; yeni kayıt ana para biriminde başlar
  const [cur, setCur] = useState<Cur>(initial?.cur ?? (initial ? 'TRY' : main));
  const raw = parseAmount(amount);
  const value = raw > MAX_AMOUNT ? 0 : raw; // çok büyük tutar geçersiz sayılır; alanın altında satır içi hata gösterilir

  const save = () => {
    if (!value) return;
    const e: Expense = { id: initial?.id ?? uid(), amount: value, cat, note: note.trim(), date, ts: initial?.ts ?? Date.now(), cur };
    if (initial?.sub) {
      e.sub = initial.sub;
      e.period = initial.period;
    }
    onSave(e);
  };
  const saveLabel = value ? tr('expense.saveAmount', { amount: fmtMoney(value, cur) }) : tr('common.save');

  return (
    <Sheet visible={visible} title={initial ? tr('expense.editTitle') : tr('expense.newTitle')} onClose={onClose} t={t}
      accessoryId="expense-save" action={{ label: saveLabel, headerLabel: tr('common.save'), onPress: save, disabled: !value }}>
      <AmountHero value={amount} onChange={setAmount} raw={raw} cur={cur} onCur={setCur} main={main} rates={rates} t={t}
        label={tr('common.amountField', { sym: symbolOf(cur) })} a11y={tr('expense.amountA11y')} autoFocus={!initial} accessoryId="expense-save" />
      {!initial && frequent.length ? (
        <Field label={tr('expense.frequent')} t={t}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="always">
            {frequent.map((f) => (
              <Pressable
                key={f.cat + f.note}
                onPress={() => { setCat(f.cat); setNote(f.note); setAmount(amountText(f.amount)); setCur(main); }}
                style={({ pressed }) => [sh.freq, { backgroundColor: t.surface, borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}
              >
                <CatIcon cat={f.cat} t={t} size={28} />
                <View>
                  <Text style={{ color: t.fg, fontSize: 14, fontFamily: FONTS.semi }} numberOfLines={1}>{f.note}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>{fmtShown(f.amount, main)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Field>
      ) : null}
      <Field label={tr('common.category')} t={t}>
        <CatChips value={cat} onChange={setCat} t={t} />
      </Field>
      <Field label={tr('expense.note')} t={t}>
        <TextInput value={note} onChangeText={setNote} placeholder={tr('expense.notePlaceholder')} placeholderTextColor={t.muted} style={fieldStyle(t)} maxLength={80}
          inputAccessoryViewID="expense-save" returnKeyType="done" onSubmitEditing={save} />
      </Field>
      <DateField date={date} setDate={setDate} cal={cal} setCal={setCal} t={t} />
      <View style={sh.actions}>
        {initial ? <DeleteButton onDelete={() => onDelete(initial.id)} t={t} /> : null}
        <PrimaryButton label={saveLabel} onPress={save} disabled={!value} t={t} />
      </View>
    </Sheet>
  );
}

/* ---------- Gelir ekle / düzenle ---------- */
export function IncomeSheet({ visible, initial, main, rates, onSave, onDelete, onClose, t }: {
  visible: boolean; initial: Income | null; main: Cur; rates: Rates | null; onSave: (x: Income) => void; onDelete: (id: string) => void; onClose: () => void; t: Theme;
}) {
  const [amount, setAmount] = useState(initial ? amountText(initial.amount) : '');
  const [cat, setCat] = useState(initial?.cat ?? INCOME_CATS[0]);
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [cal, setCal] = useState(false); // takvim açık mı
  const [cur, setCur] = useState<Cur>(initial?.cur ?? (initial ? 'TRY' : main));
  const raw = parseAmount(amount);
  const value = raw > MAX_AMOUNT ? 0 : raw;

  const save = () => {
    if (!value) return;
    onSave({ id: initial?.id ?? uid(), amount: value, cat, note: note.trim().slice(0, 80), date, ts: initial?.ts ?? Date.now(), cur });
  };
  const saveLabel = value ? tr('income.saveAmount', { amount: fmtMoney(value, cur) }) : tr('common.save');

  return (
    <Sheet visible={visible} title={initial ? tr('income.editTitle') : tr('income.newTitle')} onClose={onClose} t={t}
      accessoryId="income-save" action={{ label: saveLabel, headerLabel: tr('common.save'), onPress: save, disabled: !value }}>
      <AmountHero value={amount} onChange={setAmount} raw={raw} cur={cur} onCur={setCur} main={main} rates={rates} t={t}
        label={tr('common.amountField', { sym: symbolOf(cur) })} a11y={tr('income.amountA11y')} testID="income-amount" autoFocus={!initial} accessoryId="income-save" />
      <Field label={tr('common.category')} t={t}>
        <TileGrid items={INCOME_CATS.map((c) => ({ key: c, label: incomeCatName(c), icon: incomeIcon(c), color: t.cats[incomeCatIndex(c)] }))} value={cat} onChange={setCat} t={t} />
      </Field>
      <Field label={tr('expense.note')} t={t}>
        <TextInput value={note} onChangeText={setNote} placeholder={tr('income.notePlaceholder')} placeholderTextColor={t.muted} style={fieldStyle(t)} maxLength={80}
          inputAccessoryViewID="income-save" returnKeyType="done" onSubmitEditing={save} />
      </Field>
      <DateField date={date} setDate={setDate} cal={cal} setCal={setCal} t={t} />
      <View style={sh.actions}>
        {initial ? <DeleteButton onDelete={() => onDelete(initial.id)} t={t} /> : null}
        <PrimaryButton label={saveLabel} onPress={save} disabled={!value} t={t} />
      </View>
    </Sheet>
  );
}

/* ---------- Abonelik ekle / düzenle ---------- */
export function SubSheet({ visible, initial, main, rates, onSave, onDelete, onClose, t }: {
  visible: boolean; initial: Sub | null; main: Cur; rates: Rates | null; onSave: (s: Sub) => void; onDelete: (id: string) => void; onClose: () => void; t: Theme;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? amountText(initial.amount) : '');
  const [freq, setFreq] = useState<Sub['freq']>(initial?.freq ?? 'monthly');
  const [day, setDay] = useState(String(initial?.day ?? new Date().getDate()));
  const [month, setMonth] = useState(initial?.month ?? new Date().getMonth() + 1);
  const [cur, setCur] = useState<Cur>(initial?.cur ?? (initial ? 'TRY' : main));
  const [type, setType] = useState(initial?.type ?? 'yayin');
  const [cat, setCat] = useState(initial?.cat ?? subType(initial?.type ?? 'yayin').cat);
  // Kullanıcı türü/kategoriyi kendisi seçtiyse addan tahmin edilen değer onun yerine geçmez
  const [typeTouched, setTypeTouched] = useState(!!initial);
  const [catTouched, setCatTouched] = useState(!!initial);
  const raw = parseAmount(amount);
  const value = raw > MAX_AMOUNT ? 0 : raw;
  const d = parseInt(day, 10);
  const valid = !!name.trim() && !!value && d >= 1 && d <= 31;

  const pickType = (k: string, byUser: boolean) => {
    setType(k);
    if (byUser) setTypeTouched(true);
    if (!catTouched) setCat(subType(k).cat);
  };
  const onName = (v: string) => {
    setName(v);
    if (!typeTouched) {
      const g = guessSubType(v);
      if (g) pickType(g, false);
    }
  };
  const save = () => {
    if (!valid) return;
    onSave({ id: initial?.id ?? 'sub_' + uid(), name: name.trim(), amount: value, day: d, freq, month: freq === 'yearly' ? month : 0, cat, type, skip: initial?.skip ?? '', cur });
  };

  return (
    <Sheet visible={visible} title={initial ? tr('sub.editTitle') : tr('sub.newTitle')} onClose={onClose} t={t}
      accessoryId="sub-save" action={{ label: tr('common.save'), onPress: save, disabled: !valid }}>
      <AmountHero value={amount} onChange={setAmount} raw={raw} cur={cur} onCur={setCur} main={main} rates={rates} t={t}
        label={tr('common.amountField', { sym: symbolOf(cur) })} accessoryId="sub-save" />
      <Field label={tr('sub.name')} t={t}>
        <TextInput value={name} onChangeText={onName} placeholder={tr('sub.namePlaceholder')} placeholderTextColor={t.muted} autoFocus={!initial} style={fieldStyle(t)} inputAccessoryViewID="sub-save" />
      </Field>
      <Field label={tr('sub.type')} t={t}>
        <TileGrid items={SUB_TYPES.map((x) => ({ key: x.key, label: subLabel(x.key), icon: x.icon as IconName, color: subTypeColor(x.key, t) }))} value={type} onChange={(k) => pickType(k, true)} t={t} />
      </Field>
      <Field label={tr('sub.frequency')} t={t}>
        <View style={sh.pills}>
          <Pill label={tr('sub.monthly')} active={freq === 'monthly'} onPress={() => setFreq('monthly')} t={t} />
          <Pill label={tr('sub.yearly')} active={freq === 'yearly'} onPress={() => setFreq('yearly')} t={t} />
        </View>
      </Field>
      <Field label={tr('sub.payDay')} t={t}>
        <TextInput value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} style={fieldStyle(t)} inputAccessoryViewID="sub-save" />
      </Field>
      {freq === 'yearly' ? (
        <Field label={tr('sub.payMonth')} t={t}>
          <View style={sh.pills}>
            {Array.from({ length: 12 }, (_, i) => (
              <Pill key={i} label={tr('monthShort.' + i)} active={month === i + 1} onPress={() => setMonth(i + 1)} t={t} />
            ))}
          </View>
        </Field>
      ) : null}
      <Field label={tr('sub.expenseCategory')} t={t}>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>
          {tr('sub.expenseCategoryHint')}
        </Text>
        <CatChips value={cat} onChange={(c) => { setCat(c); setCatTouched(true); }} t={t} />
      </Field>
      <View style={sh.actions}>
        {initial ? <DeleteButton onDelete={() => onDelete(initial.id)} t={t} /> : null}
        <PrimaryButton label={tr('common.save')} onPress={save} disabled={!valid} t={t} />
      </View>
    </Sheet>
  );
}

/* ---------- Bütçe ve limitler ekranı ---------- */
export function BudgetPanel({ settings, focusBudget, onChange, t }: {
  settings: Settings; focusBudget?: boolean; onChange: (s: Settings) => void; t: Theme;
}) {
  const [budget, setBudget] = useState(settings.budget ? amountText(settings.budget) : '');
  const budgetRaw = parseAmount(budget);
  const saveBudget = () => { if (budgetRaw <= MAX_AMOUNT) onChange({ ...settings, budget: budgetRaw }); };
  const limitTotal = Object.values(settings.catBudgets).reduce((a, b) => a + b, 0);
  return (
    <View style={{ gap: 22 }}>
      <Field label={tr('budget.field', { sym: symbolOf(settings.currency) })} t={t}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder={tr('budget.none')}
            placeholderTextColor={t.muted}
            autoFocus={focusBudget}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={saveBudget}
            maxLength={AMOUNT_MAXLEN}
            style={[...inputStyle(t), { flex: 1, minWidth: 0 }]}
            accessibilityLabel={tr('budget.a11y')}
          />
          <Button label={tr('common.save')} onPress={() => { Keyboard.dismiss(); saveBudget(); }} t={t} style={{ height: 48 }} />
        </View>
        <AmountError value={budgetRaw} t={t} />
      </Field>

      <View style={{ gap: 0 }}>
        <Label t={t}>{tr('budget.limitsTitle')}</Label>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20, paddingVertical: 6 }}>
          {tr('budget.limitsHint')}
          {limitTotal ? ` ${tr('budget.limitsTotal', { amount: money(limitTotal) })}` : ''}
        </Text>
        {CATS.map((c) => (
          <CatLimitRow key={c} cat={c} value={settings.catBudgets[c] || 0} t={t}
            onChange={(v) => {
              const next = { ...settings.catBudgets };
              if (v) next[c] = v; else delete next[c];
              onChange({ ...settings, catBudgets: next });
            }} />
        ))}
      </View>
    </View>
  );
}

/* ---------- Ayarlar ekranı: ad, görünüm, bildirimler, dışa/içe aktarma ---------- */
export function SettingsPanel({ settings, onChange, onExport, onBackup, onRestore, lockAvailable, notifWarn, account, ym, monthLabel, rates, refreshing, failed, onRefresh, t }: {
  settings: Settings;
  rates: Rates | null;
  refreshing: boolean;
  failed: boolean;
  onRefresh: () => void;
  onChange: (s: Settings) => void;
  onExport: (ym: string | null) => void;
  onBackup: () => void;
  onRestore: () => void;
  /** Uygulama kilidi anahtarı görünsün mü (cihazda biyometri/parola varsa; web'de hayır). */
  lockAvailable?: boolean;
  /** Hatırlatma anahtarı açık ama bildirim izni yok: uyarı satırı ve düzeltme düğmesi (sorulamıyorsa sistem ayarlarını açar). */
  notifWarn?: { canAskAgain: boolean; onFix: () => void } | null;
  /** Hesap ve yasal bölümleri (giriş kapısı sağlar). */
  account?: ReactNode;
  ym: string;
  monthLabel: string;
  t: Theme;
}) {
  const [name, setName] = useState(settings.name);
  const row = [st.row, { borderColor: t.line }];
  return (
    <View style={{ gap: 22 }}>
      <Field label={tr('settings.name')} t={t}>
        <TextInput value={name} onChangeText={setName} placeholder={tr('settings.namePlaceholder')} placeholderTextColor={t.muted} maxLength={40}
          onEndEditing={() => name.trim() !== settings.name && onChange({ ...settings, name: name.trim() })}
          returnKeyType="done" style={inputStyle(t)} accessibilityLabel={tr('settings.nameA11y')} />
      </Field>
      <Field label={tr('settings.language')} t={t}>
        <View style={st.chips}>
          {LANGS.map((l) => (
            <Chip key={l.code} label={l.native} icon="language-outline" active={settings.language === l.code} onPress={() => onChange({ ...settings, language: l.code as Lang })} t={t} />
          ))}
        </View>
      </Field>
      <Field label={tr('settings.currency')} t={t}>
        <View style={st.chips}>
          {CURRENCIES.map((c) => (
            <Chip key={c.code} label={`${c.symbol} ${c.code}`} active={settings.currency === c.code} disabled={!rates && c.code !== settings.currency}
              onPress={() => onChange({ ...settings, currency: c.code })} t={t} />
          ))}
        </View>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{currencyName(settings.currency)} · {tr('settings.currencyHint')}</Text>
      </Field>
      <RatesBox main={settings.currency} rates={rates} refreshing={refreshing} failed={failed} onRefresh={onRefresh} t={t} />
      <Field label={tr('settings.presets')} t={t}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {PRESETS.map((p) => (
            <PresetCard key={p.id} colors={p.colors} name={tr('preset.' + p.id)} label={tr('settings.presetA11y', { name: tr('preset.' + p.id) })}
              selected={presetOf(settings.accent, settings.tint) === p.id} onPress={() => onChange({ ...settings, accent: p.accent, tint: p.tint })} t={t} />
          ))}
        </View>
      </Field>
      <Field label={tr('settings.appearance')} t={t}>
        <View style={st.chips}>
          <Chip label={tr('settings.themeNoir')} icon="moon-outline" active={settings.theme === 'noir'} onPress={() => onChange({ ...settings, theme: 'noir' })} t={t} />
          <Chip label={tr('settings.themeIvory')} icon="sunny-outline" active={settings.theme === 'ivory'} onPress={() => onChange({ ...settings, theme: 'ivory' })} t={t} />
          <Chip label={tr('settings.themeSystem')} icon="phone-portrait-outline" active={settings.theme === 'system'} onPress={() => onChange({ ...settings, theme: 'system' })} t={t} />
        </View>
      </Field>
      <Field label={tr('settings.accent')} t={t}>
        <View style={st.swatches}>
          {ACCENTS.map((a) => (
            <Swatch key={a} fill={ACCENT_COLORS[a][t.name]} line={t.line} selected={settings.accent === a} label={tr('accent.' + a)}
              onPress={() => onChange({ ...settings, accent: a })} t={t} />
          ))}
        </View>
        <Text style={{ color: t.muted, fontSize: 13 }}>{tr('accent.' + settings.accent)}</Text>
      </Field>
      <Field label={tr('settings.tint')} t={t}>
        <View style={st.swatches}>
          {TINTS.map((k) => (
            <Swatch key={k} fill={TINT_COLORS[k][t.name].bg} inner={TINT_COLORS[k][t.name].surface} line={t.goldLine} selected={settings.tint === k} label={tr('tint.' + k)}
              onPress={() => onChange({ ...settings, tint: k })} t={t} />
          ))}
        </View>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{tr('tint.' + settings.tint)} · {tr('settings.colorsHint')}</Text>
      </Field>

      <View style={{ gap: 0 }}>
        <Label t={t}>{tr('settings.privacy')}</Label>
        <View style={row}>
          <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.hideAmounts')}</Text>
          <Switch value={settings.hideBalance} onValueChange={(v) => onChange({ ...settings, hideBalance: v })} trackColor={{ true: t.accent }} accessibilityLabel={tr('settings.hideAmounts')} testID="hide-amounts-switch" />
        </View>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18, paddingTop: 6 }}>{tr('settings.hideAmountsHint')}</Text>
      </View>

      <View style={{ gap: 0 }}>
        <Label t={t}>{tr('settings.notifications')}</Label>
        <View style={row}>
          <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.eveningReminder')}</Text>
          <Switch value={settings.remind} onValueChange={(v) => onChange({ ...settings, remind: v })} trackColor={{ true: t.accent }} />
        </View>
        {settings.remind ? (
          <View style={row}>
            <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.time')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable hitSlop={10} onPress={() => onChange({ ...settings, remindHour: (settings.remindHour + 23) % 24 })} accessibilityLabel={tr('settings.hourEarlier')}>
                <Text style={[st.stepTxt, { color: t.fg }]}>‹</Text>
              </Pressable>
              <Text style={{ color: t.fg, fontSize: 16, fontVariant: ['tabular-nums'] }}>{String(settings.remindHour).padStart(2, '0')}:00</Text>
              <Pressable hitSlop={10} onPress={() => onChange({ ...settings, remindHour: (settings.remindHour + 1) % 24 })} accessibilityLabel={tr('settings.hourLater')}>
                <Text style={[st.stepTxt, { color: t.fg }]}>›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={row}>
          <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.subReminder')}</Text>
          <Switch value={settings.subRemind} onValueChange={(v) => onChange({ ...settings, subRemind: v })} trackColor={{ true: t.accent }} />
        </View>
        <View style={row}>
          <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.notifAmounts')}</Text>
          <Switch value={settings.notifAmounts} onValueChange={(v) => onChange({ ...settings, notifAmounts: v })} trackColor={{ true: t.accent }} />
        </View>
        {notifWarn ? (
          <View style={{ gap: 8, paddingTop: 10 }} testID="notif-warn">
            <Text style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{tr(notifWarn.canAskAgain ? 'settings.notifOff' : 'settings.notifOffSystem')}</Text>
            <Button label={tr(notifWarn.canAskAgain ? 'settings.notifAllow' : 'settings.notifOpenSettings')} kind="ghost" onPress={notifWarn.onFix} t={t} />
          </View>
        ) : null}
      </View>

      {lockAvailable ? (
        <View style={{ gap: 0 }}>
          <View style={row}>
            <Text style={[st.rowTxt, { color: t.fg }]}>{tr('settings.lock')}</Text>
            <Switch value={settings.lock} onValueChange={(v) => onChange({ ...settings, lock: v })} trackColor={{ true: t.accent }} accessibilityLabel={tr('settings.lock')} />
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Label t={t}>{tr('settings.excel')}</Label>
        <Button label={tr('settings.exportMonth', { month: monthLabel })} kind="ghost" onPress={() => onExport(ym)} t={t} />
        <Button label={tr('settings.exportAll')} kind="ghost" onPress={() => onExport(null)} t={t} />
      </View>

      <View style={{ gap: 10 }}>
        <Label t={t}>{tr('settings.backup')}</Label>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          {tr('settings.backupHint')}
        </Text>
        <Button label={tr('settings.backupMake')} kind="ghost" onPress={onBackup} t={t} />
        <Button label={tr('settings.backupRestore')} kind="ghost" onPress={onRestore} t={t} />
      </View>
      {account}
    </View>
  );
}

/** Döviz kurları: güncel kurlar, güncellenme zamanı, kaynak ve elle güncelleme. */
export function RatesBox({ main, rates, refreshing, failed, onRefresh, t }: {
  main: Cur; rates: Rates | null; refreshing: boolean; failed: boolean; onRefresh: () => void; t: Theme;
}) {
  const old = !!rates && Date.now() - rates.fetchedAt > OLD_MS;
  const asOf = rates?.asOf ? (() => { const [y, m, d] = rates.asOf.split('-').map(Number); return tr('fmt.dateFull', { day: d, month: monthShortName(m - 1), year: y }); })() : '';
  return (
    <View style={{ gap: 8 }}>
      <Label t={t}>{tr('rates.title')}</Label>
      {rates ? (
        <>
          {CURRENCIES.filter((c) => c.code !== main).map((c) => (
            <View key={c.code} style={[st.row, { borderColor: t.line, minHeight: 40 }]}>
              <Text style={[st.rowTxt, { color: t.muted }]}>1 {c.code}</Text>
              <Text style={{ color: t.fg, fontSize: 16, fontVariant: ['tabular-nums'] }}>{fmtMoney(convert(1, c.code, main, rates), main, 4)}</Text>
            </View>
          ))}
          <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>
            {tr('rates.updated', { time: fmtStamp(rates.fetchedAt, fmtTime, monthShortName) })}
            {'\n'}{tr('rates.source', { provider: rates.provider, date: asOf })}
          </Text>
        </>
      ) : (
        <Text style={{ color: t.warn, fontSize: 14, lineHeight: 20 }}>{tr('rates.none')}</Text>
      )}
      {failed && rates ? <Text style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{tr('rates.failed')}</Text> : null}
      {failed && !rates ? <Text style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{tr('rates.failedNone')}</Text> : null}
      {old && !failed ? <Text style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{tr('rates.old')}</Text> : null}
      <Button label={refreshing ? tr('rates.refreshing') : tr('rates.refresh')} kind="ghost" disabled={refreshing} onPress={onRefresh} t={t} />
    </View>
  );
}

function CatLimitRow({ cat, value, onChange, t }: { cat: string; value: number; onChange: (v: number) => void; t: Theme }) {
  const [text, setText] = useState(value ? amountText(value) : '');
  const raw = parseAmount(text);
  const commit = () => {
    if (raw > MAX_AMOUNT) return; // çok büyük limit kaydedilmez; satırın altında hata görünür
    if (raw !== value) onChange(raw);
  };
  return (
    <View>
    <View style={[st.row, { borderColor: t.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <CatIcon cat={cat} t={t} size={30} />
        <Text style={[st.rowTxt, { color: t.fg }]}>{catName(cat)}</Text>
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        keyboardType="decimal-pad"
        placeholder={tr('budget.limitNone')}
        placeholderTextColor={t.muted}
        style={[st.limitInput, { backgroundColor: t.bg, borderColor: t.line, color: t.fg }]}
        maxLength={AMOUNT_MAXLEN}
        accessibilityLabel={tr('budget.limitA11y', { cat: catName(cat) })}
      />
    </View>
    <AmountError value={raw} t={t} />
    </View>
  );
}

const st = StyleSheet.create({
  freq: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 200 },
  limitInput: { width: 110, height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, fontSize: 16, textAlign: 'right' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, minHeight: 56 },
  topSave: { borderWidth: 1, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 18, flexShrink: 1, marginLeft: 12 },
  accessory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  accessorySave: { flex: 1, maxWidth: 260, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontFamily: FONTS.display, paddingHorizontal: 20, paddingTop: 4 },
  body: { padding: 20, gap: 18, paddingBottom: 48 },
  input: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 17 },
  big: { height: 64, fontSize: 32, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stepper: { height: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  dateBtn: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepBtn: { width: 40, alignItems: 'center' },
  stepTxt: { fontSize: 24, lineHeight: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTxt: { fontSize: 16, flexShrink: 1, paddingRight: 12 },
});
