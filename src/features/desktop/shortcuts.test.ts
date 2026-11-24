import { describe, expect, it } from 'vitest';
import { formatShortcut, isSafeShortcut, shortcutFromEvent } from './shortcuts';

const key = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) => ({
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
  code,
});

describe('shortcutFromEvent', () => {
  it('monta o atalho no formato do Tauri', () => {
    expect(shortcutFromEvent(key('Space', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+Space');
    expect(shortcutFromEvent(key('KeyK', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+KeyK');
  });

  it('sem modificador não é atalho', () => {
    expect(shortcutFromEvent(key('Space'))).toBeNull();
  });

  it('só o modificador ainda não é atalho', () => {
    expect(shortcutFromEvent(key('ControlLeft', { ctrlKey: true }))).toBeNull();
    expect(shortcutFromEvent(key('AltLeft', { ctrlKey: true, altKey: true }))).toBeNull();
  });
});

describe('isSafeShortcut', () => {
  it('aceita Ctrl+Alt+Espaço', () => {
    expect(isSafeShortcut('Ctrl+Alt+Space')).toEqual({ ok: true });
  });

  it('recusa Ctrl+Alt com tecla que o AltGr usa no ABNT2', () => {
    expect(isSafeShortcut('Ctrl+Alt+KeyQ')).toEqual({
      ok: false,
      reason: 'No teclado ABNT2, Ctrl+Alt+Q digita "/". Escolha outra tecla ou inclua Shift.',
    });
    for (const code of ['Digit0', 'Digit9', 'Equal', 'KeyW', 'KeyE', 'KeyR', 'KeyC', 'BracketLeft', 'BracketRight', 'IntlBackslash', 'Slash']) {
      expect(isSafeShortcut(`Ctrl+Alt+${code}`).ok).toBe(false);
    }
  });

  it('com Shift junto, as mesmas teclas valem', () => {
    expect(isSafeShortcut('Ctrl+Alt+Shift+KeyQ')).toEqual({ ok: true });
  });
});

describe('formatShortcut', () => {
  it('mostra o atalho em português', () => {
    expect(formatShortcut('Ctrl+Alt+Space')).toBe('Ctrl + Alt + Espaço');
    expect(formatShortcut('Ctrl+Shift+KeyK')).toBe('Ctrl + Shift + K');
    expect(formatShortcut('Ctrl+Alt+ArrowRight')).toBe('Ctrl + Alt + →');
  });
});
