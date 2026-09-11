/* ─── Rxify API Client ─────────────────────────────────────────────────────── */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type Role = 'patient' | 'doctor' | 'dispensary';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role | string;
  user_id?: number;
  display_name?: string | null;
  doctor_id?: number | null;
  doctor_code?: string | null;
  patient_id?: number | null;
  patient_code?: string | null;
  dispensary_id?: number | null;
}

export interface RegisterResponse {
  message: string;
  role: Role | string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      detail = json.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

/** POST /api/login  (OAuth2PasswordRequestForm — application/x-www-form-urlencoded) */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return handleResponse<LoginResponse>(res);
}

/** POST /api/register  (JSON body) */
export async function register(
  username: string,
  password: string,
  role: Role,
): Promise<RegisterResponse> {
  const res = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  return handleResponse<RegisterResponse>(res);
}

/** Helper: attach the stored Bearer token to any request */
export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('rxify_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
