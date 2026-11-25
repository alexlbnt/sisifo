/**
 * Comandos da casca nativa (Rust, em desktop/src). Só chamados dentro do
 * executável; o pacote do Tauri é importado sob demanda.
 */

export interface DesktopSettings {
  captureShortcut: string;
  autostart: boolean;
}

export type SetSettingsResult = { ok: true } | { ok: false; error: 'shortcut-in-use' | 'invalid' };

async function invoke<T = void>(command: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(command, args);
}

export const native = {
  /** O app abriu de verdade: a casca passa a abrir direto no site (já guardado para uso sem internet). */
  appReady: () => invoke('app_ready'),
  setTrayPending: (count: number) => invoke('set_tray_pending', { count }),
  hideCapture: () => invoke('hide_capture'),
  getDesktopSettings: () => invoke<DesktopSettings>('get_desktop_settings'),
  setDesktopSettings: (settings: DesktopSettings) => invoke<SetSettingsResult>('set_desktop_settings', { settings }),
  openPanel: () => invoke('open_panel'),
  openApp: () => invoke('open_app'),
};
