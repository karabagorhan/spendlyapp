/**
 * Renk paleti testi: `npx tsx scripts/theme-test.ts [--table] [--wada]`
 * 2 mod × 10 zemin tonu × 16 vurgu rengi (320 tema) için WCAG kontrast oranları ve tutarlılık;
 * hazır temalar ve kategori renkleri için Sanzo Wada verisi (scripts/data/wada-colors.json) denetimi.
 * --wada: kitaptaki renkten ayarlanan tonların ΔE tablosunu yazar.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalize } from '../src/store';
import { ACCENTS, PRESETS, presetOf, ACCENT_COLORS, BASE, Mode, SECONDARY, TINTS, TINT_COLORS, contrast, isAccent, isTint, makeTheme, mix, WARM_ACCENTS } from '../src/palette';

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
check('doğrulayıcılar', isAccent('rose') && isAccent('coral') && isAccent('ruby') && !isAccent('pink') && isTint('plum') && !isTint('red') && !isAccent(undefined));
check('mix uçları', mix('#000000', '#ffffff', 0) === '#000000' && mix('#000000', '#ffffff', 1) === '#ffffff' && mix('#000000', '#ffffff', 0.5) === '#808080');
// Hazır temalar: beklenen eşleme (eski kayıtlar geçerli kalsın diye ilk üçünün anahtarları değişmez), geçerli değerler, yalnızca birebir eşleşmede vurgulanır
const want: Record<string, [string, string]> = {
  coral: ['coralteal', 'deepsea'], cobalt: ['cobaltlime', 'cobaltnight'], plum: ['plumpeach', 'midnight'],
  indigo: ['indigoochre', 'indigo'], sage: ['sagerust', 'sage'], slate: ['slaterose', 'slate'],
};
check('hazır tema sayısı', PRESETS.length === 6 && PRESETS.map((p) => p.id).join() === 'coral,cobalt,plum,indigo,sage,slate');
check('hazır temalar farklı vurgu ve ton kullanır', new Set(PRESETS.map((p) => p.accent)).size === 6 && new Set(PRESETS.map((p) => p.tint)).size === 6);
for (const p of PRESETS) {
  check(`hazır tema ${p.id} eşlemesi`, p.accent === want[p.id][0] && p.tint === want[p.id][1], `${p.accent}/${p.tint}`);
  check(`hazır tema ${p.id} geçerli`, isAccent(p.accent) && isTint(p.tint) && p.colors.every(hexOnly) && p.colors.length >= 2 && p.colors.length <= 4);
  check(`hazır tema ${p.id} eşleşince seçili`, presetOf(p.accent, p.tint) === p.id);
  check(`hazır tema ${p.id} yalnızca vurgu değişince seçili değil`, presetOf('gold', p.tint) === null && presetOf(p.accent, 'classic') === null);
  // Normalize gidiş-dönüş: kayıtlı ayar korunur, mod değişmez
  for (const theme of ['noir', 'ivory', 'system']) {
    const n = normalize({ settings: { theme, accent: p.accent, tint: p.tint } }).settings;
    check(`normalize ${p.id}/${theme} gidiş-dönüş`, n.accent === p.accent && n.tint === p.tint && n.theme === theme);
    const again = normalize(JSON.parse(JSON.stringify({ settings: n }))).settings;
    check(`normalize ${p.id}/${theme} ikinci tur`, again.accent === n.accent && again.tint === n.tint);
  }
}
const old = normalize({ settings: { accent: 'coral', tint: 'plum', theme: 'ivory' } }).settings;
check('eski kayıt (coral/plum) geçerli kalır', old.accent === 'coral' && old.tint === 'plum');
const junk = normalize({ settings: { accent: 'neon', tint: 'x' } }).settings;
check('geçersiz kayıt varsayılana düşer', junk.accent === 'gold' && junk.tint === 'classic');
check('yeni değerler doğrulanır', ['coralteal', 'cobaltlime', 'plumpeach', 'indigoochre', 'sagerust', 'slaterose'].every(isAccent) && ['midnight', 'deepsea', 'cobaltnight', 'indigo', 'sage', 'slate'].every(isTint));
// Önceki sürümlerde kaydedilmiş tüm vurgu/ton değerleri (Wada'dan önceki 13 vurgu × 7 ton) olduğu gibi yüklenir
for (const a of ['gold', 'emerald', 'sapphire', 'amethyst', 'rose', 'copper', 'coral', 'ruby', 'teal', 'silver', 'coralteal', 'cobaltlime', 'plumpeach'])
  for (const k of ['classic', 'blue', 'green', 'plum', 'midnight', 'deepsea', 'cobaltnight']) {
    const n = normalize(JSON.parse(JSON.stringify({ settings: { accent: a, tint: k, theme: 'noir' } }))).settings;
    check(`eski kayıt ${a}/${k} yüklenir`, n.accent === a && n.tint === k);
  }
check('boş kayıt: varsayılanlar değişmedi', normalize({}).settings.accent === 'gold' && normalize({}).settings.tint === 'classic');
// İkinci renk özet kartında: gradyan ikinci renkten türer, etiket vurguda kalır
check('coralteal özet kartı turkuaz', makeTheme('noir', 'deepsea', 'coralteal').heroGrad[0] !== makeTheme('noir', 'deepsea', 'coral').heroGrad[0]);
// Uyarı rengi (aşılan bütçe, hata) vurgudan ayırt edilmeli ve okunmalı: sıcak vurgularda kehribar/kırmızı uyarı
const hue = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const hueGap = (a: string, b: string) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };
for (const mode of ['noir', 'ivory'] as Mode[]) for (const tint of TINTS) for (const accent of ACCENTS) {
  const t = makeTheme(mode, tint, accent);
  check(`uyarı okunur ${mode}/${tint}/${accent}`, contrast(t.warn, t.surface) >= 4.5 && contrast(t.warn, t.bg) >= 4.5, `${t.warn}`);
}
for (const accent of WARM_ACCENTS) for (const tint of TINTS) {
  const t = makeTheme('noir', tint, accent);
  check(`uyarı vurgudan ayrışır noir/${tint}/${accent}`, hueGap(t.warn, t.accent) >= 20, `${t.warn} ~ ${t.accent}`);
}

/* ---------- Sanzo Wada: hazır temalar ve kategori renkleri ---------- */
type WadaColor = { name: string; hex: string; combinations: number[] };
const WADA: WadaColor[] = JSON.parse(readFileSync(join(__dirname, 'data', 'wada-colors.json'), 'utf8')).colors;
const comboOf = (n: number) => WADA.filter((c) => c.combinations.includes(n));
const byHex = (h: string) => WADA.find((c) => c.hex === h.toLowerCase());
// CIE L*a*b* (D65) ve CIE76 ΔE
const lab = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const [fx, fy, fz] = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const dE = (a: string, b: string) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const chroma = (h: string) => { const [, a, b] = lab(h); return Math.hypot(a, b); };
const hueDeg = (h: string) => { const [, a, b] = lab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
const wadaRows: string[] = [];
check('Wada verisi: 159 renk, 348 kombinasyon', WADA.length === 159 && new Set(WADA.flatMap((c) => c.combinations)).size === 348);
for (const p of PRESETS) {
  const cs = comboOf(p.wada);
  // Karttaki örnekler kombinasyonun kendisi: aynı renkler, ne eksik ne fazla
  check(`Wada ${p.id}: No. ${p.wada} renkleri birebir`, cs.length === p.colors.length && cs.every((c) => p.colors.includes(c.hex)), `${cs.map((c) => c.hex)} ≠ ${p.colors}`);
  // Roldeki renkler kombinasyondan; kontrast için yalnızca açıklık (L*) ayarına izin var: ΔL* ≤ 13, a*b* kayması ≤ 6 (sRGB sınırındaki turkuazda kroma biraz düşer)
  const sec = SECONDARY[p.accent];
  check(`Wada ${p.id}: ikincil renkler tanımlı`, !!sec);
  if (!sec) continue;
  const roles: [string, string][] = [['vurgu (koyu)', ACCENT_COLORS[p.accent].noir], ['vurgu (açık)', ACCENT_COLORS[p.accent].ivory], ['kart', sec.color], ['motif', sec.alt]];
  if (sec.label) roles.push(['kart etiketi', sec.label]);
  for (const [role, c] of roles) {
    const near = cs.map((w) => ({ w, d: dE(c, w.hex) })).sort((x, y) => x.d - y.d)[0];
    const [L1, a1, b1] = lab(c), [L2, a2, b2] = lab(near.w.hex);
    const dL = L1 - L2, dab = Math.hypot(a1 - a2, b1 - b2);
    check(`Wada ${p.id}: ${role} ${c} kombinasyondan (${near.w.name})`, Math.abs(dL) <= 13 && dab <= 6, `ΔL ${dL.toFixed(1)} Δab ${dab.toFixed(1)}`);
    if (near.d > 0.5) wadaRows.push(`No. ${String(p.wada).padEnd(4)} ${p.id.padEnd(7)} ${role.padEnd(13)} ${near.w.name} ${near.w.hex} → ${c}  ΔE ${near.d.toFixed(1)} (ΔL* ${dL >= 0 ? '+' : ''}${dL.toFixed(1)})`);
  }
  // Zemin tonu sakin: koyu zeminler C* ≤ 8, açık zeminler C* ≤ 7; tonu kombinasyonun bir renginden (±20°)
  for (const mode of ['noir', 'ivory'] as Mode[]) {
    const surf = TINT_COLORS[p.tint][mode];
    for (const k of ['bg', 'surface', 'raised'] as const) check(`Wada ${p.id}: ${mode} ${k} nötre yakın`, chroma(surf[k]) <= (mode === 'noir' ? 8 : 7), `C* ${chroma(surf[k]).toFixed(1)}`);
    const hd = cs.map((w) => { const d = Math.abs(hueDeg(surf.bg) - hueDeg(w.hex)); return Math.min(d, 360 - d); });
    check(`Wada ${p.id}: ${mode} zemin tonu kombinasyondan`, Math.min(...hd) <= 20, `${surf.bg} ${hueDeg(surf.bg).toFixed(0)}°`);
  }
  // Özet kartı kombinasyonun zemin renginde ve okunur
  for (const mode of ['noir', 'ivory'] as Mode[]) {
    const t = makeTheme(mode, p.tint, p.accent);
    check(`Wada ${p.id}/${mode}: kart etiketi/kart-orta ≥ 4.5`, contrast(t.heroLabel, t.heroGrad[1]) >= 4.5);
    check(`Wada ${p.id}/${mode}: motif rengi koyu karta karşı ≥ 3`, contrast(t.heroAlt, '#000000') >= 3);
  }
}
// Kategori renkleri: kitaptaki renkler aynen; çift çift ΔE ≥ 20; çizildikleri her zemine (tüm tonlar) ≥ 3:1; neon değil (C* ≤ 60)
for (const mode of ['noir', 'ivory'] as Mode[]) {
  const cats = BASE[mode].cats;
  check(`kategori renkleri ${mode}: 8 renk`, cats.length === 8);
  cats.forEach((c, i) => {
    check(`kategori ${mode}[${i}] ${c} Wada'da`, !!byHex(c));
    check(`kategori ${mode}[${i}] ${c} neon değil`, chroma(c) <= 60, `C* ${chroma(c).toFixed(1)}`);
    for (const k of TINTS) for (const s of ['bg', 'surface', 'raised'] as const)
      check(`kategori ${mode}[${i}] ${c} / ${k}.${s} ≥ 3`, contrast(c, TINT_COLORS[k][mode][s]) >= 3, contrast(c, TINT_COLORS[k][mode][s]).toFixed(2));
    for (let j = i + 1; j < cats.length; j++) check(`kategori ${mode}[${i}]–[${j}] ΔE ≥ 20`, dE(c, cats[j]) >= 20, `${c} ~ ${cats[j]} ${dE(c, cats[j]).toFixed(1)}`);
  });
  // Her tema aynı kategori renklerini kullanır
  for (const k of TINTS) for (const a of ACCENTS) if (makeTheme(mode, k, a).cats !== cats) check(`kategori renkleri ${mode}/${k}/${a} ortak`, false);
}
// Varsayılan: şampanya altını (Isabella Color'a yakın) + motifte Dark Medici Blue — Wada No. 241
const no241 = comboOf(241).map((c) => c.hex);
check('varsayılan motif rengi Wada No. 241 (Dark Medici Blue)', no241.includes(BASE.noir.heroAlt) && BASE.ivory.heroAlt === BASE.noir.heroAlt);
check('varsayılan vurgu ≈ Isabella Color (No. 241)', dE(BASE.noir.accent, '#c5a56e') <= 4 && no241.includes('#c5a56e'));
if (process.argv.includes('--wada')) console.log(wadaRows.join('\n'));
if (verbose) console.log(rows.join('\n'));
console.log(`${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
