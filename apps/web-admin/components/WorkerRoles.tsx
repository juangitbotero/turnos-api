'use client';

/**
 * A worker's roles as a company sees them: role · level, what that level
 * means, the tasks they've done, years, and whether companies that hired them
 * confirmed it. Shared by the applicant profile panel and worker search so the
 * evidence reads the same everywhere.
 */
import { ROLE_CONFIRMED_MIN_SHIFTS, ROLE_CERTIFICATE_LABELS, getRole } from '@turnos/shared';
import { WorkerRoleView } from '../lib/api';
import { useT } from '../lib/i18n';
import { IconBriefcase, IconCheck, IconShield } from './icons';

export function WorkerRoles({ roles, highlightRole }: {
  roles: WorkerRoleView[] | null | undefined;
  /** The role of the shift being filled — shown first and marked. */
  highlightRole?: string | null;
}) {
  const { t, tSkill, tRoleLevel, tTask, language } = useT();
  if (!roles?.length) return null;
  const ordered = highlightRole
    ? [...roles].sort((a, b) => Number(b.role === highlightRole) - Number(a.role === highlightRole))
    : roles;

  return (
    <div style={st.section}>
      <p style={st.title}>{t('admin.shifts.panelRoles')}</p>
      {ordered.map(r => {
        const confirmed = r.confirmedShifts >= ROLE_CONFIRMED_MIN_SHIFTS;
        const isShiftRole = r.role === highlightRole;
        return (
          <div key={r.role} style={{ ...st.card, ...(isShiftRole ? st.cardHighlight : {}) }}>
            <div style={st.head}>
              <IconBriefcase size={13} />
              <strong style={st.role}>{tSkill(r.role)}</strong>
              <span style={st.level}>{t('admin.shifts.roleLevel', { level: r.level })}</span>
              {r.years && <span style={st.years}>{t(`domain.experienceLevelsShort.${r.years}`)}</span>}
              {isShiftRole && <span style={st.shiftTag}>{t('admin.shifts.roleThisShift')}</span>}
            </div>
            <p style={st.levelText}>{tRoleLevel(r.role, r.level)}</p>
            {r.tasks.length > 0 && (
              <p style={st.tasks}>
                <span style={st.tasksLabel}>{t('admin.shifts.roleTasksDone')}: </span>
                {r.tasks.map(id => tTask(r.role, id)).join(' · ')}
              </p>
            )}
            {/* Licensed role: the document the law requires — the company must check it */}
            {r.hasCertificate && (() => {
              const doc = getRole(r.role)?.certificate;
              const label = doc ? ROLE_CERTIFICATE_LABELS[doc][language] : '';
              return r.certificate ? (
                <a href={r.certificate.url} target="_blank" rel="noopener noreferrer" style={st.certLink}>
                  <IconShield size={12} /> {t('admin.shifts.roleCertificateOpen', { doc: label })}
                </a>
              ) : (
                <span style={st.certBadge}><IconShield size={12} /> {t('admin.shifts.roleCertificateSent', { doc: label })}</span>
              );
            })()}
            <span style={confirmed ? st.confirmed : st.declared}>
              {confirmed && <IconCheck size={11} />}
              {confirmed
                ? t('admin.shifts.roleConfirmed', { count: r.confirmedShifts })
                : t('admin.shifts.roleDeclared')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 },
  card: {
    display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start',
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    borderRadius: 10, padding: '10px 12px', background: 'var(--color-surface)',
  },
  cardHighlight: { borderColor: 'rgba(106,121,255,0.5)', background: 'var(--color-primary-light)' },
  head: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: 'var(--color-primary)' },
  role: { fontSize: 13.5, color: 'var(--color-text-primary)' },
  level: {
    fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', background: '#fff',
    border: '1px solid rgba(106,121,255,0.3)', borderRadius: 20, padding: '1px 8px',
  },
  years: { fontSize: 11, color: 'var(--color-text-secondary)' },
  shiftTag: { fontSize: 10.5, fontWeight: 700, color: 'var(--color-primary)', marginLeft: 'auto' },
  levelText: { fontSize: 12.5, color: '#374151', lineHeight: 1.45, margin: 0 },
  tasks: { fontSize: 12, color: '#374151', lineHeight: 1.45, margin: 0 },
  tasksLabel: { fontWeight: 700, color: 'var(--color-text-secondary)' },
  confirmed: {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
    color: '#166534', background: '#dcfce7', borderRadius: 20, padding: '2px 8px',
  },
  declared: { fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' },
  certLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
    color: '#92400e', textDecoration: 'none', background: '#fffbeb',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#fcd34d', borderRadius: 8, padding: '4px 8px',
  },
  certBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#92400e' },
};
