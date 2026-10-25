'use client';

/**
 * What the worker must be able to do for one role: level cards (the same
 * descriptions workers declare from), the role's tasks, and a live count of
 * matching workers. Used by "Publicar turno" and "Publicar vários turnos".
 */
import { useEffect, useState } from 'react';
import { getRole, roleMaxLevel, ROLE_CERTIFICATE_LABELS } from '@turnos/shared';
import { adminApi } from '../lib/api';
import { useT } from '../lib/i18n';
import { IconShield, IconCheck, IconUsers } from './icons';

// ── Role requirements — level cards, tasks, live match count ─────────────────

export function RoleRequirements({
  role, level, onLevel, tasks, onTasks, languages,
}: {
  role: string;
  level: number;
  onLevel: (level: number) => void;
  tasks: string[];
  onTasks: (tasks: string[]) => void;
  languages: string[];
}) {
  const { t, tRoleLevel, tTask, language } = useT();
  const def = getRole(role);
  const maxLevel = roleMaxLevel(role);
  const [count, setCount] = useState<number | null>(null);

  // Live count of workers who could take it — debounced, refetched on any change
  const langKey = languages.join(',');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      adminApi.matchCount(role, level, langKey ? langKey.split(',') : [])
        .then(r => { if (!cancelled) setCount(r.count); })
        .catch(() => { if (!cancelled) setCount(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [role, level, langKey]);

  if (!def) return null;
  const toggleTask = (id: string) =>
    onTasks(tasks.includes(id) ? tasks.filter(x => x !== id) : [...tasks, id]);

  return (
    <>
      {/* ── Level ── */}
      <div style={rr.block}>
        <h2 style={rr.blockTitle}>{t('admin.newShift.levelSection')}</h2>
        <p style={rr.hint}>{t('admin.newShift.levelHint')}</p>
        {def.certificate && (
          <div style={rr.certificate}>
            <IconShield size={14} />
            {t('admin.newShift.certificateRequired', { doc: ROLE_CERTIFICATE_LABELS[def.certificate][language] })}
          </div>
        )}
        {maxLevel === 1 ? (
          <div style={rr.single}>
            <strong>{tRoleLevel(role, 1)}</strong>
            <span style={rr.singleNote}>{t('admin.newShift.singleLevel')}</span>
          </div>
        ) : (
          <div style={{ ...rr.levels, gridTemplateColumns: `repeat(${maxLevel}, 1fr)` }}>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map(n => {
              const active = level === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onLevel(n)}
                  style={{ ...rr.levelCard, ...(active ? rr.levelCardActive : {}) }}
                >
                  <span style={rr.levelHead}>
                    {active && <IconCheck size={13} />}
                    {t('admin.newShift.levelN', { level: n })}
                  </span>
                  <span style={rr.levelText}>{tRoleLevel(role, n)}</span>
                  {n === 1 && <span style={rr.levelOpen}>{t('admin.newShift.levelOpen')}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tasks ── */}
      <div style={rr.block}>
        <h2 style={rr.blockTitle}>
          {t('admin.newShift.tasksSection')}
          <span style={rr.badge}>{t('admin.newShift.optional')}</span>
        </h2>
        <p style={rr.hint}>{t('admin.newShift.tasksHint')}</p>
        <div style={rr.tasks}>
          {def.tasks.map(task => {
            const on = tasks.includes(task.id);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleTask(task.id)}
                style={{ ...rr.task, ...(on ? rr.taskOn : {}) }}
              >
                {on ? '✓ ' : '+ '}{tTask(role, task.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Who this reaches ── */}
      {count !== null && (
        <div style={{ ...rr.count, ...(count === 0 && level > 1 ? rr.countNone : {}) }}>
          <IconUsers size={15} />
          <span>
            {level <= 1
              ? t('admin.newShift.matchCountOpen', { count })
              : count === 0
                ? t('admin.newShift.matchCountNone')
                : count === 1
                  ? t('admin.newShift.matchCountOne')
                  : t('admin.newShift.matchCountOther', { count })}
          </span>
        </div>
      )}
    </>
  );
}

const rr: Record<string, React.CSSProperties> = {
  block: { display: 'flex', flexDirection: 'column', gap: 10 },
  blockTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
    display: 'flex', alignItems: 'center', gap: 10, margin: 0,
  },
  hint: { fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 },
  badge: {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 20, padding: '2px 8px',
  },
  certificate: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
    color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: 8, padding: '8px 12px',
  },
  levels: { display: 'grid', gap: 10 },
  levelCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left',
    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)', background: '#fff',
  },
  levelCardActive: { borderWidth: '2px', borderColor: 'var(--color-primary)', background: 'var(--color-primary-light)' },
  levelHead: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.3,
  },
  levelText: { fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-primary)' },
  levelOpen: { fontSize: 11, fontWeight: 600, color: '#15803d' },
  single: {
    display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13,
    border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '12px 14px',
  },
  singleNote: { fontSize: 12, color: 'var(--color-text-secondary)' },
  tasks: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  task: {
    padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'var(--color-secondary)', color: 'var(--color-text-secondary)',
  },
  taskOn: {
    background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.5)',
    color: 'var(--color-primary)',
  },
  count: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
    color: '#166534', background: '#f0fdf4',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#bbf7d0',
    borderRadius: 8, padding: '10px 12px',
  },
  countNone: { color: '#92400e', background: '#fffbeb', borderColor: '#fcd34d' },
};
