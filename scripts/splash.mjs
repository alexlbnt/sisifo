// Gera as telas de abertura do iPhone (apple-touch-startup-image), claro e escuro,
// e atualiza os <link> no index.html. Sem elas, o app instalado abre com um flash branco.
// Uso: npm run splash   (rode de novo se trocar o logo ou as cores de fundo)
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAssets } from '@vite-pwa/assets-generator/api/generate-assets';
import { generateHtmlMarkup } from '@vite-pwa/assets-generator/api/generate-html-markup';
import { instructions } from '@vite-pwa/assets-generator/api/instructions';
import { combinePresetAndAppleSplashScreens, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Mesmas cores de fundo do app (--bg em src/index.css).
const LIGHT_BG = '#ebe7df';
const DARK_BG = '#0d0f0e';

// iPhones com tela sem botão (X em diante) e o SE de 4,7".
const DEVICES = [
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17',
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X', 'iPhone SE 4.7"',
];

const preset = combinePresetAndAppleSplashScreens(
  minimal2023Preset,
  {
    padding: 0.35,
    resizeOptions: { background: LIGHT_BG, fit: 'contain' },
    darkResizeOptions: { background: DARK_BG, fit: 'contain' },
    linkMediaOptions: { log: false, addMediaScreen: true, basePath: '/', xhtml: false },
    name: (landscape, size, dark) =>
      `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark' : 'light'}-${size.width}x${size.height}.png`,
  },
  DEVICES,
);

// Marca sem fundo, com cores que funcionam na abertura clara e na escura.
const svg = await readFile('scripts/brand/splash.svg');
const result = await instructions({
  imageResolver: () => svg,
  imageName: 'scripts/brand/splash.svg',
  preset,
  faviconPreset: '2023',
  htmlLinks: { xhtml: false, includeId: false },
  basePath: '/',
  resolveSvgName: (name) => name,
});

// Gera tudo numa pasta temporária e copia só as telas em retrato: os ícones
// do app já existem em public/ e não devem ser sobrescritos.
const tmp = join(tmpdir(), `sisifo-splash-${Date.now()}`);
await mkdir(join(tmp, 'splash'), { recursive: true });
await generateAssets(result, true, tmp);
await rm('public/splash', { recursive: true, force: true });
await mkdir('public/splash', { recursive: true });
const files = (await readdir(join(tmp, 'splash'))).filter((f) => f.includes('-portrait-'));
for (const f of files) await copyFile(join(tmp, 'splash', f), join('public/splash', f));
await rm(tmp, { recursive: true, force: true });

const links = generateHtmlMarkup(result).filter((l) => l.includes('apple-touch-startup-image') && l.includes('-portrait-'));
const html = await readFile('index.html', 'utf8');
const START = '<!-- splash:start -->';
const END = '<!-- splash:end -->';
const block = `${START}\n    ${links.join('\n    ')}\n    ${END}`;
const next = html.includes(START)
  ? html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block)
  : html.replace('    <title>', `    <!-- Telas de abertura do iPhone (geradas por npm run splash) -->\n    ${block}\n    <title>`);
await writeFile('index.html', next);
console.log(`${files.length} telas de abertura geradas em public/splash e ${links.length} links no index.html.`);
