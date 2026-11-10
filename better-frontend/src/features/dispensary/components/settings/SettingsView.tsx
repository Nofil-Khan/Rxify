import * as React from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDispensaryProfile,
  updateDispensaryLocation,
  DispensaryProfile,
} from '@/lib/dispensaryApi';
import { Building2, Clock, MapPin, Stethoscope, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import SettingsSection from './SettingsSection';
import ProfileSection from './ProfileSection';
import LocationSection from './LocationSection';
import OperationsSection from './OperationsSection';
import DangerZone from './DangerZone';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SettingsView: React.FC = () => {
  const { data: profile, isLoading } = useQuery<DispensaryProfile>({
    queryKey: ['dispensary_profile'],
    queryFn: fetchDispensaryProfile,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3" style={{ color: 'var(--ti-ink-muted)' }}>
        <div
          className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--ti-sage)', borderTopColor: 'transparent' }}
        />
        <span className="font-mono text-sm">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 w-full max-w-[860px] mx-auto pb-20">
      {/* Page heading */}
      <div>
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: 'var(--ti-ink-subtle)' }}
        >
          DISPENSARY CONFIGURATION
        </span>
        <h1
          className="font-serif text-3xl font-semibold mt-1 leading-tight"
          style={{ color: 'var(--ti-ink)', letterSpacing: '-0.02em' }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ti-ink-muted)' }}>
          Manage your dispensary profile, operating configuration, and location.
        </p>
      </div>

      {/* Identity */}
      <SettingsSection
        icon={Building2}
        label="Dispensary Identity"
        description="Name, contact details, and your unique dispensary code."
      >
        <ProfileSection profile={profile ?? null} />
      </SettingsSection>

      {/* Operations */}
      <SettingsSection
        icon={Clock}
        label="Operating Configuration"
        description="Working hours and average order preparation time shown to patients."
      >
        <OperationsSection profile={profile ?? null} />
      </SettingsSection>

      {/* Location */}
      <SettingsSection
        icon={MapPin}
        label="Location & GPS"
        description="GPS coordinates and human-readable address for patient-facing discovery."
      >
        <LocationSection profile={profile ?? null} />
      </SettingsSection>

      {/* Dispensary Info (read-only) */}
      <SettingsSection
        icon={Stethoscope}
        label="System Info"
        description="Read-only identifiers assigned at registration."
      >
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Dispensary ID', value: profile?.dispensary_id ?? '—' },
            { label: 'Dispensary Code', value: profile?.dispensary_code ?? '—' },
            { label: 'Hospital ID', value: profile?.hospital_id ?? 'Independent' },
            { label: 'Account Status', value: profile?.status ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="ti-spec-label text-[11px]">{label}</span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: 'var(--ti-ink)' }}
              >
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <DangerZone />
    </div>
  );
};

export default SettingsView;

