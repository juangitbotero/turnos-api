/**
 * Display translations for DOMAIN DATA — job titles, categories and the
 * languages a worker declares they speak.
 *
 * ⚠️ These Portuguese strings are DATABASE KEYS, not copy. They are stored
 * verbatim in `worker.skills`, `worker.languages`, `shift.subcategory` and
 * `shift.category`. Translation here is **display-only**: the Portuguese value
 * remains the canonical stored form in every language. Writing an English
 * title into those columns would orphan the row exactly the way retiring
 * `Rececionista de hotel` would have — see LEGACY_SKILL_ALIASES.
 *
 * Every map below is a `Record` over the literal union, so adding a job title
 * to SHIFT_CATEGORIES without an English translation is a COMPILE ERROR rather
 * than a Portuguese string silently leaking into the English UI.
 *
 * Type-only imports keep this module free of a runtime cycle with ../index.
 */
import type * as Shared from '../index';
import type { AppLanguage } from './types';
// roles.ts has no imports, so importing it at runtime creates no cycle.
import { getRole, ROLE_CATEGORIES_EN } from '../roles';

type ShiftCategory = Shared.ShiftCategory;
type Language = Shared.Language;

/**
 * Every current role name. The English names live with the role itself in
 * ROLE_CATALOGUE (roles.ts), which the compiler forces to have one.
 */
export type SkillName = Shared.RoleName;

/**
 * English for titles that are no longer in the catalogue but may still be
 * stored on old rows — renamed ones (see LEGACY_SKILL_ALIASES) and the three
 * retired without a replacement (RETIRED_SKILLS).
 */
const LEGACY_SKILLS_EN: Record<string, string> = {
  'Merchandising':               'Merchandising',
  'Atendimento telefónico':      'Phone support',
  'Apoio ao cliente presencial': 'In-person customer support',
  'Gestão de reclamações':       'Complaints handling',
  'Assistente de eventos':       'Event assistant',
  'Segurança de eventos':        'Event security',
  'Assistente de cozinha':       'Kitchen assistant',
  'Assistente de sala':          'Front-of-house assistant',
  'Serviço de quarto':           'Room service',
  'Barman/Barmaid':              'Bartender',
  'Lavador/a de loiça':          'Dishwasher',
  'Segurança/Vigilante':         'Security guard',
  'Preparação de encomendas':    'Order picking',
  'Assistente de armazém':       'Warehouse assistant',
  'Estafeta/Motorista':          'Courier / Driver',
  'Gestão de stock':             'Stock management',
  'Community manager':           'Community manager',
  'Assistente de RH':            'HR assistant',
  'Gestão de escritório':        'Office management',
  'Rececionista de hotel':       'Hotel receptionist',
  'Rececionista de eventos':     'Event receptionist',
};

/** English for shift categories stored before the 2026-10-25 regrouping. */
const LEGACY_CATEGORIES_EN: Record<string, string> = {
  'Vendas':              'Retail & Sales',
  'Hotelaria':           'Hospitality',
  'Restauração':         'Restaurants & Cafes',
  'Limpeza e Segurança': 'Cleaning & Security',
};

/**
 * Employer business sectors, offered at registration and stored verbatim in
 * `employer.sector`. Another Portuguese DATABASE VALUE — the register form must
 * keep submitting 'Restauração' in every language.
 */
export const EMPLOYER_SECTORS = [
  'Restauração', 'Hotelaria', 'Eventos', 'Retalho / Comércio',
  'Logística', 'Saúde', 'Limpeza', 'Segurança', 'Outro',
] as const;

export type EmployerSector = typeof EMPLOYER_SECTORS[number];

const SECTORS_EN: Record<EmployerSector, string> = {
  'Restauração':        'Restaurants & Cafes',
  'Hotelaria':          'Hospitality',
  'Eventos':            'Events',
  'Retalho / Comércio': 'Retail & Commerce',
  'Logística':          'Logistics',
  'Saúde':              'Healthcare',
  'Limpeza':            'Cleaning',
  'Segurança':          'Security',
  'Outro':              'Other',
};

/** Display name for a stored employer sector. */
export function translateSector(sector: string, lang: AppLanguage): string {
  if (lang === 'pt') return sector;
  return SECTORS_EN[sector as EmployerSector] ?? sector;
}

/** The languages a worker can declare speaking — profile data, stored in PT. */
const WORKER_LANGUAGES_EN: Record<Language, string> = {
  'Português': 'Portuguese',
  'Inglês':    'English',
  'Espanhol':  'Spanish',
  'Francês':   'French',
  'Alemão':    'German',
  'Italiano':  'Italian',
  'Árabe':     'Arabic',
  'Mandarim':  'Mandarin',
  'Russo':     'Russian',
  'Ucraniano': 'Ukrainian',
  'Romeno':    'Romanian',
  'Hindi':     'Hindi',
};

/**
 * Display name for a stored job title. Unknown values (legacy rows, custom
 * roles typed by an employer) pass through untouched rather than vanishing.
 */
export function translateSkill(skill: string, lang: AppLanguage): string {
  if (lang === 'pt') return skill;
  return getRole(skill)?.en ?? LEGACY_SKILLS_EN[skill] ?? skill;
}

/** Display name for a stored shift category. */
export function translateCategory(category: string, lang: AppLanguage): string {
  if (lang === 'pt') return category;
  return ROLE_CATEGORIES_EN[category as ShiftCategory] ?? LEGACY_CATEGORIES_EN[category] ?? category;
}

/** Display name for a language a worker speaks. */
export function translateWorkerLanguage(language: string, lang: AppLanguage): string {
  if (lang === 'pt') return language;
  return WORKER_LANGUAGES_EN[language as Language] ?? language;
}

/** Convenience for lists. */
export function translateSkills(skills: readonly string[], lang: AppLanguage): string[] {
  return skills.map(s => translateSkill(s, lang));
}

/**
 * The weekday abbreviations stored in `worker.availableDays`. Like job titles,
 * these are Portuguese DATABASE VALUES — a day button must keep sending 'Seg'
 * in every language. Only the label on it changes, via the catalogue key this
 * maps to (`domain.weekdaysShort.*`).
 */
export const STORED_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const WEEKDAY_KEYS: readonly WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Catalogue key for a stored weekday, or null if it is not one we recognise. */
export function weekdayKey(storedDay: string): WeekdayKey | null {
  const i = STORED_WEEKDAYS.indexOf(storedDay as typeof STORED_WEEKDAYS[number]);
  return i === -1 ? null : WEEKDAY_KEYS[i]!;
}
