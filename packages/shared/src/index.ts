// ─── Design Tokens ───────────────────────────────────────────────────────────
// Colors, spacing, radius, typography — single source of truth for all UI
export * from './design-tokens';

// ─── User Types ──────────────────────────────────────────────────────────────


export type UserRole = 'WORKER' | 'EMPLOYER' | 'ADMIN';

/** Worker account lifecycle */
export type WorkerStatus =
  | 'INCOMPLETE'      // Just registered, profile not submitted
  | 'PENDING_REVIEW'  // Profile submitted, waiting for Turnos team approval
  | 'ACTIVE'          // Approved, can apply for shifts
  | 'SUSPENDED'       // Temporarily blocked
  | 'REJECTED';       // Rejected after review

/** Employer subscription tiers */
export type SubscriptionTier = 'NONE' | 'STARTER' | 'PRO';

/** Role-based access for employer accounts */
export type EmployerRole = 'ADMIN' | 'MANAGER' | 'VIEWER';

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
  fullName?: string;
  nif?: string;
  iban?: string;
  photoUrl?: string;
  skills?: string[];
  availableDays?: string[];
  status: WorkerStatus;
  isVerified: boolean;
  profileQualityScore: number;  // 0–100, rule-based
  reputationScore: number;      // 0–100
  completionRate: number;       // 0–1
}

export interface Employer extends BaseUser {
  role: 'EMPLOYER';
  companyName: string;
  nipc: string;
  nif?: string;
  sector?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  logoUrl?: string;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface SendOtpDto {
  phone: string;
}

export interface VerifyOtpDto {
  phone: string;
  code: string;
}

export interface RegisterEmployerDto {
  companyName: string;
  nipc: string;
  nif?: string;
  sector: string;
  address: string;
  postalCode: string;
  city: string;
  adminEmail: string;
  adminPassword: string;
}

export interface UpdateWorkerProfileDto {
  fullName: string;
  nif: string;
  iban: string;
  skills: string[];
  availableDays: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
  role: string; // Keep for legacy/custom roles
  category: string;
  subcategory: string;
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

export const SHIFT_CATEGORIES = {
  'Vendas': [
    'Vendedor/a de loja',
    'Operador/a de caixa',
    'Promotor/a de vendas',
    'Merchandising',
  ],
  'Apoio ao Cliente': [
    'Atendimento telefónico',
    'Teleoperador/a',
    'Apoio ao cliente presencial',
    'Gestão de reclamações',
  ],
  'Eventos': [
    'Assistente de eventos',
    'Rececionista de eventos',
    'Animador/a',
    'Segurança de eventos',
    'Montagem e desmontagem',
  ],
  'Hotelaria': [
    'Rececionista de hotel',
    'Barista',
    'Assistente de cozinha',
    'Assistente de sala',
    'Serviço de quarto',
  ],
  'Restauração': [
    'Empregado/a de mesa',
    'Barman/Barmaid',
    'Barista',
    'Cozinheiro/a',
    'Padeiro/a',
    'Pasteleiro/a',
  ],
  'Logística': [
    'Preparação de encomendas',
    'Assistente de armazém',
    'Estafeta/Motorista',
    'Gestão de stock',
  ],
  'Administração': [
    'Assistente administrativo/a',
    'Community manager',
    'Assistente de RH',
    'Gestão de escritório',
  ],
} as const;

export type ShiftCategory = keyof typeof SHIFT_CATEGORIES;

/** All unique subcategories across all shift categories — used as the worker skills pool */
export const ALL_SKILLS: string[] = [
  ...new Set(
    (Object.values(SHIFT_CATEGORIES) as unknown as string[][]).flat()
  ),
].sort();

/** Languages workers can speak / employers can require */
export const LANGUAGES = [
  'Português',
  'Inglês',
  'Espanhol',
  'Francês',
  'Alemão',
  'Italiano',
  'Árabe',
  'Mandarim',
  'Russo',
  'Ucraniano',
  'Romeno',
  'Hindi',
] as const;

export type Language = typeof LANGUAGES[number];

// ─── Compliance Types ─────────────────────────────────────────────────────────

export type ContractType = 'MCD' | 'RECIBO_VERDE';

/**
 * Informative TSU/SS breakdown. Turnos does not withhold, collect, or route any
 * of these amounts — the employer pays the worker directly and settles SS
 * obligations itself. These values are shown as guidance only.
 */
export interface TSUCalculation {
  grossAmount: number;
  workerDeduction: number;      // 11% of gross — worker's SS share (informative)
  employerContribution: number; // 23.75% of gross — employer's SS share (informative)
  workerNetAmount: number;      // gross - workerDeduction (informative estimate)
  employerTotalCost: number;    // gross + employerContribution (informative)
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

/**
 * Fixed platform fee charged to the COMPANY per completed shift (checkout done).
 * Accumulated as metered usage and invoiced monthly alongside the subscription.
 * Deliberately a fixed amount, not a % of gross: a percentage indexed to the
 * worker's remuneration would re-create employment-intermediary optics.
 */
export const TURNOS_FEE_FIXED_EUR = 3 as const;

/** Monthly subscription tiers (EUR). */
export const SUBSCRIPTION_TIERS = {
  STARTER: { name: 'Turnos Starter', monthlyEur: 45, maxActiveShifts: 15, seats: 1, shiftFeeEur: 3 },
  PRO:     { name: 'Turnos Pro',     monthlyEur: 99, maxActiveShifts: null, seats: 5, shiftFeeEur: 2 },
} as const;

/**
 * How the company pays the worker. Chosen at shift publish; payment happens
 * directly company → worker and never passes through Turnos.
 */
export type PaymentMethod = 'TURNOS_PAY_LINK' | 'TRANSFERENCIA' | 'MBWAY' | 'NUMERARIO';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TURNOS_PAY_LINK: 'Turnos Pay Link',
  TRANSFERENCIA:   'Transferência bancária',
  MBWAY:           'MB WAY',
  NUMERARIO:       'Numerário',
} as const;

/** Recommended default — leaves a paper trail and automates payment confirmation. */
export const RECOMMENDED_PAYMENT_METHOD: PaymentMethod = 'TURNOS_PAY_LINK';

export const MCD_LIMITS = {
  MAX_DAYS_PER_CONTRACT: 35,
  MAX_DAYS_PER_YEAR_SAME_EMPLOYER: 70,
  SS_NOTIFICATION_WINDOW_HOURS: 24,
} as const;

export const SHIFT_CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const MIN_REST_BETWEEN_SHIFTS_HOURS = 11; // EU Working Time Directive

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Calculates the informative TSU/SS breakdown for a given gross shift amount.
 * No Turnos fee is involved in the worker's pay: the worker receives the full
 * gross from the company; the €3 platform fee is billed to the company
 * separately (see TURNOS_FEE_FIXED_EUR).
 */
export function calculateTSU(grossAmount: number): TSUCalculation {
  const workerDeduction = grossAmount * TSU_RATES.WORKER_DEDUCTION;
  const employerContribution = grossAmount * TSU_RATES.EMPLOYER_CONTRIBUTION;

  return {
    grossAmount,
    workerDeduction,
    employerContribution,
    workerNetAmount: grossAmount - workerDeduction,
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

// ─── Portugal Validation Utilities ───────────────────────────────────────────

/**
 * Validates a Portuguese NIF (Número de Identificação Fiscal).
 * Rules: 9 digits, first digit 1–9, checksum verified.
 */
export function isValidNIF(nif: string): boolean {
  const n = nif.replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) return false;
  if (n[0] === '0') return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(n[i]!) * (9 - i);
  }
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return checkDigit === parseInt(n[8]!);
}

/**
 * Validates a Portuguese IBAN (PT50... format, 25 chars).
 */
export function isValidIBAN(iban: string): boolean {
  const n = iban.replace(/\s/g, '').toUpperCase();
  if (!n.startsWith('PT') || n.length !== 25) return false;
  // Basic mod-97 check
  const rearranged = n.slice(4) + n.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + parseInt(char)) % 97;
  }
  return remainder === 1;
}

/**
 * Validates a Portuguese NIPC (Número de Identificação de Pessoa Colectiva).
 * Same format as NIF but first digit is 5, 6, 7, 8, or 9.
 */
export function isValidNIPC(nipc: string): boolean {
  const n = nipc.replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) return false;
  if (!['5', '6', '7', '8', '9'].includes(n[0]!)) return false;
  return isValidNIF(n); // Same checksum algorithm
}

/**
 * Validates a Portuguese postal code (XXXX-XXX format).
 */
export function isValidPostalCode(code: string): boolean {
  return /^\d{4}-\d{3}$/.test(code.trim());
}

// ─── Profile Quality Score ────────────────────────────────────────────────────

export interface ProfileQualityInput {
  hasPhoto: boolean;
  hasValidNif: boolean;
  hasValidIban: boolean;
  skillsCount: number;       // number of skills selected
  hasFullName: boolean;
  hasAvailability: boolean;  // at least 1 day selected
}

export interface ProfileQualityResult {
  score: number;             // 0–100
  status: 'INCOMPLETE' | 'PENDING_REVIEW' | 'ACTIVE';
  breakdown: Record<string, number>;
  missingItems: string[];
}

/**
 * Rule-based Profile Quality Score calculator.
 * Replaces the AI interview for the Lisbon beta.
 *
 * Scoring:
 *   Photo uploaded           → +20pts
 *   Valid NIF                → +20pts
 *   Valid IBAN               → +20pts
 *   ≥3 skills selected       → +20pts (partial: 1–2 skills → +10pts)
 *   Full name entered        → +10pts
 *   Availability set         → +10pts
 *
 * Thresholds:
 *   ≥80 → PENDING_REVIEW (auto-queue for team approval)
 *   <80 → INCOMPLETE (app prompts to complete)
 */
export function calculateProfileQualityScore(
  input: ProfileQualityInput,
): ProfileQualityResult {
  const breakdown: Record<string, number> = {
    photo:        input.hasPhoto          ? 20 : 0,
    nif:          input.hasValidNif       ? 20 : 0,
    iban:         input.hasValidIban      ? 20 : 0,
    skills:       input.skillsCount >= 3  ? 20 : input.skillsCount >= 1 ? 10 : 0,
    fullName:     input.hasFullName       ? 10 : 0,
    availability: input.hasAvailability   ? 10 : 0,
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const missingItems: string[] = [];
  if (!input.hasPhoto)         missingItems.push('Fotografia de perfil');
  if (!input.hasValidNif)      missingItems.push('NIF válido');
  if (!input.hasValidIban)     missingItems.push('IBAN válido (conta bancária)');
  if (input.skillsCount === 0) missingItems.push('Pelo menos 1 competência selecionada');
  if (!input.hasFullName)      missingItems.push('Nome completo');
  if (!input.hasAvailability)  missingItems.push('Disponibilidade semanal');

  const status: ProfileQualityResult['status'] =
    score >= 80 ? 'PENDING_REVIEW' : 'INCOMPLETE';

  return { score, status, breakdown, missingItems };
}

// ─── Ratings & Reputation (Stint 7) ──────────────────────────────────────────

/** Worker trust badges, auto-awarded based on rating + performance thresholds */
export type WorkerBadge = 'TOP_RATED' | 'RELIABLE' | 'VERIFIED';

/** Summary of a worker's reputation as seen by the employer */
export interface WorkerRatingSummary {
  avgRating: number | null;       // 1.0–5.0; null if no ratings yet
  totalRatings: number;
  noShowCount: number;
  completionRate: number;         // 0–1
  badges: WorkerBadge[];
  recentRatings: Array<{
    score: number;
    tags: string[];
    comment?: string;
    createdAt: string;
  }>;
}

/** Tag options for employer-rates-worker ratings (Portuguese labels) */
export const WORKER_RATING_TAGS = [
  { key: 'pontual',      label: 'Pontual' },
  { key: 'profissional', label: 'Profissional' },
  { key: 'comunicativo', label: 'Comunicativo' },
  { key: 'boa_atitude',  label: 'Boa atitude' },
] as const;

export type WorkerRatingTagKey = typeof WORKER_RATING_TAGS[number]['key'];

/** Thresholds for badge award and no-show review trigger */
export const BADGE_THRESHOLDS = {
  TOP_RATED_MIN_AVG:        4.5,
  TOP_RATED_MIN_SHIFTS:     10,
  RELIABLE_MIN_COMPLETION:  0.90,
  RELIABLE_MIN_SHIFTS:      20,
  NO_SHOW_REVIEW_THRESHOLD: 3,
  NO_SHOW_REVIEW_DAYS:      60,
} as const;
