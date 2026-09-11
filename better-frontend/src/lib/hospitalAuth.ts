import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HospitalAuthState {
  token: string | null;
  hospitalId: number | null;
  hospitalCode: string | null;
  name: string | null;
  isAuthenticated: boolean;
  setHospitalAuth: (token: string, hospitalId: number, name: string, hospitalCode?: string | null) => void;
  clearHospitalAuth: () => void;
}

export const useHospitalAuthStore = create<HospitalAuthState>()(
  persist(
    (set) => ({
      token: null,
      hospitalId: null,
      hospitalCode: null,
      name: null,
      isAuthenticated: false,
      setHospitalAuth: (token, hospitalId, name, hospitalCode) => {
        localStorage.setItem('rxify_hospital_token', token);
        set({
          token,
          hospitalId,
          hospitalCode: hospitalCode ?? `RXF-H-${hospitalId}`,
          name,
          isAuthenticated: true,
        });
      },
      clearHospitalAuth: () => {
        localStorage.removeItem('rxify_hospital_token');
        set({ token: null, hospitalId: null, hospitalCode: null, name: null, isAuthenticated: false });
      },
    }),
    {
      name: 'rxify-hospital-auth',
      partialize: (s) => ({
        token: s.token,
        hospitalId: s.hospitalId,
        hospitalCode: s.hospitalCode,
        name: s.name,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
