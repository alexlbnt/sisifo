import { Logo } from './Logo';

/** Tela de abertura: enquanto os dados do aparelho carregam ou o login é conferido. */
export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-label="Carregando">
      <Logo />
    </div>
  );
}
