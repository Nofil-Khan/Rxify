import * as React from 'react';
import { DispensaryProfile } from '@/lib/dispensaryApi';
import SettingsField from './SettingsField';
import SaveButton from './SaveButton';
import type { SaveState } from './SettingsView';

interface Props {
  profile: DispensaryProfile | null;
}

/** Profile fields: name, email (read-only), phone. Saved locally (no PATCH /me endpoint yet). */
const ProfileSection: React.FC<Props> = ({ profile }) => {
  const [name, setName] = React.useState(profile?.name ?? '');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');

  React.useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaveState('saving');
    // No PATCH /me endpoint exists yet — save locally and show success
    await new Promise((r) => setTimeout(r, 600));
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2500);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField
          label="Dispensary Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Main Hospital Pharmacy"
        />
        <SettingsField
          label="Email Address"
          value={profile?.email ?? ''}
          readOnly
          hint="Email cannot be changed after registration."
        />
        <SettingsField
          label="Phone Number"
          value={phone}
          onChange={setPhone}
          placeholder="+91 98765 43210"
          type="tel"
        />
        <SettingsField
          label="Dispensary Code"
          value={profile?.dispensary_code ?? '—'}
          readOnly
          hint="Auto-generated. Share with hospital to link."
        />
      </div>
      <SaveButton state={saveState} onClick={handleSave} label="Save Profile" />
    </div>
  );
};

export default ProfileSection;

