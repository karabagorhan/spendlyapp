import Svg, { Path } from 'react-native-svg';
import type { Theme } from './palette';

/**
 * Monibo 2.0 geometrik motifleri (docs/DESIGN-2.md §Geometrik motif): çeyrek daire, yarım daire, yuvarlak kare ve yaprak parçaları.
 * Tanıtım ekranının büyük illüstrasyonu ve karşılama ekranının küçük süsü bu dosyadan gelir.
 */

type Shape = 'qtl' | 'qtr' | 'qbr' | 'qbl' | 'ht' | 'hb' | 'hl' | 'hr' | 'c' | 'sq' | 'leaf1' | 'leaf2' | 'dot' | 'none';

/** Köşe yarıçaplı (sol-üst, sağ-üst, sağ-alt, sol-alt) dikdörtgen yolu. */
function rr(x: number, y: number, w: number, h: number, [a, b, c, d]: [number, number, number, number]) {
  return `M${x + a},${y} H${x + w - b} A${b},${b} 0 0 1 ${x + w},${y + b} V${y + h - c} A${c},${c} 0 0 1 ${x + w - c},${y + h} H${x + d} A${d},${d} 0 0 1 ${x},${y + h - d} V${y + a} A${a},${a} 0 0 1 ${x + a},${y} Z`;
}

/** Bir hücreye (x, y, s×s) sığan şeklin yolu. */
function shapePath(k: Shape, x: number, y: number, s: number): string {
  const h = s / 2;
  switch (k) {
    case 'qtl': return rr(x, y, s, s, [s, 0, 0, 0]);
    case 'qtr': return rr(x, y, s, s, [0, s, 0, 0]);
    case 'qbr': return rr(x, y, s, s, [0, 0, s, 0]);
    case 'qbl': return rr(x, y, s, s, [0, 0, 0, s]);
    case 'ht': return rr(x, y + h, s, h, [h, h, 0, 0]);
    case 'hb': return rr(x, y, s, h, [0, 0, h, h]);
    case 'hl': return rr(x + h, y, h, s, [h, 0, 0, h]);
    case 'hr': return rr(x, y, h, s, [0, h, h, 0]);
    case 'c': return rr(x, y, s, s, [h, h, h, h]);
    case 'sq': { const r = s * 0.24; return rr(x, y, s, s, [r, r, r, r]); }
    case 'leaf1': return rr(x, y, s, s, [s, 0, s, 0]);
    case 'leaf2': return rr(x, y, s, s, [0, s, 0, s]);
    case 'dot': { const r = s * 0.18; return rr(x + h - r, y + h - r, r * 2, r * 2, [r, r, r, r]); }
    default: return '';
  }
}

/** [şekil, renk dizini] — 3×3 ızgara; renk dizini PAL içindeki sıraya göre. */
type Cell = [Shape, number];
type Art = { colors: string[]; cells: Cell[] };

/** Her tanıtım sayfasının paleti: 0/1 = iki ana renk, 2 = açık nötr, 3 = koyu nötr karo, 4 = ana rengin açığı. */
export const ONBOARDING_ART: Art[] = [
  {
    // Coral
    colors: ['#FF6B5A', '#14B8A6', '#F4EFE6', '#23232B', '#FF9A8C'],
    cells: [['qtr', 0], ['ht', 1], ['sq', 2], ['c', 1], ['leaf1', 0], ['qbl', 4], ['qbl', 0], ['sq', 3], ['qtl', 1]],
  },
  {
    // Kobalt
    colors: ['#2457FF', '#C8FF3D', '#F4F4F8', '#1D2030', '#6C8CFF'],
    cells: [['sq', 1], ['qbr', 0], ['hl', 2], ['qtl', 0], ['c', 1], ['hb', 4], ['hr', 2], ['qtr', 1], ['leaf2', 0]],
  },
  {
    // Erik
    colors: ['#542A52', '#FFB39A', '#F4EDE8', '#23202A', '#8F4C8B'],
    cells: [['leaf2', 1], ['hb', 4], ['qbl', 0], ['sq', 0], ['qtr', 1], ['c', 2], ['qtr', 4], ['ht', 1], ['sq', 3]],
  },
];

/** Tanıtım illüstrasyonu: 3×3 ızgarada cesur geometrik bloklar; kare alanı doldurur. */
export function OnboardingArt({ slide, size }: { slide: number; size: number }) {
  const art = ONBOARDING_ART[slide % ONBOARDING_ART.length];
  const gap = 8, S = 300, cell = (S - gap * 2) / 3;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${S} ${S}`} accessible={false} aria-hidden>
      {art.cells.map(([k, ci], i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = col * (cell + gap), y = row * (cell + gap);
        const dark = art.colors[ci] === art.colors[3];
        return (
          <Path key={i} d={dark ? rr(x, y, cell, cell, [cell * 0.24, cell * 0.24, cell * 0.24, cell * 0.24]) : shapePath(k, x, y, cell)} fill={art.colors[ci]} />
        );
      })}
      {/* koyu karolara küçük bir nokta: soyut "madeni para" */}
      {art.cells.map(([k, ci], i) => {
        if (art.colors[ci] !== art.colors[3]) return null;
        const col = i % 3, row = Math.floor(i / 3);
        return <Path key={'d' + i} d={shapePath('dot', col * (cell + gap), row * (cell + gap), cell)} fill={art.colors[0]} />;
      })}
    </Svg>
  );
}

/** Karşılama ekranı süsü: temanın vurgusu + ikincil rengi (heroAlt) + nötr; 4 küçük parça yan yana. */
export function WelcomeMotif({ t, size = 40 }: { t: Theme; size?: number }) {
  const gap = 6, W = size * 4 + gap * 3;
  const neutral = t.line;
  const parts: [Shape, string][] = [['qtr', t.accent], ['hb', t.heroAlt], ['c', t.accent], ['leaf1', neutral]];
  return (
    <Svg width={W} height={size} viewBox={`0 0 ${W} ${size}`} accessible={false} aria-hidden>
      {parts.map(([k, c], i) => <Path key={i} d={shapePath(k, i * (size + gap), 0, size)} fill={c} />)}
    </Svg>
  );
}
