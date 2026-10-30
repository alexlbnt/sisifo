// Sísifo · widget do dia para o app Scriptable (iPhone e iPad)
// Versão 1 · lê GET /api/summary?format=widget (formato v1)
//
// Mostra na tela inicial ou de bloqueio o que falta hoje: tarefas, hábitos,
// quanto dá para gastar e o próximo compromisso.
//
// Como usar (passo a passo também em Configurações → Atalhos do iPhone):
// 1. No Scriptable, toque em + e cole este script. Dê o nome "Sísifo".
// 2. Toque em ▶︎ uma vez: ele pede o endereço do Sísifo e a chave (sis_...).
//    A chave fica no Keychain do iPhone, nunca neste arquivo.
// 3. Na tela inicial, segure → + → Scriptable → escolha o tamanho → Editar
//    widget → Script: Sísifo. Na tela de bloqueio, os formatos pequenos também.
//
// O iOS decide quando atualizar (em geral a cada 15 a 60 minutos). Sem
// internet, o widget mostra a última leitura com a hora em que foi feita.

// Preenchido ao copiar pelo app (Configurações → Atalhos do iPhone). Vazio: o script pergunta.
const SISIFO_URL = '';

const KEY_URL = 'sisifo.url';
const KEY_TOKEN = 'sisifo.token';
const CACHE_FILE = 'sisifo-widget.json';
const REFRESH_MIN = 30;
const FORMAT_VERSION = 1;

const C = {
  bg: Color.dynamic(new Color('#eceee9'), new Color('#0f1311')),
  ink: Color.dynamic(new Color('#1a201e'), new Color('#e6eae7')),
  ink2: Color.dynamic(new Color('#4c5652'), new Color('#a9b3ae')),
  ink3: Color.dynamic(new Color('#737d78'), new Color('#7f8a85')),
  accent: Color.dynamic(new Color('#2e4a9e'), new Color('#93a6ef')),
  good: Color.dynamic(new Color('#1b7349'), new Color('#5cc493')),
  bad: Color.dynamic(new Color('#b2382f'), new Color('#f0827a')),
};

/* ───────── Configuração (Keychain) ───────── */

function saved(key) {
  return Keychain.contains(key) ? Keychain.get(key) : '';
}

function baseUrl() {
  return (saved(KEY_URL) || SISIFO_URL).replace(/\/+$/, '');
}

async function ask(title, message, placeholder, value, secure) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  if (secure) alert.addSecureTextField(placeholder, value);
  else alert.addTextField(placeholder, value);
  alert.addAction('Salvar');
  alert.addCancelAction('Cancelar');
  if ((await alert.presentAlert()) === -1) return null;
  return alert.textFieldValue(0).trim();
}

async function configure() {
  const url = await ask('Endereço do Sísifo', 'O endereço que você abre no Safari, ex.: https://sisifo.vercel.app', 'https://...', baseUrl(), false);
  if (url === null) return false;
  if (!/^https:\/\//.test(url)) {
    await notice('Endereço inválido', 'Use o endereço completo, começando com https://');
    return false;
  }
  const token = await ask('Chave de acesso', 'Crie em Configurações → Atalhos do iPhone. Ela fica no Keychain deste aparelho.', 'sis_...', '', true);
  if (token === null) return false;
  if (!token.startsWith('sis_')) {
    await notice('Chave inválida', 'A chave começa com sis_. Crie outra em Configurações → Atalhos do iPhone.');
    return false;
  }
  Keychain.set(KEY_URL, url.replace(/\/+$/, ''));
  Keychain.set(KEY_TOKEN, token);
  return true;
}

async function notice(title, message) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction('OK');
  await alert.presentAlert();
}

/* ───────── Dados ───────── */

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

function readCache() {
  try {
    return fm.fileExists(cachePath) ? JSON.parse(fm.readString(cachePath)) : null;
  } catch (e) {
    return null;
  }
}

/** { data, fetchedAt, stale, error } */
async function load() {
  const url = baseUrl();
  const token = saved(KEY_TOKEN);
  if (!url || !token) return { error: 'Toque para configurar o Sísifo no Scriptable.' };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const request = new Request(`${url}/api/summary?format=widget&tz=${encodeURIComponent(tz)}`);
  request.headers = { Authorization: `Bearer ${token}` };
  request.timeoutInterval = 15;
  try {
    const body = JSON.parse(await request.loadString());
    const status = request.response.statusCode;
    if (status === 200 && body.v) {
      const cached = { data: body, fetchedAt: Date.now() };
      fm.writeString(cachePath, JSON.stringify(cached));
      return cached;
    }
    // 401: chave revogada; 503: servidor sem banco. A mensagem vem do Sísifo.
    return { error: body.message || `O Sísifo respondeu ${status}.` };
  } catch (e) {
    const cached = readCache();
    return cached ? { ...cached, stale: true } : { error: 'Sem conexão com o Sísifo.' };
  }
}

/* ───────── Desenho ───────── */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const clock = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function text(container, value, { size = 13, weight = 'regular', color = C.ink, lines = 1 } = {}) {
  const t = container.addText(String(value));
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'semibold' ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.75;
  return t;
}

function header(w, state) {
  const row = w.addStack();
  row.centerAlignContent();
  text(row, 'Sísifo', { size: 12, weight: 'bold', color: C.accent });
  row.addSpacer();
  if (state.fetchedAt) text(row, `${state.stale ? '⚠︎ ' : ''}${clock(state.fetchedAt)}`, { size: 10, color: state.stale ? C.bad : C.ink3 });
  w.addSpacer(6);
}

function counts(container, d, size) {
  const done = !d.tasks && !d.habits;
  if (done) {
    text(container, 'Tudo feito por hoje', { size, weight: 'semibold', color: C.good, lines: 2 });
    return;
  }
  if (d.tasks) text(container, plural(d.tasks, 'tarefa', 'tarefas'), { size, weight: 'semibold' });
  if (d.habits) text(container, plural(d.habits, 'hábito', 'hábitos'), { size, weight: 'semibold' });
  if (d.overdue) text(container, plural(d.overdue, 'atrasada', 'atrasadas'), { size: size - 3, color: C.bad });
}

function money(container, d) {
  if (d.allowance) text(container, `${d.allowance} hoje`, { size: 12, color: C.ink2 });
}

function next(container, d, size = 12) {
  if (d.next) text(container, `${d.next.time} · ${d.next.title}`, { size, color: C.accent, lines: 1 });
}

function small(w, d) {
  counts(w, d, 17);
  w.addSpacer();
  money(w, d);
  next(w, d, 11);
}

function medium(w, d, rows) {
  const body = w.addStack();
  const left = body.addStack();
  left.layoutVertically();
  counts(left, d, 17);
  left.addSpacer(4);
  money(left, d);
  body.addSpacer(12);
  const right = body.addStack();
  right.layoutVertically();
  next(right, d);
  // A tarefa que já aparece como próximo compromisso não se repete na lista.
  const isNext = (t) => d.next && t.title === d.next.title && t.time === d.next.time;
  const tasks = d.nextTasks.filter((t) => !isNext(t)).slice(0, rows);
  for (const t of tasks) text(right, `${t.time ? `${t.time} ` : '• '}${t.title}`, { size: 12, color: C.ink2 });
  for (const h of d.pendingHabits.slice(0, Math.max(0, rows - tasks.length))) text(right, `○ ${h}`, { size: 12, color: C.ink2 });
  w.addSpacer();
}

function errorView(w, message) {
  text(w, 'Sísifo', { size: 12, weight: 'bold', color: C.accent });
  w.addSpacer(6);
  text(w, message, { size: 12, color: C.ink2, lines: 4 });
}

function build(state, family) {
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
  const d = state.data;

  // Tela de bloqueio: o iOS pinta sozinho; só texto.
  if (family === 'accessoryInline') {
    text(w, d ? d.line : 'Sísifo: configurar');
    return w;
  }
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    text(w, d ? String(d.tasks + d.habits) : '?', { size: 22, weight: 'bold' }).centerAlignText();
    text(w, d ? 'faltam' : 'Sísifo', { size: 9 }).centerAlignText();
    return w;
  }
  if (family === 'accessoryRectangular') {
    if (!d) {
      text(w, state.error || 'Sísifo', { size: 12, lines: 3 });
      return w;
    }
    text(w, d.line, { size: 13, weight: 'semibold', lines: 2 });
    if (d.next) text(w, `${d.next.time} · ${d.next.title}`, { size: 12 });
    return w;
  }

  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  if (!d) {
    errorView(w, state.error);
    return w;
  }
  if (d.v > FORMAT_VERSION) {
    errorView(w, 'Há uma versão nova deste script: copie de novo em Configurações → Atalhos do iPhone.');
    return w;
  }
  header(w, state);
  if (family === 'small') small(w, d);
  else medium(w, d, family === 'large' || family === 'extraLarge' ? 8 : 3);
  return w;
}

/* ───────── Execução ───────── */

if (config.runsInWidget) {
  Script.setWidget(build(await load(), config.widgetFamily));
} else {
  // Aberto no app: configurar e ver como fica.
  if (!saved(KEY_TOKEN) || !baseUrl()) await configure();
  const menu = new Alert();
  menu.title = 'Sísifo';
  menu.message = 'Widget do dia';
  const options = [
    ['Ver pequeno', (s) => build(s, 'small').presentSmall()],
    ['Ver médio', (s) => build(s, 'medium').presentMedium()],
    ['Ver grande', (s) => build(s, 'large').presentLarge()],
    ['Ver tela de bloqueio', (s) => build(s, 'accessoryRectangular').presentAccessoryRectangular()],
    ['Trocar endereço ou chave', async () => (await configure()) && (await notice('Pronto', 'Configuração salva.'))],
    [
      'Apagar configuração',
      async () => {
        for (const key of [KEY_URL, KEY_TOKEN]) if (Keychain.contains(key)) Keychain.remove(key);
        if (fm.fileExists(cachePath)) fm.remove(cachePath);
        await notice('Pronto', 'Endereço, chave e última leitura apagados deste aparelho.');
      },
    ],
  ];
  for (const [label] of options) menu.addAction(label);
  menu.addCancelAction('Fechar');
  const choice = await menu.presentSheet();
  if (choice !== -1) {
    const action = options[choice][1];
    await action(choice < 4 ? await load() : null);
  }
}
Script.complete();
