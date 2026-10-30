// Gera os ícones do app instalado a partir da marca (a pedra na encosta).
// O ícone na tela inicial não acompanha o tema, então vale a versão escura.
// Uso: npm run icons   (rode de novo se trocar o logo ou as cores)
import sharp from 'sharp';

const BG = '#0d0f0e';
const LINE = '#e6eae7';
const STONE = '#93a6ef';

// A marca no viewBox 32×32 do Logo; o centro visual fica perto de (16, 16).
const MARK = `<path d="M5 25 L27 9" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="14.6" cy="10.6" r="5" fill="${STONE}"/>`;
const MARK_SPAN = 24.5;

/** SVG quadrado com a marca ocupando `fill` da largura, centralizada. */
function icon(size, fill) {
  const scale = (size * fill) / MARK_SPAN;
  const offset = size / 2 - 16 * scale;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="${BG}"/>` +
      `<g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g></svg>`,
  );
}

const ICONS = [
  { file: 'public/pwa-192.png', size: 192, fill: 0.6 },
  { file: 'public/pwa-512.png', size: 512, fill: 0.6 },
  // Maskable: o sistema recorta as bordas; a marca fica dentro da área segura (80%).
  { file: 'public/maskable-512.png', size: 512, fill: 0.5 },
  { file: 'public/apple-touch-icon.png', size: 180, fill: 0.6 },
];

for (const { file, size, fill } of ICONS) {
  await sharp(icon(size, fill)).png().toFile(file);
}
console.log(`${ICONS.length} ícones gerados em public/.`);
