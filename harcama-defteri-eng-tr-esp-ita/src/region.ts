import { Cur, pickCurrency, regionOf } from './currency';

/**
 * Cihazın bölgesine göre varsayılan para birimi (yalnızca ilk kurulumda kullanılır; sonra Ayarlar'dan değişir).
 * Önce expo-localization'ın verdiği para birimi ve bölge; modül yoksa (web, testler) Intl yerel ayarı.
 */
export function deviceCurrency(): Cur {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const l = getLocales()[0];
    if (l) return pickCurrency(l.currencyCode, l.regionCode);
  } catch {}
  let loc = '';
  try { loc = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch {}
  return pickCurrency(null, regionOf(loc));
}
