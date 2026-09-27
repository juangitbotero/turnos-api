import { SUPPORT_EMAIL } from '@turnos/shared';

/**
 * Statement of reasons for a worker restriction — what the worker terms
 * (§11.2) and the Digital Services Act (art. 17) require: the facts, the rule
 * applied, the consequence with its end date, and how to ask a person to
 * review it. Composed here, in one place, so every suspension says the same
 * things the same way.
 *
 * Written in the worker's language (`Worker.preferredLanguage`) because it is
 * sent from background code with no request to read the language from.
 */

export type RestrictionKind =
  | 'LATE_CANCEL_SUSPENSION'  // 2 late cancellations in 30 days → 7 days
  | 'NO_SHOW_SUSPENSION'      // 1st no-show → 30 days + automatic 1★
  | 'NO_SHOW_BLOCK';          // 2nd no-show → account blocked

export interface RestrictionFacts {
  shiftTitle: string;
  shiftDate: string;          // YYYY-MM-DD
  companyName?: string | null;
  until?: Date | null;        // end of a suspension; absent for a block
  lateCancelDates?: string[]; // ISO timestamps of the strikes that count
}

export interface RestrictionNotice {
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  /** Full statement — stored on Worker.restrictionReason and emailed. */
  statement: string;
}

const fmtDate = (d: Date | string) => {
  const iso = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
};

export function restrictionNotice(
  kind: RestrictionKind,
  facts: RestrictionFacts,
  language: string | null | undefined,
): RestrictionNotice {
  return language === 'en' ? english(kind, facts) : portuguese(kind, facts);
}

function portuguese(kind: RestrictionKind, f: RestrictionFacts): RestrictionNotice {
  const shift = `"${f.shiftTitle}" de ${fmtDate(f.shiftDate)}${f.companyName ? ` (${f.companyName})` : ''}`;
  const review =
    `Podes pedir que uma pessoa da equipa Turnos reveja esta decisão e apresentar a tua versão dos factos: ` +
    `escreve para ${SUPPORT_EMAIL}. Respondemos em até 48 horas.`;

  if (kind === 'LATE_CANCEL_SUSPENSION') {
    const dates = (f.lateCancelDates ?? []).map(fmtDate).join(' e ');
    return {
      pushTitle: 'Candidaturas suspensas por 7 dias',
      pushBody: `2 cancelamentos tardios em 30 dias. Podes voltar a candidatar-te a ${fmtDate(f.until!)}. Toca para ver o motivo.`,
      emailSubject: 'A tua conta Turnos foi suspensa por 7 dias',
      statement: [
        `Factos: cancelaste turnos confirmados a menos de 24 horas do início em ${dates}. O mais recente foi o turno ${shift}.`,
        `Regra aplicada: Política de Cancelamento e Faltas, "Cancelamentos pelo Trabalhador" — 2 cancelamentos tardios em 30 dias suspendem as candidaturas durante 7 dias.`,
        `Consequência: não te podes candidatar a turnos até ${fmtDate(f.until!)}. Os turnos que já confirmaste mantêm-se.`,
        `Se um dos cancelamentos teve um motivo válido (doença, lesão, emergência), envia-nos o comprovativo: se for aceite, o cancelamento é retirado e a suspensão levantada.`,
        review,
      ].join('\n\n'),
    };
  }

  if (kind === 'NO_SHOW_SUSPENSION') {
    return {
      pushTitle: 'Falta registada — conta suspensa por 30 dias',
      pushBody: `A empresa registou que faltaste ao turno "${f.shiftTitle}". Toca para ver o motivo e pedir revisão.`,
      emailSubject: 'Falta registada — a tua conta Turnos foi suspensa por 30 dias',
      statement: [
        `Factos: a empresa registou que não compareceste ao turno ${shift}, que tinhas confirmado.`,
        `Regra aplicada: Política de Cancelamento e Faltas, "Faltas" — a 1.ª falta dá uma avaliação automática de 1 estrela e suspende as candidaturas durante 30 dias.`,
        `Consequência: avaliação de 1 estrela neste turno, e não te podes candidatar a turnos até ${fmtDate(f.until!)}. Uma 2.ª falta bloqueia a conta.`,
        `Se estiveste no turno, ou faltaste por motivo de força maior, diz-nos: se a falta não se confirmar, a avaliação e a suspensão são retiradas.`,
        review,
      ].join('\n\n'),
    };
  }

  return {
    pushTitle: 'Conta bloqueada',
    pushBody: `2.ª falta registada (turno "${f.shiftTitle}"). Toca para ver o motivo e pedir revisão.`,
    emailSubject: 'A tua conta Turnos foi bloqueada',
    statement: [
      `Factos: a empresa registou que não compareceste ao turno ${shift}. É a tua 2.ª falta registada.`,
      `Regra aplicada: Política de Cancelamento e Faltas, "Faltas" — a 2.ª falta bloqueia a conta.`,
      `Consequência: deixas de te poder candidatar a turnos na Turnos. Os turnos que já trabalhaste continuam a ser-te pagos.`,
      `Se estiveste no turno, ou faltaste por motivo de força maior, diz-nos: se a falta não se confirmar, o bloqueio é levantado.`,
      review,
    ].join('\n\n'),
  };
}

function english(kind: RestrictionKind, f: RestrictionFacts): RestrictionNotice {
  const shift = `"${f.shiftTitle}" on ${fmtDate(f.shiftDate)}${f.companyName ? ` (${f.companyName})` : ''}`;
  const review =
    `You can ask a person on the Turnos team to review this decision and give your side of the story: ` +
    `write to ${SUPPORT_EMAIL}. We reply within 48 hours.`;

  if (kind === 'LATE_CANCEL_SUSPENSION') {
    const dates = (f.lateCancelDates ?? []).map(fmtDate).join(' and ');
    return {
      pushTitle: 'Applications suspended for 7 days',
      pushBody: `2 late cancellations in 30 days. You can apply again on ${fmtDate(f.until!)}. Tap to see why.`,
      emailSubject: 'Your Turnos account has been suspended for 7 days',
      statement: [
        `Facts: you cancelled confirmed shifts less than 24 hours before they started on ${dates}. The most recent was the shift ${shift}.`,
        `Rule applied: Cancellation and No-Show Policy, "Cancellations by the worker" — 2 late cancellations within 30 days suspend applications for 7 days.`,
        `Consequence: you cannot apply to shifts until ${fmtDate(f.until!)}. Shifts you have already confirmed are unaffected.`,
        `If one of the cancellations had a valid reason (illness, injury, emergency), send us the evidence: if it is accepted, the cancellation is removed and the suspension lifted.`,
        review,
      ].join('\n\n'),
    };
  }

  if (kind === 'NO_SHOW_SUSPENSION') {
    return {
      pushTitle: 'No-show recorded — account suspended for 30 days',
      pushBody: `The company recorded that you missed the shift "${f.shiftTitle}". Tap to see why and ask for a review.`,
      emailSubject: 'No-show recorded — your Turnos account has been suspended for 30 days',
      statement: [
        `Facts: the company recorded that you did not attend the shift ${shift}, which you had confirmed.`,
        `Rule applied: Cancellation and No-Show Policy, "No-shows" — a 1st no-show gives an automatic 1-star rating and suspends applications for 30 days.`,
        `Consequence: a 1-star rating for this shift, and you cannot apply to shifts until ${fmtDate(f.until!)}. A 2nd no-show blocks the account.`,
        `If you were at the shift, or missed it for reasons beyond your control, tell us: if the no-show is not confirmed, the rating and the suspension are removed.`,
        review,
      ].join('\n\n'),
    };
  }

  return {
    pushTitle: 'Account blocked',
    pushBody: `2nd no-show recorded (shift "${f.shiftTitle}"). Tap to see why and ask for a review.`,
    emailSubject: 'Your Turnos account has been blocked',
    statement: [
      `Facts: the company recorded that you did not attend the shift ${shift}. This is your 2nd recorded no-show.`,
      `Rule applied: Cancellation and No-Show Policy, "No-shows" — a 2nd no-show blocks the account.`,
      `Consequence: you can no longer apply to shifts on Turnos. Shifts you have already worked are still paid.`,
      `If you were at the shift, or missed it for reasons beyond your control, tell us: if the no-show is not confirmed, the block is lifted.`,
      review,
    ].join('\n\n'),
  };
}

/** Plain-text statement → minimal HTML for the email body. */
export function statementToHtml(statement: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return statement.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('\n');
}
