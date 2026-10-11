import { create } from 'zustand';
import { MAX_CHANGES_PER_REQUEST, type SyncChange } from '@/shared/sync';
import { api, HttpError, NetworkError } from './api';
import {
  applyRecords,
  clearLocalData,
  hasLocalData,
  recordKey,
  snapshot,
  subscribeLocalChanges,
} from './collections';
import { detectChanges, hashValue, selectRemoteToApply, type Outbox, type Shadow } from './diff';

/* ───────── Estado visível para a interface ───────── */

export type SyncStatus =
  | 'disabled' // sem servidor configurado ou sem login: tudo só no aparelho
  | 'syncing'
  | 'synced'
  | 'offline' // sem internet: alterações ficam guardadas e sobem depois
  | 'error'
  | 'needs-link'; // primeira vez: servidor vazio e aparelho com dados

interface SyncUiState {
  status: SyncStatus;
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
}

export const useSyncStore = create<SyncUiState>()(() => ({
  status: 'disabled',
  pending: 0,
  lastSyncAt: null,
  error: null,
}));

/* ───────── Estado persistido do motor ───────── */

const STORAGE_KEY = 'sisifo:sync';

interface EngineState {
  /** Último `seq` recebido do servidor. */
  cursor: string | null;
  /** Já fez a primeira sincronização neste aparelho. */
  linked: boolean;
  /** Hash de cada item na última vez que o motor olhou. */
  shadow: Shadow;
  /** Alterações locais ainda não confirmadas pelo servidor. */
  outbox: Outbox;
  lastSyncAt: string | null;
}

const emptyState = (): EngineState => ({ cursor: null, linked: false, shadow: {}, outbox: {}, lastSyncAt: null });

function load(): EngineState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyState(), ...(JSON.parse(raw) as EngineState) } : emptyState();
  } catch {
    return emptyState();
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sem espaço/acesso ao storage: segue em memória nesta sessão.
  }
  useSyncStore.setState({ pending: Object.keys(state.outbox).length, lastSyncAt: state.lastSyncAt });
}

/* ───────── Ciclo de sincronização ───────── */

let enabled = false;
let running = false;
let rerun = false;
let applyingRemote = false;
let unsubscribe: (() => void) | null = null;
let detectTimer: ReturnType<typeof setTimeout> | undefined;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let onUnauthorized: () => void = () => {};

const DETECT_DELAY = 400;
const PUSH_DELAY = 1500;
const POLL_MS = 60_000;

function captureLocalChanges() {
  const { shadow, changes } = detectChanges(snapshot(), state.shadow, new Date().toISOString());
  state.shadow = shadow;
  for (const change of changes) state.outbox[recordKey(change.collection, change.id)] = change;
  if (changes.length) save();
  return changes.length;
}

function applyRemote(changes: SyncChange[]) {
  const toApply = selectRemoteToApply(changes, state.shadow, state.outbox);
  for (const change of changes) {
    const key = recordKey(change.collection, change.id);
    const pending = state.outbox[key];
    // O servidor já tem esta alteração (ou uma mais nova): não precisa reenviar.
    if (pending && pending.updatedAt <= change.updatedAt) delete state.outbox[key];
  }
  if (!toApply.length) return;
  for (const change of toApply) {
    const key = recordKey(change.collection, change.id);
    if (change.data === null) delete state.shadow[key];
    else state.shadow[key] = hashValue(change.data);
  }
  applyingRemote = true;
  try {
    applyRecords(toApply, 'merge');
  } finally {
    applyingRemote = false;
  }
}

function scheduleSync(delay = PUSH_DELAY) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), delay);
}

function handleError(error: unknown) {
  if (error instanceof HttpError && error.status === 401) {
    stop();
    useSyncStore.setState({ status: 'disabled', error: null });
    onUnauthorized();
    return;
  }
  const offline = error instanceof NetworkError || !navigator.onLine;
  useSyncStore.setState({
    status: offline ? 'offline' : 'error',
    error: offline ? null : error instanceof Error ? error.message : 'Erro ao sincronizar.',
  });
}

/** Envia o que mudou e traz o que mudou nos outros aparelhos, até zerar a fila. */
export async function syncNow(): Promise<void> {
  if (!enabled || !state.linked) return;
  if (running) {
    rerun = true;
    return;
  }
  if (!navigator.onLine) {
    useSyncStore.setState({ status: 'offline' });
    return;
  }
  running = true;
  useSyncStore.setState({ status: 'syncing', error: null });
  try {
    captureLocalChanges();
    let more = true;
    while (more) {
      const batch = Object.values(state.outbox).slice(0, MAX_CHANGES_PER_REQUEST);
      const response = await api.sync({ cursor: state.cursor, changes: batch });
      for (const sent of batch) {
        const key = recordKey(sent.collection, sent.id);
        // Só sai da fila se não mudou de novo enquanto a requisição viajava.
        if (state.outbox[key]?.updatedAt === sent.updatedAt) delete state.outbox[key];
      }
      applyRemote(response.changes);
      state.cursor = response.cursor;
      save();
      more = response.more || Object.keys(state.outbox).length > 0;
    }
    state.lastSyncAt = new Date().toISOString();
    save();
    useSyncStore.setState({ status: 'synced' });
  } catch (error) {
    handleError(error);
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      scheduleSync(0);
    }
  }
}

/** Busca tudo o que há no servidor (primeira sincronização). */
async function pullEverything(): Promise<{ changes: SyncChange[]; cursor: string | null }> {
  const all: SyncChange[] = [];
  let cursor: string | null = null;
  let more = true;
  while (more) {
    const response = await api.sync({ cursor, changes: [] });
    all.push(...response.changes);
    cursor = response.cursor;
    more = response.more;
  }
  return { changes: all, cursor };
}

function onLocalChange() {
  if (applyingRemote || !enabled || !state.linked) return;
  clearTimeout(detectTimer);
  detectTimer = setTimeout(() => {
    if (captureLocalChanges()) scheduleSync();
  }, DETECT_DELAY);
}

const onOnline = () => scheduleSync(0);
const onVisible = () => {
  if (document.visibilityState === 'visible') scheduleSync(0);
};

function listen() {
  unsubscribe ??= subscribeLocalChanges(onLocalChange);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  clearInterval(interval);
  interval = setInterval(() => void syncNow(), POLL_MS);
}

function stop() {
  enabled = false;
  unsubscribe?.();
  unsubscribe = null;
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
  clearInterval(interval);
  clearTimeout(detectTimer);
  clearTimeout(syncTimer);
}

/* ───────── API pública ───────── */

/** Liga a sincronização (depois do login, ou ao abrir o app já logado). */
export async function startSync(handlers: { onUnauthorized: () => void }): Promise<void> {
  onUnauthorized = handlers.onUnauthorized;
  enabled = true;
  save();

  if (!state.linked) {
    if (!navigator.onLine) {
      useSyncStore.setState({ status: 'offline' });
      window.addEventListener('online', () => void startSync(handlers), { once: true });
      return;
    }
    useSyncStore.setState({ status: 'syncing' });
    try {
      const remote = await pullEverything();
      if (remote.changes.some((c) => c.data !== null)) {
        // O servidor já tem dados (outro aparelho): eles substituem os deste aparelho.
        applyingRemote = true;
        try {
          applyRecords(remote.changes, 'replace');
        } finally {
          applyingRemote = false;
        }
        state = { ...emptyState(), linked: true, cursor: remote.cursor };
        captureLocalChanges();
        // Só fica na fila o que o servidor ainda não tem igual: por exemplo, dados
        // no formato antigo convertidos aqui ou as categorias de fábrica.
        const remoteHash = new Map(
          remote.changes.map((c) => [recordKey(c.collection, c.id), c.data === null ? null : hashValue(c.data)]),
        );
        for (const [key, change] of Object.entries(state.outbox)) {
          if (remoteHash.get(key) === hashValue(change.data)) delete state.outbox[key];
        }
        save();
      } else if (hasLocalData()) {
        // Servidor vazio e aparelho com dados: a pessoa decide (ver resolveFirstLink).
        state.cursor = remote.cursor;
        save();
        useSyncStore.setState({ status: 'needs-link' });
        return;
      } else {
        state = { ...emptyState(), linked: true, cursor: remote.cursor };
        save();
      }
    } catch (error) {
      handleError(error);
      return;
    }
  }

  listen();
  await syncNow();
}

/** Primeira sincronização com servidor vazio: enviar os dados deste aparelho ou começar do zero. */
export async function resolveFirstLink(choice: 'upload' | 'empty'): Promise<void> {
  if (choice === 'empty') {
    applyingRemote = true;
    try {
      clearLocalData();
    } finally {
      applyingRemote = false;
    }
  }
  state = { ...state, linked: true, shadow: {}, outbox: {} };
  save();
  listen();
  await syncNow();
}

/** Ao sair: para tudo e apaga a cópia local e o estado da sincronização. */
export function resetSync() {
  stop();
  state = emptyState();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
  applyingRemote = true;
  try {
    clearLocalData();
  } finally {
    applyingRemote = false;
  }
  useSyncStore.setState({ status: 'disabled', pending: 0, lastSyncAt: null, error: null });
}

export function disableSync() {
  stop();
  useSyncStore.setState({ status: 'disabled' });
}
