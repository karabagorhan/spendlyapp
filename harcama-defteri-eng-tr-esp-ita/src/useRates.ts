import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Rates, fetchRates, isStale, normalizeRates } from './currency';

// Kurlar kullanıcı verisinden ayrı saklanır (yedeğe girmez); son başarılı çekim çevrimdışıyken de kullanılır.
const KEY = 'harcama-defteri:rates:v1';

export type RatesState = {
  /** Son başarılı çekimin kurları; hiç çekilmediyse null (uygulamada uydurma kur yoktur). */
  rates: Rates | null;
  /** Cihazdaki kayıt okunana kadar false. */
  ready: boolean;
  refreshing: boolean;
  /** Son deneme başarısız olduysa true (son kayıtlı kurlar kullanılır). */
  failed: boolean;
  /** Elle ya da otomatik güncelleme; başarılıysa true. */
  refresh: () => Promise<boolean>;
};

export function useRates(): RatesState {
  const [rates, setRates] = useState<Rates | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const ratesRef = useRef<Rates | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return false;
    busy.current = true;
    setRefreshing(true);
    try {
      const r = await fetchRates((u, init) => fetch(u, init));
      ratesRef.current = r;
      setRates(r);
      setFailed(false);
      AsyncStorage.setItem(KEY, JSON.stringify(r)).catch(() => {});
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  // Açılışta kayıtlı kurları oku, eskiyse yenile
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => (raw ? normalizeRates(JSON.parse(raw)) : null))
      .catch(() => null)
      .then((r) => {
        if (!alive) return;
        ratesRef.current = r;
        setRates(r);
        setReady(true);
        if (isStale(r)) refresh();
      });
    return () => { alive = false; };
  }, [refresh]);

  // Uygulama arka plandan öne gelince, kurlar eskiyse yenile
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && isStale(ratesRef.current)) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { rates, ready, refreshing, failed, refresh };
}
