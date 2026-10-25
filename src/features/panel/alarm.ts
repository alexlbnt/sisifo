import type { PomodoroPhase } from './pomodoro';

/**
 * Alerta de fim de etapa: bipes gerados na hora (Web Audio, sem arquivo) e vibração.
 * O navegador só libera som e vibração depois de um toque na página; `unlockAudio`
 * é chamado nos botões do Pomodoro para isso.
 */

let context: AudioContext | null = null;

export function unlockAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    // Sem Web Audio: fica só a vibração.
  }
}

/** Fim do foco: três bipes agudos. Fim da pausa: dois graves (hora de voltar). */
const PATTERN: Record<PomodoroPhase, { freq: number; beeps: number }> = {
  focus: { freq: 880, beeps: 3 },
  short: { freq: 587, beeps: 2 },
  long: { freq: 587, beeps: 2 },
};

function beep(phase: PomodoroPhase) {
  unlockAudio();
  if (!context || context.state !== 'running') return;
  const { freq, beeps } = PATTERN[phase];
  const t0 = context.currentTime + 0.05;
  for (let i = 0; i < beeps; i++) {
    const at = t0 + i * 0.32;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Envelope curto para não estalar.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.25);
  }
}

export function playAlarm(phase: PomodoroPhase, options: { sound: boolean; vibrate: boolean }) {
  if (options.sound) beep(phase);
  if (options.vibrate) {
    try {
      navigator.vibrate?.(phase === 'focus' ? [300, 150, 300, 150, 300] : [400, 200, 400]);
    } catch {
      // Sem vibração, sem problema.
    }
  }
}
