import { useColorScheme } from 'react-native';
import { Accent, Theme, ThemeMode, Tint, makeTheme } from './palette';

export type { Theme, ThemeMode, Accent, Tint };

// Başlıklar ve büyük tutarlar: Plus Jakarta Sans (800 ExtraBold, 700 Bold, 600 SemiBold). Metinler sistem yazı tipinde.
// Özel yazı tipi ailesiyle birlikte fontWeight verilmez (Android'de aile adı kalınlığı zaten belirler).
export const FONTS = {
  display: 'PlusJakartaSans_800ExtraBold',
  bold: 'PlusJakartaSans_700Bold',
  semi: 'PlusJakartaSans_600SemiBold',
};

/** Seçili mod ("Telefona göre" ise cihazın açık/koyu ayarı) + zemin tonu + vurgu rengi. */
export function useTheme(mode: ThemeMode = 'noir', tint: Tint = 'classic', accent: Accent = 'gold'): Theme {
  const scheme = useColorScheme();
  const m = mode === 'system' ? (scheme === 'light' ? 'ivory' : 'noir') : mode;
  return makeTheme(m, tint, accent);
}
