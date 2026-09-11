import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from './api';

interface AuthState {
  token: string | null;
  role: Role | null;
  username: string | null;
  displayName: string | null;
  userId: number | null;
  patientId: number | null;
  patientCode: string | null;
  doctorId: number | null;
  doctorCode: string | null;
  dispensaryId: number | null;
  isAuthenticated: boolean;

  setAuth: (
    token: string,
    role: Role | string,
    username: string,
    extra?: {
      userId?: number | null;
      displayName?: string | null;
      patientId?: number | null;
      patientCode?: string | null;
      doctorId?: number | null;
      doctorCode?: string | null;
      dispensaryId?: number | null;
    },
  ) => void;
  updateProfileData: (data: {
    displayName?: string | null;
    patientCode?: string | null;
    doctorCode?: string | null;
    doctorId?: number | null;
    patientId?: number | null;
  }) => void;
  clearAuth: () => void;
}

function decodeJwtUid(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const payload = JSON.parse(jsonStr);
    return payload.uid ?? payload.id ?? payload.user_id ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: null,
      displayName: null,
      userId: null,
      patientId: null,
      patientCode: null,
      doctorId: null,
      doctorCode: null,
      dispensaryId: null,
      isAuthenticated: false,

      setAuth: (token, role, username, extra) => {
        localStorage.setItem('rxify_token', token);
        const userId = extra?.userId ?? decodeJwtUid(token);
        const normalizedRole = (role ? (role.toLowerCase() as Role) : null);
        set({
          token,
          role: normalizedRole,
          username,
          displayName: extra?.displayName ?? null,
          userId,
          patientId: extra?.patientId ?? null,
          patientCode: extra?.patientCode ?? null,
          doctorId: extra?.doctorId ?? null,
          doctorCode: extra?.doctorCode ?? (extra?.doctorId ? `RXF-D-${extra.doctorId}` : null),
          dispensaryId: extra?.dispensaryId ?? null,
          isAuthenticated: true,
        });
      },

      updateProfileData: (data) => {
        set((state) => ({
          displayName: data.displayName !== undefined ? data.displayName : state.displayName,
          patientCode: data.patientCode !== undefined ? data.patientCode : state.patientCode,
          doctorCode: data.doctorCode !== undefined ? data.doctorCode : state.doctorCode,
          doctorId: data.doctorId !== undefined ? data.doctorId : state.doctorId,
          patientId: data.patientId !== undefined ? data.patientId : state.patientId,
        }));
      },

      clearAuth: () => {
        localStorage.removeItem('rxify_token');
        set({
          token: null,
          role: null,
          username: null,
          displayName: null,
          userId: null,
          patientId: null,
          patientCode: null,
          doctorId: null,
          doctorCode: null,
          dispensaryId: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'rxify-auth',
      partialize: (state) => ({
        token: state.token,
        role: state.role ? (state.role.toLowerCase() as Role) : null,
        username: state.username,
        displayName: state.displayName,
        userId: state.userId,
        patientId: state.patientId,
        patientCode: state.patientCode,
        doctorId: state.doctorId,
        doctorCode: state.doctorCode,
        dispensaryId: state.dispensaryId,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.role) {
          state.role = (state.role as string).toLowerCase() as Role;
        }
      },
    },
  ),
);
