import { AppLanguage, catalogue, resolveInitialLanguage } from '@turnos/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The active UI language, resolved the same way the provider resolves it.
 *
 * This module is not a React component, so it can't use `useT()` — it reads the
 * same `turnos_lang` cookie the provider writes. Used for two things: the copy
 * of errors thrown here, and the `Accept-Language` header that tells the API
 * which language to throw ITS messages in.
 */
function currentLanguage(): AppLanguage {
  const raw = typeof document !== 'undefined'
    ? document.cookie.match(/(?:^|; )turnos_lang=([^;]*)/)?.[1]
    : null;
  const browser = typeof navigator !== 'undefined'
    ? [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[]
    : [];
  return resolveInitialLanguage(raw ? decodeURIComponent(raw) : null, browser);
}

/** Copy for errors thrown by this module. */
function currentCatalogue() {
  return catalogue(currentLanguage());
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

// JWTs are base64url-encoded (uses '-'/'_', no padding) — atob() only understands
// standard base64 ('+'/'/','=') and throws on the former, so decode manually.
function decodeJwtPayload(segment: string): any {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return JSON.parse(atob(padded));
}

function isExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token.split('.')[1] ?? '');
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

let refreshPromise: Promise<string | null> | null = null;

// De-duped: concurrent callers share one in-flight refresh instead of each
// rotating the refresh token and causing the others to fail with 401.
async function refreshTokens(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshTokens().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function doRefreshTokens(): Promise<string | null> {
  const currentToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!currentToken || !refreshToken) return null;
  try {
    // Extract userId from the existing JWT payload (sub claim)
    const payload = decodeJwtPayload(currentToken.split('.')[1] ?? '') as { sub: string };
    const userId = payload.sub;
    if (!userId) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch { return null; }
}

// skipAuth: for public endpoints (currently only login) — never attaches a token,
// never runs refresh, never redirects. A stale/expired token sitting in localStorage
// from an unrelated earlier session must not interfere with a fresh login attempt,
// and a 401 here (e.g. wrong password) is a normal auth failure, not a dead session.
async function request<T>(
  path: string,
  options: RequestInit = {},
  { skipAuth = false }: { skipAuth?: boolean } = {},
): Promise<T> {
  if (skipAuth) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': currentLanguage(),
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  let token = getToken();

  // Auto-refresh if expired
  if (token && isExpired(token)) {
    token = await refreshTokens();
    if (!token) {
      // Refresh failed — redirect to login
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError(401, currentCatalogue().common.sessionExpiredBody);
    }
  }

  // FormData must set its own Content-Type — the browser appends the multipart
  // boundary, and forcing application/json here would make the upload unparseable.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    // The API throws its user-facing messages in this language — see the
    // `api.*` namespace in @turnos/shared and apps/api/src/i18n.
    'Accept-Language': currentLanguage(),
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // If still 401, session is truly dead → redirect to login
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, currentCatalogue().common.sessionExpiredBody);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Compliance types ──────────────────────────────────────────────────────────

export interface TsuReportRow {
  shiftId:          string;
  shiftTitle:       string;
  shiftDate:        string;
  workerName:       string;
  grossHourlyRate:  number;
  scheduledHours:   number;
  grossAmount:      number;
  turnosFee:        number;
  workerDeduction:  number;
  workerNetAmount:  number;
  employerTsu:      number;
}

export interface TsuReport {
  month:           number;
  year:            number;
  rows:            TsuReportRow[];
  totalGross:      number;
  totalEmployerTsu: number;
  totalTurnosFees: number;
}

export interface McdContract {
  id:              string;
  workerName:      string;
  workerNif:       string;
  shiftDate:       string;
  startTime:       string;
  endTime:         string;
  role:            string;
  grossHourlyRate: number;
  ssStatus:        string;
  ssEmailSentAt:   string | null;
  createdAt:       string;
}

export interface AuditLogEntry {
  id:          string;
  event:       string;
  workerId:    string | null;
  employerId:  string | null;
  shiftId:     string | null;
  contractId:  string | null;
  details:     Record<string, unknown>;
  createdAt:   string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'DRAFT' | 'OPEN' | 'PENDING_ACCEPTANCE' | 'FILLED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

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
  /** Multi-day job: id shared by every day, and all its dates (ascending). */
  seriesId?: string | null;
  seriesDates?: string[];
  seriesTotalDays?: number | null;
}

export interface WagePayment {
  id: string;
  shiftId: string;
  type: 'SHIFT_COMPLETION' | 'CANCELLATION_MINIMUM';
  status: 'PENDING' | 'PAID' | 'MARKED_PAID' | 'CONFIRMED' | 'DISPUTED' | 'UNDER_REVIEW' | 'WAIVED';
  amount: number;
  processingFee: number;
  paymentMethod: string;
  payLinkUrl: string | null;
  shiftTitle: string;
  shiftDate: string | null;
  createdAt: string;
  /** Proof of payment attached by the company (manual methods) */
  paymentProofUrl: string | null;
  paymentProofNote: string | null;
  /** Coordinates for paying a manual wage — absent on Pay Link rows */
  workerName: string | null;
  workerIban: string | null;
  /** Worker has not consented to sharing their IBAN — use the Pay Link instead */
  workerIbanWithheld: boolean;
  paymentReference: string;
}

export interface Application {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  appliedAt: string;
  coverNote?: string | null;
  worker: {
    id: string;
    fullName: string | null;
    profileQualityScore: number;
    photoUrl: string | null;
    bio?: string | null;
    cvUrl?: string | null;
    cvFileName?: string | null;
    skills: string[] | null;
    languages?: string[] | null;
    isAvailableForWork?: boolean;
    availableDays: string[] | null;
    experiences?: Array<{ jobTitle: string; level: string }> | null;
    status: string;
    avgRating?: number | null;
    totalRatings?: number;
    badges?: string[];
  } | null;
}

export interface EmployerProfile {
  userId: string;
  role: 'EMPLOYER';
  companyName: string | null;
  sector: string | null;
  city: string | null;
  subscriptionTier: string;
  // Settings fields. `nipc` and `adminEmail` are returned for display but are
  // not editable — both are support operations. See the settings page.
  nipc?: string | null;
  nif?: string | null;
  address?: string | null;
  postalCode?: string | null;
  accountantEmail?: string | null;
  adminEmail?: string | null;
  subscriptionStatus?: string;
}

export interface HiredWorker {
  id: string;
  fullName: string | null;
  photoUrl: string | null;
  skills: string[] | null;
  availableDays: string[] | null;
  profileQualityScore: number;
  status: string;
  shiftsWorked: number;
  lastShiftDate: string | null;
  avgRating: number | null;
  totalRatings: number;
  noShowCount: number;
  badges: string[];
}

// ── Ratings types ─────────────────────────────────────────────────────────────

export interface RatingRecord {
  score: number;
  tags: string[];
  review?: string;
  raterName?: string;
  createdAt: string;
}

export interface WorkerRatingSummary {
  avgRating: number | null;
  totalRatings: number;
  noShowCount: number;
  completionRate: number;
  badges: string[];
  recentRatings: RatingRecord[];
}

/** Public worker profile visible to employers in talent search */
export interface WorkerSearchResult {
  id: string;
  fullName: string | null;
  photoUrl: string | null;
  bio: string | null;
  cvUrl: string | null;
  cvFileName: string | null;
  skills: string[] | null;
  languages: string[] | null;
  /** Master availability switch; `availableDays` says which days it covers. */
  isAvailableForWork: boolean;
  availableDays: string[] | null;
  experiences: Array<{ jobTitle: string; level: string }> | null;
  avgRating: number | null;
  totalRatings: number;
  noShowCount: number;
  badges: string[];
  profileQualityScore: number;
}

export interface FavouriteWorker {
  id: string;
  worker: {
    id: string;
    fullName: string | null;
    photoUrl: string | null;
    avgRating: number | null;
    totalRatings: number;
    badges: string[];
  };
  createdAt: string;
}

export interface CreateShiftDto {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  role?: string;
  date: string;
  /** Multi-day job: every date including `date`. Omit for a single-day shift. */
  dates?: string[];
  startTime: string;
  endTime: string;
  grossHourlyRate: number;
  address: string;
  lat: number;
  lng: number;
  skillsRequired?: string[];
  languagesRequired?: string[];
  paymentMethod: string;   // PaymentMethod from @turnos/shared — required at publish
}

// ── Payment types ────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id:                    string;
  shiftId:               string | null;
  employerId:            string | null;
  workerId:              string | null;
  type:                  'SHIFT_CHARGE' | 'WORKER_PAYOUT' | 'CANCELLATION_FEE' | 'WORKER_COMPENSATION' | 'SUBSCRIPTION';
  status:                'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  grossAmount:           number;
  turnosFee:             number | null;
  workerNet:             number | null;
  employerTsu:           number | null;
  workerTsu:             number | null;
  scheduledHours:        number | null;
  stripePaymentIntentId: string | null;
  stripeTransferId:      string | null;
  stripeChargeId:        string | null;
  shiftDate:             string | null;
  createdAt:             string;
}

export interface SpendingReport {
  totalGross:        number;
  turnosFees:        number;
  employerTsu:       number;
  shiftCount:        number;
  avgCostPerShift:   number;
  records:           PaymentRecord[];
  monthlyBreakdown?: { month: string; gross: number; tsu: number }[];
}

// ── API methods ───────────────────────────────────────────────────────────────

export const adminApi = {
  // Auth
  loginEmployer: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; message: string }>(
      '/auth/login/employer',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      { skipAuth: true },
    ),

  getMyProfile: () =>
    request<EmployerProfile>('/auth/me', { method: 'GET' }),

  /** Update the company's own details (settings). */
  updateEmployerProfile: (dto: {
    companyName?: string; sector?: string; nif?: string;
    address?: string; postalCode?: string; city?: string; accountantEmail?: string;
  }) => request<EmployerProfile>('/auth/employer/profile', {
    method: 'PATCH', body: JSON.stringify(dto),
  }),

  /** Change the account password. Signs other devices out. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Workers (admin approval queue — ADMIN only)
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

  getMyWorkers: () =>
    request<HiredWorker[]>('/shifts/employer/workers', { method: 'GET' }),

  updateShift: (id: string, dto: Partial<CreateShiftDto>) =>
    request<Shift>(`/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  cancelShift: (id: string, reason?: { reasonCategory?: string; reasonNote?: string }) =>
    request<Shift & { cancellationConsequence?: string }>(
      `/shifts/${id}/cancel`,
      { method: 'POST', body: JSON.stringify(reason ?? {}) },
    ),

  // ── Wage payments (Pay Link + trust loop) ──────────────────────────────────

  getPendingWages: () =>
    request<WagePayment[]>('/payments/wages/pending', { method: 'GET' }),

  /**
   * Declare a manual wage paid. Attach the comprovativo (bank receipt / MB WAY
   * screenshot) — without one, `noProofReason` records why, so a later dispute
   * shows the payment was declared with no evidence.
   */
  markWagePaid: (id: string, proof?: File, noProofReason?: string) => {
    const form = new FormData();
    if (proof) form.append('proof', proof);
    if (!proof && noProofReason) form.append('noProofReason', noProofReason);
    return request<WagePayment>(`/payments/wages/${id}/mark-paid`, { method: 'POST', body: form });
  },

  /** Adjust the hours actually worked before paying (2h floor — regenerates the Pay Link) */
  adjustWageHours: (id: string, hoursWorked: number, note?: string) =>
    request<WagePayment>(`/payments/wages/${id}/adjust-hours`, {
      method: 'POST', body: JSON.stringify({ hoursWorked, note }),
    }),

  /** Report a problem with a completed shift — pauses reminders, goes to ops review */
  reportWageProblem: (id: string, category: string, note?: string) =>
    request<WagePayment>(`/payments/wages/${id}/report-problem`, {
      method: 'POST', body: JSON.stringify({ category, note }),
    }),

  /** Mark an expired shift as CANCELLED (soft delete) */
  deleteExpiredShift: (id: string) =>
    request<{ message: string }>(`/shifts/${id}/expired`, { method: 'DELETE' }),

  /** Employer directly invites a worker to a shift → PENDING_ACCEPTANCE */
  inviteWorker: (shiftId: string, workerId: string) =>
    request<Shift>(`/shifts/${shiftId}/invite/${workerId}`, { method: 'POST' }),

  getShiftApplications: (id: string) =>
    request<Application[]>(`/shifts/${id}/applications`, { method: 'GET' }),

  approveApplication: (shiftId: string, appId: string) =>
    request<Shift>(`/shifts/${shiftId}/applications/${appId}/approve`, { method: 'POST' }),

  /** Search active workers (80%+ profile) for employer talent browsing */
  searchWorkers: (params?: {
    skills?: string[]; languages?: string[]; available?: string[];
    availableNow?: boolean; minRating?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.skills?.length)    qs.set('skills',    params.skills.join(','));
    if (params?.languages?.length) qs.set('languages', params.languages.join(','));
    if (params?.available?.length) qs.set('available', params.available.join(','));
    if (params?.availableNow)      qs.set('availableNow', 'true');
    if (params?.minRating)         qs.set('minRating', String(params.minRating));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return request<WorkerSearchResult[]>(`/shifts/workers/search${q}`, { method: 'GET' });
  },

  // ── Attendance ─────────────────────────────────────────────────────────────

  /**
   * Fetch the employer's single permanent static check-in QR code (v2.1 —
   * no check-out; shifts auto-complete at scheduled end). Deterministic
   * HMAC token — print once, post at the venue entrance.
   */
  getEmployerQrCodes: () =>
    request<{
      checkInQrDataUrl:  string;
      checkInToken:      string;
      employerName:      string;
    }>('/attendance/employer-qr', { method: 'GET' }),

  /** Employer manually confirms shift completion when QR scanning isn't available. */
  manualConfirmShift: (shiftId: string, note?: string) =>
    request<{ id: string; status: string }>(
      `/attendance/${shiftId}/manual-confirm`,
      { method: 'POST', body: JSON.stringify({ note: note ?? 'Confirmação manual pelo empregador' }) },
    ),

  // ── Compliance ────────────────────────────────────────────────────────────

  /** TSU breakdown per shift for the given month/year. */
  getTsuReport: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year)  params.set('year',  String(year));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<TsuReport>(`/compliance/employer/tsu-report${qs}`, { method: 'GET' });
  },

  /** MCD contracts list (all confirmed shifts with SS Direta notification status). */
  getMcdContracts: () =>
    request<McdContract[]>('/compliance/employer/mcd-contracts', { method: 'GET' }),

  /** Immutable compliance audit trail for ACT inspections. */
  getAuditLog: () =>
    request<AuditLogEntry[]>('/compliance/employer/audit-log', { method: 'GET' }),

  // ── Payments / Billing ────────────────────────────────────────────────────

  /**
   * Create a Stripe SetupIntent so the employer can save a card via
   * Stripe Elements. Returns the client_secret for the frontend to confirm.
   */
  createSetupIntent: () =>
    request<{ clientSecret: string; customerId: string }>(
      '/payments/employer/setup-intent', { method: 'POST' },
    ),

  /** Persist the payment method after the employer confirms it in Elements. */
  savePaymentMethod: (paymentMethodId: string) =>
    request<{ message: string }>(
      '/payments/employer/save-payment-method',
      { method: 'POST', body: JSON.stringify({ paymentMethodId }) },
    ),

  /** Create the €55/mo subscription for the employer. */
  createSubscription: () =>
    request<{ subscriptionId: string; status: string }>(
      '/payments/employer/subscribe', { method: 'POST' },
    ),

  /** Cancel the subscription at the end of the current billing period. */
  cancelSubscription: () =>
    request<{ message: string }>(
      '/payments/employer/cancel-subscription', { method: 'POST' },
    ),

  /** Spending dashboard — shift charges for month or full year. */
  getEmployerSpending: (period: 'month' | 'year', month?: number, year?: number) => {
    const params = new URLSearchParams({ period });
    if (month) params.set('month', String(month));
    if (year)  params.set('year',  String(year));
    return request<SpendingReport>(`/payments/employer/spending?${params.toString()}`, { method: 'GET' });
  },

  // ── Ratings ───────────────────────────────────────────────────────────────

  /** Get a worker's public rating summary (avg, badges, recent ratings). */
  getWorkerRatingSummary: (workerId: string) =>
    request<WorkerRatingSummary>(`/ratings/worker/${workerId}`, { method: 'GET' }),

  /** Check if the current employer has already rated a specific shift. */
  hasRatedShift: (shiftId: string) =>
    request<{ hasRated: boolean }>(`/ratings/shift/${shiftId}/mine`, { method: 'GET' }),

  /** Submit a rating for a completed shift. */
  submitRating: (dto: { shiftId: string; score: number; tags: string[]; review?: string }) =>
    request<{ id: string }>('/ratings', { method: 'POST', body: JSON.stringify(dto) }),

  /** Report a no-show for a shift. */
  reportNoShow: (shiftId: string, note?: string) =>
    request<{ message: string }>(
      `/ratings/no-show/${shiftId}`,
      { method: 'POST', body: JSON.stringify({ note }) },
    ),

  /** List favourite workers. */
  getFavouriteWorkers: () =>
    request<FavouriteWorker[]>('/ratings/favourites', { method: 'GET' }),

  /** Add a worker to favourites. */
  addFavouriteWorker: (workerId: string) =>
    request<{ message: string }>(`/ratings/favourites/${workerId}`, { method: 'POST' }),

  /** Remove a worker from favourites. */
  removeFavouriteWorker: (workerId: string) =>
    request<{ message: string }>(`/ratings/favourites/${workerId}`, { method: 'DELETE' }),
};
