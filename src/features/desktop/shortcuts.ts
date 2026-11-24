/**
 * Atalhos globais do executável, no formato do plugin global-shortcut do Tauri
 * ("Ctrl+Alt+Space": modificadores + `KeyboardEvent.code`).
 */

type KeyLike = Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'code'>;

const MODIFIER_CODES = /^(Control|Alt|Shift|Meta|OS)(Left|Right)?$/;

export function shortcutFromEvent(e: KeyLike): string | null {
  if (MODIFIER_CODES.test(e.code)) return null;
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!mods.length) return null;
  return [...mods, e.code].join('+');
}

/**
 * No Windows, Ctrl+Alt é o mesmo que AltGr: no teclado ABNT2 estas teclas
 * digitam um caractere, e um atalho global nelas roubaria a digitação.
 */
const ALTGR_ABNT2: Record<string, string | null> = {
  Digit1: '¹',
  Digit2: '²',
  Digit3: '³',
  Digit4: '£',
  Digit5: '¢',
  Digit6: '¬',
  Digit7: null,
  Digit8: null,
  Digit9: null,
  Digit0: null,
  Equal: '§',
  KeyQ: '/',
  KeyW: '?',
  KeyE: '°',
  KeyR: '®',
  KeyC: '₢',
  BracketLeft: 'ª',
  BracketRight: 'º',
  IntlBackslash: null,
  Slash: '°',
};

export function isSafeShortcut(s: string): { ok: true } | { ok: false; reason: string } {
  const parts = s.split('+');
  const code = parts.at(-1)!;
  const mods = new Set(parts.slice(0, -1));
  const onlyCtrlAlt = mods.size === 2 && mods.has('Ctrl') && mods.has('Alt');
  if (onlyCtrlAlt && code in ALTGR_ABNT2) {
    const char = ALTGR_ABNT2[code];
    const what = char ? `digita "${char}"` : 'pode digitar um caractere';
    return { ok: false, reason: `No teclado ABNT2, Ctrl+Alt+${keyLabel(code)} ${what}. Escolha outra tecla ou inclua Shift.` };
  }
  return { ok: true };
}

const NAMED: Record<string, string> = {
  Space: 'Espaço',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Equal: '=',
  Minus: '-',
  Comma: ',',
  Period: '.',
  Slash: ';',
  BracketLeft: '´',
  BracketRight: '[',
  IntlBackslash: '\\',
};

function keyLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  return m ? m[1]! : code;
}

export function formatShortcut(s: string): string {
  const parts = s.split('+');
  return [...parts.slice(0, -1).map((m) => (m === 'Super' ? 'Win' : m)), keyLabel(parts.at(-1)!)].join(' + ');
}
