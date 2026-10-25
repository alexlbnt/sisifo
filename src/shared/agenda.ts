/**
 * Contrato da agenda (Google Calendar via iCal) entre a API e o Modo Painel.
 * Também usado pela API: só tipos, sem imports.
 */

export interface AgendaEvent {
  /** UID do evento + início da ocorrência (recorrências viram vários itens). */
  id: string;
  title: string;
  /** Início e fim em milissegundos (epoch). No dia inteiro, meia-noite local do dia. */
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
}

export interface AgendaResponse {
  /** false: não há GOOGLE_ICAL_URL no servidor; o painel mostra só as tarefas. */
  configured: boolean;
  /** Primeiro dia pedido (YYYY-MM-DD), no fuso informado. */
  date: string;
  /** Quantos dias a partir de `date`. */
  days: number;
  events: AgendaEvent[];
}
