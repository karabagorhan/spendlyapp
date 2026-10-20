import { useColorScheme } from 'react-native';
import { Accent, Theme, ThemeMode, Tint, makeTheme } from './palette';

export type { Theme, ThemeMode, Accent, Tint };

// Başlıklar ve büyük tutarlar: Playfair Display (yüksek kontrastlı serif). Metinler sistem yazı tipinde.
export const FONTS = {
  display: 'PlayfairDisplay_700Bold',
  bold: 'PlayfairDisplay_600SemiBold',
  semi: 'PlayfairDisplay_600SemiBold',
};

/** Seçili mod ("Telefona göre" ise cihazın açık/koyu ayarı) + zemin tonu + vurgu rengi. */
export function useTheme(mode: ThemeMode = 'noir', tint: Tint = 'classic', accent: Accent = 'gold'): Theme {
  const scheme = useColorScheme();
  const m = mode === 'system' ? (scheme === 'light' ? 'ivory' : 'noir') : mode;
  return makeTheme(m, tint, accent);
}
