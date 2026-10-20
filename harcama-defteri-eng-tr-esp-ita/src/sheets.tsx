import { ReactNode, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, PanResponder, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CURRENCIES, Cur, OLD_MS, Rates, convert, currencyName, fmtMoney, fmtStamp, money, symbolOf, toMain } from './currency';
import { LANGS, Lang, fmtTime, t as tr } from './i18n';
import { CATS, Expense, SUB_TYPES, Settings, Sub, addDays, amountText, catIndex, catName, dayLabel, guessSubType, monthName, monthShortName, parseAmount, subLabel, subType, todayIso, uid } from './lib';
import { ACCENTS, ACCENT_COLORS, TINTS, TINT_COLORS } from './palette';
import { FONTS, Theme } from './theme';
import { Button, CatIcon, Chip, IconName, Label, Swatch, catIconName, subTypeColor } from './ui';

type SheetAction = { label: string; onPress: () => void; disabled?: boolean };

/**
 * Alt sayfa: üstte Vazgeç / Kaydet, klavye açılınca içerik yukarı kayar,
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.surface }} {...edge.panHandlers}>
        <View style={st.topRow}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={{ color: t.muted, fontSize: 17 }}>{tr('common.cancel')}</Text>
          </Pressable>
          {action ? (
            <Pressable onPress={action.onPress} disabled={action.disabled} hitSlop={12} accessibilityRole="button"
              style={[st.topSave, { backgroundColor: action.disabled ? 'transparent' : t.accent, borderColor: action.disabled ? t.line : t.accent }]}>
              <Text style={{ color: action.disabled ? t.muted : t.accentFg, fontSize: 16, fontWeight: '700' }}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[st.title, { color: t.fg }]}>{title}</Text>
        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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

/** Para birimi seçimi: kayıt hangi birimde girilecek. Kur yokken yalnızca ana birim seçilebilir. */
function CurrencyChips({ value, onChange, main, rates, t }: { value: Cur; onChange: (c: Cur) => void; main: Cur; rates: Rates | null; t: Theme }) {
  return (
    <View style={st.chips}>
      {CURRENCIES.map((c) => (
        <Chip key={c.code} label={`${c.symbol} ${c.code}`} active={value === c.code} disabled={!rates && c.code !== main} onPress={() => onChange(c.code)} t={t} />
      ))}
    </View>
  );
}

/** Girilen tutarın ana para birimindeki karşılığı ("≈ ₺1.234,56 · 1 € = ₺50,12"). */
function ConvertHint({ amount, cur, main, rates, t }: { amount: number; cur: Cur; main: Cur; rates: Rates | null; t: Theme }) {
  if (cur === main) return null;
  if (!rates) return <Text style={{ color: t.warn, fontSize: 13 }}>{tr('rates.noneHint')}</Text>;
  const rate = convert(1, cur, main, rates);
  return (
    <Text style={{ color: t.muted, fontSize: 13 }}>
      {amount ? `≈ ${fmtMoney(toMain(amount, cur, main, rates) ?? 0, main)} · ` : ''}{`1 ${cur} = ${fmtMoney(rate, main, 4)}`}
    </Text>
  );
}

function inputStyle(t: Theme, big = false) {
  return [st.input, big && st.big, { backgroundColor: t.bg, borderColor: t.line, color: t.fg }];
}

function CatChips({ value, onChange, t }: { value: string; onChange: (c: string) => void; t: Theme }) {
  return (
    <View style={st.chips}>
      {CATS.map((c) => (
        <Chip key={c} label={catName(c)} active={value === c} color={t.cats[catIndex(c)]} icon={catIconName(c)} onPress={() => onChange(c)} t={t} />
      ))}
    </View>
  );
}

/** Silme iki dokunuşla: yanlışlıkla silinmesin. */
function DeleteButton({ onDelete, t }: { onDelete: () => void; t: Theme }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      label={armed ? tr('common.confirmDelete') : tr('common.delete')}
      kind={armed ? 'danger' : 'ghost'}
      onPress={() => (armed ? onDelete() : setArmed(true))}
      t={t}
    />
  );
}

/* ---------- Harcama ekle / düzenle ---------- */
export function ExpenseSheet({ visible, initial, prefill, frequent = [], main, rates, onSave, onDelete, onClose, t }: {
  visible: boolean;
  initial: Expense | null;
  prefill?: { amount?: number; cat?: string };
  frequent?: { cat: string; note: string; amount: number }[];
  main: Cur;
  rates: Rates | null;
  onSave: (e: Expense) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  t: Theme;
}) {
  const [amount, setAmount] = useState(initial ? amountText(initial.amount) : prefill?.amount ? amountText(prefill.amount) : '');
  const [cat, setCat] = useState(initial?.cat ?? prefill?.cat ?? CATS[0]);
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  // Kayıt girildiği para biriminde gösterilir ve saklanır; yeni kayıt ana para biriminde başlar
  const [cur, setCur] = useState<Cur>(initial?.cur ?? (initial ? 'TRY' : main));
  const value = parseAmount(amount);
  const isToday = date >= todayIso();

  const save = () => {
    if (!value) return;
    const e: Expense = { id: initial?.id ?? uid(), amount: value, cat, note: note.trim(), date, ts: initial?.ts ?? Date.now(), cur };
    if (initial?.sub) {
      e.sub = initial.sub;
      e.period = initial.period;
    }
    onSave(e);
  };

  return (
    <Sheet visible={visible} title={initial ? tr('expense.editTitle') : tr('expense.newTitle')} onClose={onClose} t={t}
      accessoryId="expense-save" action={{ label: value ? tr('expense.saveAmount', { amount: fmtMoney(value, cur) }) : tr('common.save'), onPress: save, disabled: !value }}>
      {!initial && frequent.length ? (
        <Field label={tr('expense.frequent')} t={t}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="always">
            {frequent.map((f) => (
              <Pressable
                key={f.cat + f.note}
                onPress={() => { setCat(f.cat); setNote(f.note); setAmount(amountText(f.amount)); setCur(main); }}
                style={({ pressed }) => [st.freq, { backgroundColor: t.bg, borderColor: t.line, opacity: pressed ? 0.7 : 1 }]}
              >
                <CatIcon cat={f.cat} t={t} size={28} />
                <View>
                  <Text style={{ color: t.fg, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{f.note}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>{fmtMoney(f.amount, main)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Field>
      ) : null}
      <Field label={tr('common.amountField', { sym: symbolOf(cur) })} t={t}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={tr('common.amountPlaceholder')}
          placeholderTextColor={t.muted}
          autoFocus={!initial}
          inputAccessoryViewID="expense-save"
          style={inputStyle(t, true)}
          accessibilityLabel={tr('expense.amountA11y')}
        />
        <CurrencyChips value={cur} onChange={setCur} main={main} rates={rates} t={t} />
        <ConvertHint amount={value} cur={cur} main={main} rates={rates} t={t} />
      </Field>
      <Field label={tr('common.category')} t={t}>
        <CatChips value={cat} onChange={setCat} t={t} />
      </Field>
      <Field label={tr('expense.note')} t={t}>
        <TextInput value={note} onChangeText={setNote} placeholder={tr('expense.notePlaceholder')} placeholderTextColor={t.muted} style={inputStyle(t)}
          inputAccessoryViewID="expense-save" returnKeyType="done" onSubmitEditing={save} />
      </Field>
      <Field label={tr('expense.date')} t={t}>
        <View style={st.chips}>
          <Chip label={tr('date.today')} active={date === todayIso()} onPress={() => setDate(todayIso())} t={t} />
          <Chip label={tr('date.yesterday')} active={date === addDays(todayIso(), -1)} onPress={() => setDate(addDays(todayIso(), -1))} t={t} />
          <Chip label={tr('date.twoDaysAgo')} active={date === addDays(todayIso(), -2)} onPress={() => setDate(addDays(todayIso(), -2))} t={t} />
        </View>
        <View style={[st.stepper, { backgroundColor: t.bg, borderColor: t.line }]}>
          <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={8} style={st.stepBtn} accessibilityLabel={tr('date.prevDay')}>
            <Text style={[st.stepTxt, { color: t.fg }]}>‹</Text>
          </Pressable>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '500' }}>{dayLabel(date)}</Text>
          <Pressable onPress={() => !isToday && setDate(addDays(date, 1))} hitSlop={8} style={[st.stepBtn, { opacity: isToday ? 0.3 : 1 }]} accessibilityLabel={tr('date.nextDay')}>
            <Text style={[st.stepTxt, { color: t.fg }]}>›</Text>
          </Pressable>
        </View>
      </Field>
      <View style={st.actions}>
        {initial ? <DeleteButton onDelete={() => onDelete(initial.id)} t={t} /> : null}
        <Button label={tr('common.save')} onPress={save} disabled={!value} t={t} style={{ flex: 1 }} />
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
  const value = parseAmount(amount);
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
      <Field label={tr('sub.name')} t={t}>
        <TextInput value={name} onChangeText={onName} placeholder={tr('sub.namePlaceholder')} placeholderTextColor={t.muted} autoFocus={!initial} style={inputStyle(t)} inputAccessoryViewID="sub-save" />
      </Field>
      <Field label={tr('sub.type')} t={t}>
        <View style={st.chips}>
          {SUB_TYPES.map((x) => (
            <Chip key={x.key} label={subLabel(x.key)} icon={x.icon as IconName} color={subTypeColor(x.key, t)} active={type === x.key} onPress={() => pickType(x.key, true)} t={t} />
          ))}
        </View>
      </Field>
      <Field label={tr('common.amountField', { sym: symbolOf(cur) })} t={t}>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={tr('common.amountPlaceholder')} placeholderTextColor={t.muted} style={inputStyle(t, true)} inputAccessoryViewID="sub-save" />
        <CurrencyChips value={cur} onChange={setCur} main={main} rates={rates} t={t} />
        <ConvertHint amount={value} cur={cur} main={main} rates={rates} t={t} />
      </Field>
      <Field label={tr('sub.frequency')} t={t}>
        <View style={st.chips}>
          <Chip label={tr('sub.monthly')} active={freq === 'monthly'} onPress={() => setFreq('monthly')} t={t} />
          <Chip label={tr('sub.yearly')} active={freq === 'yearly'} onPress={() => setFreq('yearly')} t={t} />
        </View>
      </Field>
      <Field label={tr('sub.payDay')} t={t}>
        <TextInput value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} style={inputStyle(t)} inputAccessoryViewID="sub-save" />
      </Field>
      {freq === 'yearly' ? (
        <Field label={tr('sub.payMonth')} t={t}>
          <View style={st.chips}>
            {Array.from({ length: 12 }, (_, i) => (
              <Chip key={i} label={tr('monthShort.' + i)} active={month === i + 1} onPress={() => setMonth(i + 1)} t={t} />
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
      <View style={st.actions}>
        {initial ? <DeleteButton onDelete={() => onDelete(initial.id)} t={t} /> : null}
        <Button label={tr('common.save')} onPress={save} disabled={!valid} t={t} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/* ---------- Bütçe ve limitler ekranı ---------- */
export function BudgetPanel({ settings, focusBudget, onChange, t }: {
  settings: Settings; focusBudget?: boolean; onChange: (s: Settings) => void; t: Theme;
}) {
  const [budget, setBudget] = useState(settings.budget ? amountText(settings.budget) : '');
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
            onSubmitEditing={() => onChange({ ...settings, budget: parseAmount(budget) })}
            style={[...inputStyle(t), { flex: 1, minWidth: 0 }]}
            accessibilityLabel={tr('budget.a11y')}
          />
          <Button label={tr('common.save')} onPress={() => { Keyboard.dismiss(); onChange({ ...settings, budget: parseAmount(budget) }); }} t={t} style={{ height: 48 }} />
        </View>
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
export function SettingsPanel({ settings, onChange, onExport, onBackup, onRestore, ym, monthLabel, rates, refreshing, failed, onRefresh, t }: {
  settings: Settings;
  rates: Rates | null;
  refreshing: boolean;
  failed: boolean;
  onRefresh: () => void;
  onChange: (s: Settings) => void;
  onExport: (ym: string | null) => void;
  onBackup: () => void;
  onRestore: () => void;
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
      </View>

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
  const commit = () => {
    const v = parseAmount(text);
    if (v !== value) onChange(v);
  };
  return (
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
        accessibilityLabel={tr('budget.limitA11y', { cat: catName(cat) })}
      />
    </View>
  );
}

const st = StyleSheet.create({
  freq: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 200 },
  limitInput: { width: 110, height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, fontSize: 16, textAlign: 'right' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, minHeight: 56 },
  topSave: { borderWidth: 1, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 18 },
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
  stepBtn: { width: 40, alignItems: 'center' },
  stepTxt: { fontSize: 24, lineHeight: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTxt: { fontSize: 16, flexShrink: 1, paddingRight: 12 },
});
