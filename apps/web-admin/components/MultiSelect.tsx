'use client';

/**
 * A dropdown that still allows picking several values.
 *
 * A native <select multiple> needs ctrl-click and shows every option at once,
 * which is why the language picker was a permanently-expanded row of chips
 * instead. This keeps the compactness of a dropdown and the multi-select of
 * chips: a closed control showing the count, opening to a checkbox list, with
 * the chosen values echoed underneath so nothing is hidden behind a click.
 *
 * `options` carry the STORED value; `label` renders the display form. That
 * split matters — language names and job titles are Portuguese database keys.
 */
import { useState } from 'react';
import { IconChevron, IconClose } from './icons';

export function MultiSelect({
  options,
  selected,
  onChange,
  label,
  placeholder,
  countLabel,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Stored value → display text. */
  label: (value: string) => string;
  placeholder: string;
  /** Rendered when at least one is picked, e.g. "3 languages". */
  countLabel: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  return (
    <div style={s.root}>
      <button
        type="button"
        style={{ ...s.control, ...(selected.length ? s.controlOn : {}) }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{selected.length ? countLabel(selected.length) : placeholder}</span>
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none' }}>
          <IconChevron size={15} />
        </span>
      </button>

      {open && (
        <>
          {/* Click-away layer, so the list closes without a dedicated button. */}
          <div style={s.backdrop} onClick={() => setOpen(false)} />
          <div style={s.menu}>
            {options.map(o => (
              <label key={o} style={s.row}>
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
                <span style={s.rowText}>{label(o)}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {selected.length > 0 && (
        <div style={s.chips}>
          {selected.map(v => (
            <span key={v} style={s.chip}>
              {label(v)}
              <button type="button" style={s.chipX} onClick={() => toggle(v)} aria-label="remove">
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { position: 'relative' },
  control: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, height: 44, padding: '0 14px',
    border: '1.5px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-surface)', fontSize: 14, fontFamily: 'inherit',
    color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left',
  },
  controlOn: {
    borderColor: 'rgba(106,121,255,0.55)',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', fontWeight: 600,
  },
  backdrop: { position: 'fixed', inset: 0, zIndex: 90 },
  menu: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    maxHeight: 260, overflowY: 'auto', padding: '8px 4px',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', cursor: 'pointer', borderRadius: 8,
  },
  rowText: { fontSize: 14, color: 'var(--color-text-primary)' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 'var(--radius-full)',
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    fontSize: 13, fontWeight: 600,
  },
  chipX: {
    display: 'inline-flex', background: 'none', border: 'none', padding: 0,
    color: 'inherit', cursor: 'pointer', opacity: 0.7,
  },
};
