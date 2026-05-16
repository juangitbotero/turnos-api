// ─── User Types ──────────────────────────────────────────────────────────────

export type UserRole = 'WORKER' | 'EMPLOYER' | 'ADMIN';

export type WorkerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface BaseUser {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Worker extends BaseUser {
  role: 'WORKER';
  nif: string;
  iban: string;
  fullName: string;
  status: WorkerStatus;
  reputationScore: number;       // 0–100
  profileQualityScore: number;   // 0–100 (AI interview)
  completionRate: number;        // 0–1
}

export interface Employer extends BaseUser {
  role: 'EMPLOYER';
  companyName: string;
  nipc: string;
  sector: string;
}

// ─── Shift Types ─────────────────────────────────────────────────────────────

export type ShiftStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'FILLED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Shift {
  id: string;
  employerId: string;
  title: string;
  role: string;
  location: GeoPoint;
  address: string;
  startTime: string;   // ISO 8601
  endTime: string;     // ISO 8601
  grossHourlyRate: number;  // EUR
  status: ShiftStatus;
  skillsRequired: string[];
  workerId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Compliance Types ─────────────────────────────────────────────────────────

export type ContractType = 'MCD' | 'RECIBO_VERDE';

export interface TSUCalculation {
  grossAmount: number;
  workerDeduction: number;      // 11% of gross
  employerContribution: number; // 23.75% of gross
  turnosFee: number;            // 10% of gross
  workerNetAmount: number;      // gross - workerDeduction - turnosFee
  employerTotalCost: number;    // gross + employerContribution
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TSU_RATES = {
  WORKER_DEDUCTION: 0.11,
  EMPLOYER_CONTRIBUTION: 0.2375,
} as const;

export const TURNOS_FEE_RATE = 0.10 as const;

export const MCD_LIMITS = {
  MAX_DAYS_PER_CONTRACT: 35,
  MAX_DAYS_PER_YEAR_SAME_EMPLOYER: 70,
  SS_NOTIFICATION_WINDOW_HOURS: 24,
} as const;

export const SHIFT_CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const MIN_REST_BETWEEN_SHIFTS_HOURS = 11; // EU Working Time Directive

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Calculates TSU breakdown for a given gross shift amount.
 */
export function calculateTSU(grossAmount: number): TSUCalculation {
  const workerDeduction = grossAmount * TSU_RATES.WORKER_DEDUCTION;
  const employerContribution = grossAmount * TSU_RATES.EMPLOYER_CONTRIBUTION;
  const turnosFee = grossAmount * TURNOS_FEE_RATE;

  return {
    grossAmount,
    workerDeduction,
    employerContribution,
    turnosFee,
    workerNetAmount: grossAmount - workerDeduction - turnosFee,
    employerTotalCost: grossAmount + employerContribution,
  };
}

/**
 * Formats a number as EUR currency string.
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
