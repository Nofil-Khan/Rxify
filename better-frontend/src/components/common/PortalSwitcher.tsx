import React from 'react';
import { User, Stethoscope, Building2, Package } from 'lucide-react';

interface PortalSwitcherProps {
  current: 'main' | 'hospital' | 'dispensary';
}

export function PortalSwitcher({ current }: PortalSwitcherProps) {
  return (
    <nav className="rx-portal-nav" aria-label="Rxify Portals">
      <a
        href="/login"
        className={`rx-portal-link ${current === 'main' ? 'rx-portal-link--active' : ''}`}
      >
        <User size={14} />
        <span>Patient & Doctor</span>
      </a>

      <a
        href="/hospital/login"
        className={`rx-portal-link ${current === 'hospital' ? 'rx-portal-link--active' : ''}`}
      >
        <Building2 size={14} />
        <span>Hospital</span>
      </a>

      <a
        href="/dispensary/login"
        className={`rx-portal-link ${current === 'dispensary' ? 'rx-portal-link--active' : ''}`}
      >
        <Package size={14} />
        <span>Dispensary</span>
      </a>
    </nav>
  );
}

export default PortalSwitcher;
