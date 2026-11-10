import * as React from 'react';
import { DispensaryProfile } from '@/lib/dispensaryApi';
import SettingsField from './SettingsField';
import SaveButton from './SaveButton';
import type { SaveState } from './SettingsView';

interface Props {
  profile: DispensaryProfile | null;
}

const PREP_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

/** Operating hours + avg prep time settings. */
const OperationsSection: React.FC<Props> = ({ profile }) => {
  const [hours, setHours] = React.useState(profile?.operating_hours ?? '');
  const [prepMins, setPrepMins] = React.useState(profile?.avg_prep_minutes ?? 15);
  const [location, setLocation] = React.useState(profile?.location ?? '');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');

  React.useEffect(() => {
    if (profile) {
      setHours(profile.operating_hours ?? '');
      setPrepMins(profile.avg_prep_minutes ?? 15);
      setLocation(profile.location ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaveState('saving');
    await new Promise((r) => setTimeout(r, 700));
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2500);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField
          label="Operating Hours"
          value={hours}
          onChange={setHours}
          placeholder="08:00 – 20:00 Daily"
          hint="Displayed on patient-facing pharmacy search."
        />
        <SettingsField
          label="Floor / Wing Location"
          value={location}
          onChange={setLocation}
          placeholder="Ground Floor, Wing B"
          hint="Physical description of your dispensary location."
        />
      </div>

      {/* Prep time selector */}
      <div className="flex flex-col gap-2">
        <span className="ti-spec-label text-[11px]">Average Prep Time (minutes)</span>
        <div className="flex items-center gap-2 flex-wrap">
          {PREP_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPrepMins(m)}
              aria-pressed={prepMins === m}
              aria-label={`Set prep time to ${m} minutes`}
              className="relative h-9 px-4 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage"
              style={{
                background: prepMins === m ? 'var(--ti-sage)' : 'rgba(255,255,255,0.65)',
                color: prepMins === m ? 'white' : 'var(--ti-ink-muted)',
                border: prepMins === m ? 'none' : '1px solid rgba(24,24,22,0.09)',
                boxShadow: prepMins === m ? '0 4px 12px rgba(74,124,111,0.25)' : '0 2px 6px rgba(24,24,22,0.04)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {m}m
            </button>
          ))}

          {/* Custom input if not in presets */}
          {!PREP_OPTIONS.includes(prepMins) && (
            <span
              className="font-mono text-sm px-3 py-1.5 rounded-full"
              style={{ background: 'var(--ti-sage)', color: 'white' }}
            >
              {prepMins}m (custom)
            </span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: 'var(--ti-ink-subtle)' }}>
          Shown as "Ready in ~{prepMins} min" to patients after their request is processed.
        </p>
      </div>

      <SaveButton state={saveState} onClick={handleSave} label="Save Operations" />
    </div>
  );
};

export default OperationsSection;

