import * as React from 'react';

interface Props {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  readOnly?: boolean;
  type?: string;
}

/** Warm titanium labelled input field for settings forms. */
const SettingsField: React.FC<Props> = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  readOnly = false,
  type = 'text',
}) => (
  <div className="flex flex-col gap-1.5">
    <label
      className="ti-spec-label text-[11px]"
      style={{ color: readOnly ? 'var(--ti-ink-subtle)' : 'var(--ti-ink-muted)' }}
    >
      {label}
    </label>
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="h-10 w-full rounded-xl px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
      style={{
        background: readOnly ? 'rgba(24,24,22,0.03)' : 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(24,24,22,0.09)',
        color: readOnly ? 'var(--ti-ink-muted)' : 'var(--ti-ink)',
        fontFamily: readOnly ? 'var(--font-mono)' : 'var(--font-sans)',
        cursor: readOnly ? 'default' : 'text',
      }}
    />
    {hint && (
      <p className="text-[11px]" style={{ color: 'var(--ti-ink-subtle)' }}>
        {hint}
      </p>
    )}
  </div>
);

export default SettingsField;

