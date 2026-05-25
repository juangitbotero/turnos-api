const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'DRAFT' | 'OPEN' | 'FILLED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Shift {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  role: string | null;
  date: string;
  startTime: string;
  endTime: string;
  grossHourlyRate: number;
  address: string;
  skillsRequired: string[] | null;
  status: ShiftStatus;
  createdAt: string;
  employer: { id: string; companyName: string } | null;
}

export interface Application {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  appliedAt: string;
  worker: {
    id: string;
    fullName: string | null;
    profileQualityScore: number;
    photoUrl: string | null;
    skills: string[] | null;
  } | null;
}

export interface CreateShiftDto {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  role?: string;
  date: string;
  startTime: string;
  endTime: string;
  grossHourlyRate: number;
  address: string;
  lat: number;
  lng: number;
  skillsRequired?: string[];
}

// ── API methods ───────────────────────────────────────────────────────────────

export const adminApi = {
  // Auth
  loginEmployer: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; message: string }>(
      '/auth/login/employer',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  // Workers (admin approval)
  getPendingWorkers: () =>
    request<Array<{
      id: string; fullName: string | null; nif: string | null; iban: string | null;
      skills: string[] | null; availableDays: string[] | null;
      profileQualityScore: number; photoUrl: string | null;
      createdAt: string; userEmail: string | null; userPhone: string | null;
    }>>('/admin/workers/pending', { method: 'GET' }),

  approveWorker: (id: string) =>
    request<{ id: string; status: string; message: string }>(
      `/admin/workers/${id}/approve`, { method: 'POST' },
    ),

  rejectWorker: (id: string, reason: string) =>
    request<{ id: string; status: string; message: string }>(
      `/admin/workers/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) },
    ),

  // Shifts
  createShift: (dto: CreateShiftDto) =>
    request<Shift>('/shifts', { method: 'POST', body: JSON.stringify(dto) }),

  getMyShifts: () =>
    request<Shift[]>('/shifts/employer/mine', { method: 'GET' }),

  updateShift: (id: string, dto: Partial<CreateShiftDto>) =>
    request<Shift>(`/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  cancelShift: (id: string) =>
    request<Shift>(`/shifts/${id}/cancel`, { method: 'POST' }),

  getShiftApplications: (id: string) =>
    request<Application[]>(`/shifts/${id}/applications`, { method: 'GET' }),

  approveApplication: (shiftId: string, appId: string) =>
    request<Shift>(`/shifts/${shiftId}/applications/${appId}/approve`, { method: 'POST' }),
};
