// =============================================================================
// Turnos Design Tokens
// Single source of truth for all colors, spacing, typography and radii.
// Used by apps/mobile (React Native) and apps/web-admin (Next.js/CSS vars).
//
// Reference: docs/brand/DESIGN_SYSTEM.md
// =============================================================================

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: '#6a79ff',       // Turnos Blue — buttons, links, active states, logo
  primaryDark: '#5260e0',   // Pressed/hover state
  primaryLight: '#eef0ff',  // Chip/tag backgrounds, highlight rows

  // Backgrounds
  secondary: '#fafdff',     // ALL screen and card backgrounds (white-first)

  // Neutral
  neutral: '#d9d9d9',       // Dividers, borders, disabled states only

  // Text
  textPrimary: '#1a1a2e',   // Headings, body copy
  textSecondary: '#6b7280', // Subtitles, captions, placeholders

  // Semantic
  success: '#22c55e',       // Shift confirmed, payment received, check-in
  warning: '#f59e0b',       // MCD limit approaching, low score
  error: '#ef4444',         // Validation errors, failed payment

  // Always
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof colors;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// All spacing values are multiples of 4px

export const spacing = {
  xs: 4,    // Icon padding, tight gaps
  sm: 8,    // Inner component padding
  md: 16,   // Standard screen/card padding
  lg: 24,   // Section spacing
  xl: 32,   // Screen top padding
  xxl: 48,  // Hero sections
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: 8,      // Tags, chips, inputs
  md: 12,     // Cards, modals
  lg: 20,     // Bottom sheets, large cards
  full: 9999, // Pill buttons, avatars
} as const;

export type RadiusKey = keyof typeof radius;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontSize = {
  caption: 12,
  body: 15,
  h3: 18,
  h2: 22,
  h1: 28,
} as const;

export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

// ─── Shadows (React Native) ───────────────────────────────────────────────────

export const shadows = {
  card: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3, // Android
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
