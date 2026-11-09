import type { TextStyle, ViewStyle } from 'react-native';
import { rgba } from './palette';
import { FONTS, Theme } from './theme';

/**
 * Monibo 2.0 tasarım belirteçleri (docs/DESIGN-2.md): köşe yarıçapları, boşluklar, kart gölgesi ve iri tutar yazısı.
 * Ekranlar sabit sayı yerine bunları kullanır; böylece kartlar, kutular ve haplar her yerde aynı ritimde kalır.
 */
export const RADIUS = { card: 24, inner: 12, icon: 12, pill: 999 } as const;
export const SPACE = { edge: 20, gap: 16, pad: 20 } as const;

/** Kart kenarı ve gölgesi: açık temada yumuşak gölge + ince çizgi, koyu temada gölge yok, yalnızca 1px çizgi. */
export const cardShadow = (t: Theme): ViewStyle =>
  t.name === 'ivory'
    ? { borderWidth: 1, borderColor: t.line, boxShadow: '0px 6px 16px rgba(11,18,32,0.06)' }
    : { borderWidth: 1, borderColor: t.line };

/** Kart gövdesi: yüzey rengi, 24 köşe, 20 iç boşluk. */
export const cardBase = (t: Theme): ViewStyle => ({ backgroundColor: t.surface, borderRadius: RADIUS.card, padding: SPACE.pad, ...cardShadow(t) });

/** Kart başlığı: Plus Jakarta Sans 16/600. */
export const cardTitle = (t: Theme): TextStyle => ({ color: t.fg, fontSize: 16, lineHeight: 21, fontFamily: FONTS.bold });

/** İri tutar: sabit genişlikli rakamlar; sıkı harf aralığı yalnızca ≥ 28 px yazıda. */
export const bigAmount: TextStyle = { fontFamily: FONTS.display, fontVariant: ['tabular-nums'] };

/** Grafik izi (halka/çubuk arka planı): yazı renginin çok soluk tonu; her zemin tonunda nötr ve göze batmayan. */
export const trackOf = (t: Theme) => rgba(t.fg, t.name === 'ivory' ? 0.07 : 0.08);

/** Seçili öğe (chip, bölmeli seçici): vurgu dolgusu yerine bir yüzey basamağı yukarıda; açık temada yüzey, koyuda yükseltilmiş yüzey. */
export const selectedFill = (t: Theme) => (t.name === 'ivory' ? t.surface : t.raised);
/** Seçili öğenin ince çerçevesi: yazı renginin %28'i. */
export const selectedLine = (t: Theme) => rgba(t.fg, 0.28);
