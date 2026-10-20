import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { isLang } from './i18n';
import { CATS, Expense, SUB_TYPES, Settings, Sub, guessSubType } from './lib';

// Tüm veriler telefonda tek bir kayıt olarak tutulur (internet gerekmez).
const KEY = 'harcama-defteri:v1';

export type Data = { items: Expense[]; subs: Sub[]; settings: Settings };

export const defaultSettings: Settings = { budget: 0, remind: false, remindHour: 21, subRemind: true, catBudgets: {}, theme: 'noir', name: 'Orhan Karabağ', language: 'tr' };
const empty: Data = { items: [], subs: [], settings: defaultSettings };

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
    }));
  const st = raw?.settings ?? {};
  const settings: Settings = {
    budget: num(st.budget ?? raw?.budget),
    remind: st.remind === true,
    remindHour: Math.min(23, Math.max(0, num(st.remindHour, 21))),
    subRemind: st.subRemind !== false,
    theme: st.theme === 'ivory' || st.theme === 'system' ? st.theme : 'noir',
    name: typeof st.name === 'string' ? st.name.slice(0, 40) : 'Orhan Karabağ',
    language: isLang(st.language) ? st.language : 'tr',
    catBudgets: Object.fromEntries(
      CATS.filter((c) => typeof st.catBudgets?.[c] === 'number' && st.catBudgets[c] > 0).map((c) => [c, st.catBudgets[c] as number]),
    ),
  };
  return { items, subs, settings };
}

/** Yedeği mevcut verinin üstüne ekler; aynı kimlikli kayıtlar tekrar eklenmez. */
export function merge(cur: Data, incoming: Data): { data: Data; added: number } {
  const ids = new Set(cur.items.map((x) => x.id));
  const newItems = incoming.items.filter((x) => !ids.has(x.id));
  const subIds = new Set(cur.subs.map((s) => s.id));
  const newSubs = incoming.subs.filter((s) => !subIds.has(s.id));
  return {
    data: {
      items: cur.items.concat(newItems),
      subs: cur.subs.concat(newSubs),
      settings: { ...cur.settings, budget: cur.settings.budget || incoming.settings.budget, catBudgets: { ...incoming.settings.catBudgets, ...cur.settings.catBudgets } },
    },
    added: newItems.length + newSubs.length,
  };
}

export function useAppData() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setData(raw ? normalize(JSON.parse(raw)) : empty))
      .catch(() => setData(empty));
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { data, update };
}
