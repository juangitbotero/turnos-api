import { BUSINESS_TIME_ZONE } from '../common/lisbon-time';

/**
 * One template for every email to the Turnos team (OPS_EMAIL).
 *
 * Before 2026-10-11 each alert was built inline and carried database ids, raw
 * enum codes (`TURNOS_PAY_LINK`) and no names, contacts or proof link — the
 * team could not act on one without querying the database. Every alert now
 * has the same shape:
 *
 *   subject  [PAG-94C47B] Não-pagamento · Carolina Bakes · €60,00
 *   body     what happened (one line) → the facts as a table → links
 *            (proof, Pay Link…) → "O que fazer" with the deadline the policy
 *            promises → buttons to email each party with the reference already
 *            in the subject.
 *
 * The reference is a prefix + the first 6 characters of the record's id, so
 * it is searchable in the inbox, quotable in replies, and resolves with
 * `WHERE id::text LIKE '94c47b%'`.
 *
 * Internal alerts stay Portuguese (the team's language). Every value passed
 * in is plain text and is escaped here — notes typed by companies and workers
 * end up in these emails.
 */

export interface OpsContact {
  /** Button label, e.g. "Escrever à empresa" */
  label: string;
  email?: string | null;
}

export interface OpsCase {
  /** From opsRef(), e.g. PAG-94C47B */
  ref: string;
  /** Short case type, e.g. "Não-pagamento" */
  kind: string;
  /** Extra subject parts after the kind — company, amount… (empty ones dropped) */
  subjectParts?: Array<string | null | undefined>;
  /** One line: what happened */
  summary: string;
  /** Label → value rows; rows whose value is empty are left out */
  facts: Array<[string, string | number | null | undefined]>;
  /** Clickable links (proof file, Pay Link, Stripe…) */
  links?: Array<{ label: string; url: string | null | undefined }>;
  /** The steps for whoever picks the case up */
  steps: string[];
  /** The response time the policy promises, e.g. "48 horas (até 13/10 18:05)" */
  deadline?: string;
  contacts?: OpsContact[];
  /** Shown in a warning box — e.g. "may contain health data, delete after 6 months" */
  sensitive?: string;
}

/** `PAG` + `94c47b2e-…` → `PAG-94C47B` */
export function opsRef(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** 60 → "€60,00" */
export function eur(value: number | string | null | undefined): string {
  return `€${Number(value ?? 0).toFixed(2).replace('.', ',')}`;
}

/** A Date as "13/10/2026 18:05" in Lisbon time — the team reads local times. */
export function lisbonStamp(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d).replace(',', '');
}

/** "2026-10-13" → "13/10/2026" */
export function ptDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : isoDate;
}

/** Deadline text: "48 horas — até 13/10/2026 18:05" */
export function deadlineIn(hours: number, from: Date = new Date()): string {
  return `${hours} horas — até ${lisbonStamp(new Date(from.getTime() + hours * 3_600_000))}`;
}

/** "Ana Silva · +351 912 345 678 · ana@x.pt" — empty parts dropped */
export function joinParts(...parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && String(p).trim()).join(' · ');
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

export function renderOpsEmail(c: OpsCase): { subject: string; html: string } {
  const subject = [`[${c.ref}] ${c.kind}`, ...(c.subjectParts ?? []).filter((p) => !isEmpty(p))].join(' · ');

  const rows = c.facts
    .filter(([, v]) => !isEmpty(v))
    .map(([k, v]) => `<tr>
        <td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>
        <td style="padding:6px 0;color:#111827">${escapeHtml(v)}</td>
      </tr>`)
    .join('');

  const links = (c.links ?? [])
    .filter((l) => !isEmpty(l.url))
    .map((l) => `<a href="${escapeHtml(l.url)}" style="color:#3f4bc4;font-weight:bold">${escapeHtml(l.label)} →</a>`)
    .join('<br>');

  const steps = c.steps.map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`).join('');

  const buttons = (c.contacts ?? [])
    .filter((p) => !isEmpty(p.email))
    .map((p) => {
      const href = `mailto:${p.email}?subject=${encodeURIComponent(`[${c.ref}] Turnos — ${c.kind}`)}`;
      return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 14px;border-radius:8px;background:#3f4bc4;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">${escapeHtml(p.label)}</a>`;
    })
    .join('');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:640px">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;letter-spacing:.5px">${escapeHtml(c.ref)} · ${escapeHtml(c.kind.toUpperCase())}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:bold">${escapeHtml(c.summary)}</p>
    <table style="border-collapse:collapse;margin:0 0 16px">${rows}</table>
    ${links ? `<p style="margin:0 0 16px">${links}</p>` : ''}
    <div style="background:#fff7e0;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 16px">
      <p style="margin:0 0 6px;font-weight:bold">O que fazer</p>
      <ol style="margin:0;padding-left:20px">${steps}</ol>
      ${c.deadline ? `<p style="margin:8px 0 0"><strong>Prazo:</strong> ${escapeHtml(c.deadline)}</p>` : ''}
    </div>
    ${buttons ? `<p style="margin:0 0 16px">${buttons}</p>` : ''}
    ${c.sensitive ? `<p style="margin:0 0 16px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px">${escapeHtml(c.sensitive)}</p>` : ''}
    <p style="margin:0;color:#9ca3af;font-size:12px">Alerta interno Turnos — responde ou procura pela referência ${escapeHtml(c.ref)}.</p>
  </div>`;

  return { subject, html };
}
