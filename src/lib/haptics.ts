/**
 * Vibração curta para confirmar uma ação (concluir tarefa, salvar gasto).
 *
 * Android: API de vibração. iPhone: o Safari não tem essa API, mas desde o
 * iOS 18 alternar um interruptor (<input type="checkbox" switch>) vibra. O truque
 * é clicar num rótulo escondido desse interruptor. Precisa vir de um toque da
 * pessoa; fora disso (ou em versões antigas) simplesmente não vibra.
 */
export function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
      return;
    }
    if (typeof document === 'undefined') return;
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Sem vibração, sem problema.
  }
}
