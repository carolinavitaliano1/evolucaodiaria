/**
 * Helpers para identificar/renderizar o tipo de uma sessão extra
 * (Avulso, Reposição, Anteposição) a partir de tags inseridas no
 * campo `notes` (Appointment) ou `text` (Evolution).
 *
 * Tags suportadas (case-insensitive):
 *   [tipo:avulsa]
 *   [tipo:reposicao]
 *   [tipo:anteposicao]
 *   [reposicao:<evolution_id>]      → vínculo a falta passada
 *   [anteposicao:<evolution_id>]    → vínculo a falta futura
 *   [reposta_por:<evolution_id>]    → marcador na falta original
 */

export type SessionKind = 'avulsa' | 'reposicao' | 'anteposicao' | 'regular';

const RX_TIPO = /\[tipo:(avulsa|reposicao|anteposicao)\]/i;
const RX_REPO = /\[reposicao:([0-9a-f-]{6,})\]/i;
const RX_ANTE = /\[anteposicao:([0-9a-f-]{6,})\]/i;
const RX_REPOSTA = /\[reposta_por:([0-9a-f-]{6,})\]/i;

/** Lê o tipo da sessão a partir do texto livre (notes/text). */
export function getSessionKind(text?: string | null): SessionKind {
  if (!text) return 'regular';
  // Vínculos têm prioridade — Anteposição é tratada como subtipo de reposição.
  if (RX_ANTE.test(text)) return 'anteposicao';
  if (RX_REPO.test(text)) return 'reposicao';
  const m = text.match(RX_TIPO);
  if (!m) return 'regular';
  const v = m[1].toLowerCase();
  if (v === 'avulsa' || v === 'reposicao' || v === 'anteposicao') return v;
  return 'regular';
}

/** ID da evolução-falta que está sendo reposta/anteposta. */
export function getLinkedAbsenceId(text?: string | null): string | null {
  if (!text) return null;
  const a = text.match(RX_ANTE);
  if (a) return a[1];
  const r = text.match(RX_REPO);
  if (r) return r[1];
  return null;
}

/** ID da evolução de reposição que substituiu esta falta. */
export function getReplacedByEvolutionId(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(RX_REPOSTA);
  return m ? m[1] : null;
}

/** Remove todas as tags internas para exibição limpa. */
export function stripSessionTags(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(RX_TIPO, '')
    .replace(RX_REPO, '')
    .replace(RX_ANTE, '')
    .replace(RX_REPOSTA, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const SESSION_KIND_LABEL: Record<Exclude<SessionKind, 'regular'>, string> = {
  avulsa: 'Avulso',
  reposicao: 'Reposição',
  anteposicao: 'Anteposição',
};

/** Classes Tailwind para badge colorido por tipo. */
export const SESSION_KIND_BADGE: Record<Exclude<SessionKind, 'regular'>, string> = {
  avulsa: 'bg-orange-100 text-orange-800 border border-orange-300',
  reposicao: 'bg-blue-100 text-blue-800 border border-blue-300',
  anteposicao: 'bg-purple-100 text-purple-800 border border-purple-300',
};