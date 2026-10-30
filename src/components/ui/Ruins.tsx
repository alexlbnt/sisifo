import { useEffect, useRef } from 'react';
import { forEachDot } from '@/lib/ruins/dither';
import { buildScene, type SceneKind } from '@/lib/ruins/scenes';
import { cn } from '@/lib/cn';

interface RuinsProps {
  kind: SceneKind;
  /** Posição e tamanho: o canvas ocupa este elemento inteiro. */
  className?: string;
  /** Multiplica a intensidade por posição relativa (0..1): apaga as colunas atrás de textos. */
  mask?: (x: number, y: number) => number;
}

/** Tamanho de cada célula da grade, em px CSS, e do ponto desenhado nela. */
const CELL = 2;
const DOT = 1.25;
const RESIZE_DEBOUNCE = 150;

/**
 * Ruínas gregas em pontilhado, desenhadas num canvas. Ficam paradas: o desenho
 * acontece ao montar e só se repete quando o tamanho ou o tema mudam.
 */
export function Ruins({ kind, className, mask }: RuinsProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef(mask);
  maskRef.current = mask;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // A cor é lida na hora do desenho, depois que a classe do tema já mudou.
      const style = getComputedStyle(canvas);
      ctx.fillStyle = style.getPropertyValue('--ruins').trim() || '#888';
      // O fundo das telas usa uma opacidade própria, menor: fica atrás de textos e números.
      const alpha = style.getPropertyValue(kind === 'backdrop' ? '--ruins-backdrop-alpha' : '--ruins-alpha');
      ctx.globalAlpha = Number.parseFloat(alpha) || 0.5;
      const grid = buildScene(kind, Math.floor(width / CELL), Math.floor(height / CELL));
      const sx = width / grid.cols;
      const sy = height / grid.rows;
      forEachDot(grid, (x, y) => ctx.fillRect(x * sx, y * sy, DOT, DOT), maskRef.current);
    };

    paint();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(paint, RESIZE_DEBOUNCE);
    };
    const resize = new ResizeObserver(later);
    resize.observe(canvas);
    // O tema muda pela classe `dark` no <html> (Configurações ou o modo noturno do painel).
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      clearTimeout(timer);
      resize.disconnect();
      theme.disconnect();
    };
  }, [kind]);

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none block', className)} />;
}
