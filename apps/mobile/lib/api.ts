import { tokenStorage } from './storage';

// In dev, replace with your machine's local IP if testing on a physical device
// e.g. http://192.168.1.x:3001/api  (include /api suffix)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = await tokenStorage.getAccessToken();

  // Auto-refresh if token is expired
  if (token && tokenStorage.isTokenExpired(token)) {
    try {
      const userId = await tokenStorage.getUserId();
      const refreshToken = await tokenStorage.getRefreshToken();
      if (userId && refreshToken) {
        const refreshed = await rawPost<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { userId, refreshToken },
        );
        await tokenStorage.saveSession(refreshed.accessToken, refreshed.refreshToken);
        token = refreshed.accessToken;
      }
    } catch {
      await tokenStorage.clear();
      token = null;
    }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies; FormData sets its own boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function rawPost<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json() as Promise<T>);
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
};

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, code: string) =>
    api.post<{ accessToken: string; refreshToken: string; isNewUser: boolean }>(
      '/auth/verify-otp', { phone, code },
    ),

  updateWorkerProfile: (dto: {
    fullName: string; nif: string; iban: string;
    skills: string[]; availableDays: string[];
    declaredExternalMonthlyIncome?: number;
  }) =>
    api.post<{ profileQualityScore: number; status: string; missingItems: string[] }>(
      '/auth/worker/profile', dto,
    ),

  uploadWorkerPhoto: (imageUri: string, mimeType: string) => {
    const form = new FormData();
    form.append('photo', { uri: imageUri, type: mimeType, name: 'photo.jpg' } as any);
    return api.postForm<{ photoUrl: string }>('/auth/worker/photo', form);
  },

  getMe: () => api.get<{ userId: string; role: string }>('/auth/me'),

  googleVerifyToken: (googleAccessToken: string, userType: 'WORKER' | 'EMPLOYER' = 'WORKER') =>
    api.post<{ accessToken: string; refreshToken: string; isNewUser: boolean }>(
      '/auth/google/verify-token', { googleAccessToken, userType },
    ),

  /** Register Expo push token so the server can send shift notifications */
  registerPushToken: (token: string) =>
    api.post<{ message: string }>('/auth/worker/push-token', { token }),
};

// ─── Shift API ────────────────────────────────────────────────────────────────

export interface ShiftSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  date: string;
  startTime: string;
  endTime: string;
  grossHourlyRate: number;
  address: string;
  skillsRequired: string[] | null;
  status: string;
  employer: { id: string; companyName: string } | null;
  /** Decimal latitude stored alongside the PostGIS geometry — reliable for client display */
  lat?: number | null;
  /** Decimal longitude stored alongside the PostGIS geometry — reliable for client display */
  lng?: number | null;
}

export interface MyApplication {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  appliedAt: string;
  shift: ShiftSummary & { employer: { id: string; companyName: string } | null };
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  status: 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'DISPUTED' | 'MANUAL' | 'NO_SHOW';
  checkInAt: string | null;
  checkOutAt: string | null;
  scheduledHours: number | null;
  isManualOverride: boolean;
  disputeNote: string | null;
  disputeRaisedBy: 'WORKER' | 'EMPLOYER' | null;
}

export const attendanceApi = {
  /** Fetch the attendance record for a shift (null if not yet created). */
  getAttendance: (shiftId: string) =>
    api.get<AttendanceRecord | null>(`/attendance/${shiftId}`),

  /** Worker scans employer QR to check in. */
  checkIn: (token: string, lat: number, lng: number) =>
    api.post<AttendanceRecord>('/attendance/check-in', { token, lat, lng }),

  /** Worker scans employer QR to check out. */
  checkOut: (token: string, lat: number, lng: number) =>
    api.post<AttendanceRecord>('/attendance/check-out', { token, lat, lng }),

  /** Worker raises a dispute on a completed shift. */
  raiseDispute: (shiftId: string, note: string) =>
    api.post<AttendanceRecord>(`/attendance/${shiftId}/dispute/worker`, { note }),
};

// ─── Shift API ────────────────────────────────────────────────────────────────

export const shiftApi = {
  search: (params?: { lat?: number; lng?: number; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lat !== undefined) qs.set('lat', String(params.lat));
    if (params?.lng !== undefined) qs.set('lng', String(params.lng));
    if (params?.category) qs.set('category', params.category);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<ShiftSummary[]>(`/shifts/search${query}`);
  },

  getById: (id: string) =>
    api.get<ShiftSummary>(`/shifts/${id}`),

  apply: (id: string) =>
    api.post<{ id: string; status: string }>(`/shifts/${id}/apply`, {}),

  getMyApplications: () =>
    api.get<MyApplication[]>('/shifts/worker/applied'),
};
