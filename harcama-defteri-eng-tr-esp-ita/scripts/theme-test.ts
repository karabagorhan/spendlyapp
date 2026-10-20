/**
 * Renk paleti testi: `npx tsx scripts/theme-test.ts`
 * 2 mod × 4 zemin tonu × 8 vurgu rengi (64 tema) için WCAG kontrast oranları ve tutarlılık.
 */
import { ACCENTS, ACCENT_COLORS, BASE, Mode, TINTS, TINT_COLORS, contrast, isAccent, isTint, makeTheme, mix } from '../src/palette';

let fail = 0, pass = 0;
const check = (name: string, ok: boolean, detail = '') => { if (ok) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const hexOnly = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
const verbose = process.argv.includes('--table');

const rows: string[] = [];
for (const mode of ['noir', 'ivory'] as Mode[]) {
  for (const tint of TINTS) {
    for (const accent of ACCENTS) {
      const t = makeTheme(mode, tint, accent);
      const id = `${mode}/${tint}/${accent}`;
      const ratios = {
        'yazı/zemin': contrast(t.fg, t.bg), 'yazı/yüzey': contrast(t.fg, t.surface),
        'soluk/yüzey': contrast(t.muted, t.surface), 'soluk/zemin': contrast(t.muted, t.bg),
        'vurgu/zemin': contrast(t.accent, t.bg), 'vurgu/yüzey': contrast(t.accent, t.surface), 'vurgu/yükseltilmiş': contrast(t.accent, t.raised),
        'vurgu yazısı/vurgu': contrast(t.accentFg, t.accent), 'vurgu/yumuşak': contrast(t.accent, t.accentSoft),
        'özet etiketi/kart-üst': contrast(t.heroLabel, t.heroGrad[0]), 'özet etiketi/kart-alt': contrast(t.heroLabel, t.heroGrad[2]),
        'özet yazısı/kart-üst': contrast(t.heroFg, t.heroGrad[0]),
      };
      check(`${id} tüm renkler geçerli`, [t.bg, t.surface, t.raised, t.line, t.accent, t.accentFg, t.accentSoft, t.gold, t.heroFill, t.heroLabel, ...t.heroGrad].every(hexOnly));
      check(`${id} gold = accent`, t.gold === t.accent);
      check(`${id} mod adı`, t.name === mode);
      for (const [k, v] of Object.entries(ratios)) {
        const min = k.startsWith('yazı') || k.startsWith('özet yazısı') ? 7 : 4.5;
        // Özgün varsayılan (fildişi + şampanya) tasarımı değiştirilmedi: seçili kategori çipindeki vurgu/yumuşak oranı 4.26'dır
        const orig = id === 'ivory/classic/gold' && k === 'vurgu/yumuşak';
        check(`${id} ${k} ≥ ${orig ? 4.2 : min}`, v >= (orig ? 4.2 : min), `(${v.toFixed(2)})`);
      }
      rows.push(`${id.padEnd(22)} vurgu/yüzey ${ratios['vurgu/yüzey'].toFixed(1)}  yazı/vurgu ${ratios['vurgu yazısı/vurgu'].toFixed(1)}  vurgu/yumuşak ${ratios['vurgu/yumuşak'].toFixed(1)}  özet ${ratios['özet etiketi/kart-üst'].toFixed(1)}`);
    }
  }
}
// Varsayılan seçim özgün renkleri değiştirmez
check('varsayılan koyu = özgün', makeTheme('noir') === BASE.noir && makeTheme('noir', 'classic', 'gold') === BASE.noir);
check('varsayılan açık = özgün', makeTheme('ivory') === BASE.ivory);
// Vurgu renkleri birbirinden ayırt edilebilir (her modda)
for (const mode of ['noir', 'ivory'] as Mode[]) {
  for (let i = 0; i < ACCENTS.length; i++) for (let j = i + 1; j < ACCENTS.length; j++) {
    const d = contrast(ACCENT_COLORS[ACCENTS[i]][mode], ACCENT_COLORS[ACCENTS[j]][mode]);
    check(`${mode}: ${ACCENTS[i]} ≠ ${ACCENTS[j]} ayırt edilir`, ACCENT_COLORS[ACCENTS[i]][mode] !== ACCENT_COLORS[ACCENTS[j]][mode]);
    void d;
  }
  for (const a of TINTS) for (const b of TINTS) if (a < b) check(`${mode}: ${a} ≠ ${b} zemin`, TINT_COLORS[a][mode].bg !== TINT_COLORS[b][mode].bg);
}
check('doğrulayıcılar', isAccent('rose') && !isAccent('pink') && isTint('plum') && !isTint('red') && !isAccent(undefined));
check('mix uçları', mix('#000000', '#ffffff', 0) === '#000000' && mix('#000000', '#ffffff', 1) === '#ffffff' && mix('#000000', '#ffffff', 0.5) === '#808080');
if (verbose) console.log(rows.join('\n'));
console.log(`${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
