import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, isLang } from '../i18n';

/** Hesap/tanıtım tercihleri; harcama verisinden ayrı tutulur (yedeğe girmez, hesap silinince sıfırlanır). */
const KEY = 'harcama-defteri:auth:v1';
const DATA_KEY = 'harcama-defteri:v1';

export type Prefs = {
  onboarded: boolean;
  /** Kullanıcı "hesap açmadan devam et"i seçti. */
  guest: boolean;
  /** Son kabul edilen yasal metin sürümü ve zamanı. */
  consent: { version: string; at: number } | null;
  /** İlk kurulumda tanıtım ekranında seçilen dil (veri kaydı oluşana kadar burada durur). */
  lang: Lang | null;
};

export const defaultPrefs: Prefs = { onboarded: false, guest: false, consent: null, lang: null };

export function parsePrefs(raw: string | null): Prefs | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return {
      onboarded: j?.onboarded === true,
      guest: j?.guest === true,
      lang: isLang(j?.lang) ? j.lang : null,
      consent: typeof j?.consent?.version === 'string' && typeof j?.consent?.at === 'number' ? { version: j.consent.version, at: j.consent.at } : null,
    };
  } catch {
    return null;
  }
}

/**
 * Tercihleri okur. Tercih kaydı yok ama harcama verisi varsa kullanıcı eski sürümden güncellemiştir:
 * tanıtım gösterilmez, misafir olarak devam eder (hesabı Ayarlar'dan açabilir).
 */
export async function loadPrefs(): Promise<Prefs> {
  try {
    const own = parsePrefs(await AsyncStorage.getItem(KEY));
    if (own) return own;
    const hasData = (await AsyncStorage.getItem(DATA_KEY)) !== null;
    return hasData ? { onboarded: true, guest: true, consent: null, lang: null } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

export async function savePrefs(p: Prefs) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Yazılamazsa bu oturumda bellekteki durumla devam edilir; sonraki açılışta tanıtım yeniden görünebilir.
  }
}

export async function clearAccountData() {
  try {
    await AsyncStorage.multiRemove([KEY]);
  } catch {}
}

export async function loadLangPref(): Promise<Lang | null> {
  try {
    return parsePrefs(await AsyncStorage.getItem(KEY))?.lang ?? null;
  } catch {
    return null;
  }
}
