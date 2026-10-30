/**
 * Registro de erros sem dados pessoais. Também usado pela API: só pacotes e
 * imports relativos `.js`. O app limpa antes de enviar e o servidor limpa de novo.
 */
import { z } from 'zod';

export const ERROR_KINDS = ['window', 'promise', 'sync', 'api'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const errorReportSchema = z.object({
  kind: z.enum(ERROR_KINDS),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(200).optional(),
  appVersion: z.string().max(20).optional(),
  device: z.string().max(80).optional(),
});

export type ErrorReport = z.infer<typeof errorReportSchema>;

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
/** Texto entre aspas maior que isso pode ser conteúdo (título, nota): sai. */
const MAX_QUOTED = 24;

/**
 * Tira da mensagem o que pode ser dado pessoal: valores em dinheiro, números
 * com 3 dígitos ou mais (valores, datas, ids), e-mails, endereços e textos
 * longos entre aspas. Nomes de propriedade e de função ficam.
 */
export function scrubMessage(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
    .replace(/https?:\/\/\S+/g, (url) => url.replace(/[?#].*$/, ''))
    .replace(/(["'“”‘’`])([^"'“”‘’`]*)\1/g, (match, quote: string, inner: string) =>
      inner.length > MAX_QUOTED ? `${quote}…${quote}` : match,
    )
    .replace(/R\$\s?[\d.,]+/g, 'R$ #')
    .replace(/\d[\d.,:/-]{2,}\d|\d{3,}/g, '#')
    .trim()
    .slice(0, MAX_MESSAGE);
}

/** Pilha: só as linhas de código (arquivo:linha:coluna), sem query string. */
export function scrubStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack
    .split('\n')
    .slice(1) // a primeira linha repete a mensagem (já limpa à parte)
    .map((line) => line.trim().replace(/\?[^:)\s]*/g, ''))
    .filter((line) => /:\d+(:\d+)?\)?$/.test(line))
    .slice(0, 20);
  return lines.length ? lines.join('\n').slice(0, MAX_STACK) : undefined;
}

/** Rota sem query string nem fragmento (podem ter texto digitado). */
export function scrubRoute(route: string | undefined): string | undefined {
  if (!route) return undefined;
  return route.replace(/[?#].*$/, '').slice(0, 100) || '/';
}

/** Mesmo erro = mesmo tipo, mesma mensagem e mesma primeira linha da pilha. */
export function fingerprintOf(report: Pick<ErrorReport, 'kind' | 'message' | 'stack'>): string {
  const firstFrame = report.stack?.split('\n')[0]?.replace(/:\d+:\d+/g, '') ?? '';
  const text = `${report.kind}|${report.message}|${firstFrame}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Relatório pronto para gravar: tudo limpo e cortado. */
export function cleanReport(report: ErrorReport): ErrorReport {
  return {
    kind: report.kind,
    message: scrubMessage(report.message) || 'Erro sem mensagem',
    stack: scrubStack(report.stack),
    route: scrubRoute(report.route),
    appVersion: report.appVersion?.slice(0, 20),
    device: report.device?.slice(0, 60),
  };
}

/** "iOS 18 · Safari · instalado", sem guardar o user agent inteiro. */
export function deviceLabel(userAgent: string, standalone = false): string {
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d+)/.exec(userAgent);
  const android = /Android (\d+)/.exec(userAgent);
  const system = ios
    ? `iOS ${ios[1]}`
    : android
      ? `Android ${android[1]}`
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Outro';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(userAgent)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Navegador';
  return [system, browser, standalone && 'instalado'].filter(Boolean).join(' · ');
}
