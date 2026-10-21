import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Cur, isCur } from './currency';
import { deviceLanguage, isLang } from './i18n';
import { loadLangPref } from './auth/prefs';
import { isAccent, isTint } from './palette';
import { CATS, Expense, INCOME_CATS, Income, SUB_TYPES, Settings, Sub, guessSubType } from './lib';

// Tüm veriler telefonda tek bir kayıt olarak tutulur (internet gerekmez).
export const KEY = 'harcama-defteri:v1';

export type Data = { items: Expense[]; subs: Sub[]; incomes: Income[]; settings: Settings };

export const defaultSettings: Settings = { budget: 0, remind: false, remindHour: 21, subRemind: true, catBudgets: {}, theme: 'system', accent: 'sapphire', tint: 'blue', name: '', hideBalance: false, language: 'tr', currency: 'TRY', budgetCur: 'TRY', catBudgetCur: {} };
const empty: Data = { items: [], subs: [], incomes: [], settings: defaultSettings };

function num(v: unknown, d = 0) {
  return typeof v === 'number' && isFinite(v) ? v : d;
}
function str(v: unknown, d = '') {
  return typeof v === 'string' ? v : d;
}

/** Dışarıdan gelen (yedek dosyası, eski kayıt) veriyi güvenli biçime getirir. */
export function normalize(raw: any): Data {
  const items: Expense[] = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((x: any) => x && typeof x.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(str(x.date)))
    .map((x: any) => ({
      id: str(x.id) || Math.random().toString(36).slice(2),
      amount: x.amount,
      cat: CATS.includes(x.cat) ? x.cat : 'Diğer',
      note: str(x.note),
      date: x.date,
      ts: num(x.ts),
      ...(isCur(x.cur) ? { cur: x.cur as Cur } : {}),
      ...(x.sub ? { sub: str(x.sub), period: str(x.period) } : {}),
    }));
  const subs: Sub[] = (Array.isArray(raw?.subs) ? raw.subs : [])
    .filter((s: any) => s && typeof s.amount === 'number' && str(s.name))
    .map((s: any) => ({
      id: str(s.id) || 'sub_' + Math.random().toString(36).slice(2),
      name: s.name,
      amount: s.amount,
      day: Math.min(31, Math.max(1, num(s.day, 1))),
      freq: s.freq === 'yearly' ? 'yearly' : 'monthly',
      month: Math.min(12, Math.max(1, num(s.month, 1))),
      cat: CATS.includes(s.cat) ? s.cat : 'Diğer',
      skip: str(s.skip),
      type: SUB_TYPES.some((x) => x.key === s.type) ? s.type : guessSubType(str(s.name)) ?? 'diger',
      ...(isCur(s.cur) ? { cur: s.cur as Cur } : {}),
    }));
  const incomes: Income[] = (Array.isArray(raw?.incomes) ? raw.incomes : [])
    .filter((x: any) => x && typeof x.amount === 'number' && x.amount > 0 && isFinite(x.amount) && /^\d{4}-\d{2}-\d{2}$/.test(str(x.date)))
    .map((x: any) => ({
      id: str(x.id) || 'inc_' + Math.random().toString(36).slice(2),
      amount: x.amount,
      cat: (INCOME_CATS as readonly string[]).includes(x.cat) ? x.cat : 'other',
      note: str(x.note).slice(0, 80),
      date: x.date,
      ts: num(x.ts),
      ...(isCur(x.cur) ? { cur: x.cur as Cur } : {}),
    }));
  const st = raw?.settings ?? {};
  const settings: Settings = {
    budget: num(st.budget ?? raw?.budget),
    remind: st.remind === true,
    remindHour: Math.min(23, Math.max(0, num(st.remindHour, 21))),
    subRemind: st.subRemind !== false,
    theme: st.theme === 'ivory' || st.theme === 'system' ? st.theme : 'noir',
    accent: isAccent(st.accent) ? st.accent : 'gold',
    tint: isTint(st.tint) ? st.tint : 'classic',
    name: typeof st.name === 'string' ? st.name.slice(0, 40) : '',
    hideBalance: st.hideBalance === true,
    language: isLang(st.language) ? st.language : 'tr',
    currency: isCur(st.currency) ? st.currency : 'TRY',
    budgetCur: isCur(st.budgetCur) ? st.budgetCur : 'TRY',
    catBudgets: Object.fromEntries(
      CATS.filter((c) => typeof st.catBudgets?.[c] === 'number' && st.catBudgets[c] > 0).map((c) => [c, st.catBudgets[c] as number]),
    ),
    catBudgetCur: Object.fromEntries(
      CATS.filter((c) => typeof st.catBudgets?.[c] === 'number' && st.catBudgets[c] > 0 && isCur(st.catBudgetCur?.[c])).map((c) => [c, st.catBudgetCur[c] as Cur]),
    ),
  };
  return { items, subs, incomes, settings };
}

/** Yedeği mevcut verinin üstüne ekler; aynı kimlikli kayıtlar tekrar eklenmez. */
export function merge(cur: Data, incoming: Data): { data: Data; added: number } {
  const ids = new Set(cur.items.map((x) => x.id));
  const newItems = incoming.items.filter((x) => !ids.has(x.id));
  const subIds = new Set(cur.subs.map((s) => s.id));
  const newSubs = incoming.subs.filter((s) => !subIds.has(s.id));
  const curIncomes = cur.incomes ?? [];
  const incomeIds = new Set(curIncomes.map((x) => x.id));
  const newIncomes = (incoming.incomes ?? []).filter((x) => !incomeIds.has(x.id));
  // Bütçe/limit yedekten alınırken para birimi de birlikte gelir (eski yedeklerde TRY)
  const takeBudget = !cur.settings.budget && incoming.settings.budget > 0;
  const catBudgets = { ...incoming.settings.catBudgets, ...cur.settings.catBudgets };
  const catBudgetCur: Record<string, Cur> = {};
  for (const k of Object.keys(catBudgets)) {
    const own = k in cur.settings.catBudgets;
    const c = (own ? cur.settings.catBudgetCur : incoming.settings.catBudgetCur)[k];
    if (c) catBudgetCur[k] = c;
  }
  return {
    data: {
      items: cur.items.concat(newItems),
      subs: cur.subs.concat(newSubs),
      incomes: curIncomes.concat(newIncomes),
      settings: {
        ...cur.settings,
        budget: takeBudget ? incoming.settings.budget : cur.settings.budget,
        budgetCur: takeBudget ? incoming.settings.budgetCur : cur.settings.budgetCur,
        catBudgets,
        catBudgetCur,
      },
    },
    added: newItems.length + newSubs.length + newIncomes.length,
  };
}

export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Kayıtlı veriyi yükler ve güncellemeleri saklar.
 * - Okuma HATA verirse `status: 'error'` olur ve veri `null` kalır: boş veriyle devam edip gerçek kaydı ezmemek için hiçbir şey yazılmaz;
 *   `reload()` yeniden dener.
 * - Kayıt okunur ama bozuksa (JSON/biçim hatası) özgün metin `…:corrupt:<zaman>` anahtarına yedeklenir, uygulama boş veriyle açılır
 *   ve `recovered` true olur (kullanıcıya bildirilir).
 * - Yazma başarısız olursa (depolama dolu vb.) `saveFailed` true olur.
 */
export function useAppData() {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    AsyncStorage.getItem(KEY)
      .then(async (raw) => {
        if (!live) return;
        // Boş veriyle başlanan her durumda (ilk kurulum, kurtarılan bozuk kayıt) dil: tanıtımda seçilen dil ya da cihaz dili
        const fresh = async (): Promise<Data> => ({ ...empty, settings: { ...defaultSettings, language: (await loadLangPref()) ?? deviceLanguage() } });
        if (raw) {
          try {
            setData(normalize(JSON.parse(raw)));
          } catch {
            await AsyncStorage.setItem(`${KEY}:corrupt:${Date.now()}`, raw).catch(() => {});
            const d = await fresh();
            if (live) { setData(d); setRecovered(true); }
          }
        } else {
          const d = await fresh();
          if (live) setData(d);
        }
        if (live) setStatus('ready');
      })
      .catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, [attempt]);

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      if (!prev) return prev; // yüklenmemişken (ya da okuma hatasında) hiçbir şey yazılmaz
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).then(() => setSaveFailed(false)).catch(() => setSaveFailed(true));
      return next;
    });
  }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, update, status, reload, recovered, saveFailed, clearSaveFailed: () => setSaveFailed(false) };
}

/** Giriş/tanıtım ekranlarının dili ve görünümü: veri kaydı yükleniyorsa ondan, ilk kurulumda tercihten/cihaz dilinden. */
export async function readLook() {
  let raw: string | null = null;
  try { raw = await AsyncStorage.getItem(KEY); } catch {}
  if (raw) {
    try {
      const st = normalize(JSON.parse(raw)).settings;
      return { language: st.language, theme: st.theme, tint: st.tint, accent: st.accent };
    } catch {}
  }
  const language = (await loadLangPref()) ?? deviceLanguage();
  return { language, theme: defaultSettings.theme, tint: defaultSettings.tint, accent: defaultSettings.accent };
}
