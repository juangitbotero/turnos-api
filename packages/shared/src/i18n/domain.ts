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

type ShiftCategory = Shared.ShiftCategory;
type Language = Shared.Language;

/**
 * Every job title declared in SHIFT_CATEGORIES, derived rather than written
 * out — adding a title there without translating it below fails to compile,
 * and the union can never drift from the real list.
 */
export type SkillName = typeof Shared.SHIFT_CATEGORIES[ShiftCategory][number];

const SKILLS_EN: Record<SkillName, string> = {
  // Vendas
  'Vendedor/a de loja':          'Shop assistant',
  'Operador/a de caixa':         'Cashier',
  'Promotor/a de vendas':        'Sales promoter',
  'Merchandising':               'Merchandising',
  // Apoio ao Cliente
  'Atendimento telefónico':      'Phone support',
  'Teleoperador/a':              'Call centre operator',
  'Apoio ao cliente presencial': 'In-person customer support',
  'Gestão de reclamações':       'Complaints handling',
  // Eventos
  'Assistente de eventos':       'Event assistant',
  'Rececionista':                'Receptionist',
  'Animador/a':                  'Entertainer',
  'Segurança de eventos':        'Event security',
  'Montagem e desmontagem':      'Set-up & breakdown',
  // Hotelaria
  'Barista':                     'Barista',
  'Assistente de cozinha':       'Kitchen assistant',
  'Assistente de sala':          'Front-of-house assistant',
  'Serviço de quarto':           'Room service',
  // Restauração
  'Empregado/a de mesa':         'Waiter / Waitress',
  'Barman/Barmaid':              'Bartender',
  'Cozinheiro/a':                'Cook',
  'Lavador/a de loiça':          'Dishwasher',
  'Padeiro/a':                   'Baker',
  'Pasteleiro/a':                'Pastry chef',
  // Limpeza e Segurança
  'Empregado/a de limpeza':      'Cleaner',
  'Técnico/a de manutenção':     'Maintenance technician',
  'Segurança/Vigilante':         'Security guard',
  // Logística
  'Preparação de encomendas':    'Order picking',
  'Assistente de armazém':       'Warehouse assistant',
  'Estafeta/Motorista':          'Courier / Driver',
  'Gestão de stock':             'Stock management',
  // Administração
  'Assistente administrativo/a': 'Administrative assistant',
  'Community manager':           'Community manager',
  'Assistente de RH':            'HR assistant',
  'Gestão de escritório':        'Office management',
};

const CATEGORIES_EN: Record<ShiftCategory, string> = {
  'Vendas':              'Retail & Sales',
  'Apoio ao Cliente':    'Customer Support',
  'Eventos':             'Events',
  'Hotelaria':           'Hospitality',
  'Restauração':         'Food & Beverage',
  'Limpeza e Segurança': 'Cleaning & Security',
  'Logística':           'Logistics',
  'Administração':       'Administration',
};

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
  return SKILLS_EN[skill as SkillName] ?? skill;
}

/** Display name for a stored shift category. */
export function translateCategory(category: string, lang: AppLanguage): string {
  if (lang === 'pt') return category;
  return CATEGORIES_EN[category as ShiftCategory] ?? category;
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
