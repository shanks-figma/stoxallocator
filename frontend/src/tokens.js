/**
 * StoxAllocator Design System — JS Tokens
 *
 * Use these in React inline styles and component logic.
 * CSS counterparts live in src/design-tokens.css.
 * Tailwind counterparts are in tailwind.config.js under theme.extend.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const color = {
  // Brand
  brandNavy:    "#00419B",
  brandBlue:    "#2A9BCC",
  brandSky:     "#38bdf8",
  brandGradient: "linear-gradient(to right, #00419B, #2A9BCC)",

  // Backgrounds
  bgPage:     "#06090f",
  bgSurface:  "#0d1117",
  bgElevated: "#111827",
  bgInput:    "#0f1623",
  bgHover:    "rgba(255,255,255,0.04)",
  bgActive:   "rgba(255,255,255,0.07)",
  bgOverlay:  "rgba(6,9,15,0.75)",

  // Borders
  borderSubtle:  "rgba(255,255,255,0.06)",
  borderDefault: "rgba(255,255,255,0.10)",
  borderStrong:  "rgba(255,255,255,0.18)",
  borderBrand:   "rgba(42,155,204,0.35)",

  // Text
  textPrimary:   "#ffffff",
  textSecondary: "rgba(255,255,255,0.65)",
  textMuted:     "rgba(255,255,255,0.40)",
  textDisabled:  "rgba(255,255,255,0.20)",
  textInverse:   "#0a0f1a",
  textAccent:    "#38bdf8",

  // Semantic
  positive:    "#10b981",
  positiveDim: "rgba(16,185,129,0.15)",
  negative:    "#ef4444",
  negativeDim: "rgba(239,68,68,0.15)",
  warning:     "#f59e0b",
  warningDim:  "rgba(245,158,11,0.15)",
  info:        "#38bdf8",
  infoDim:     "rgba(56,189,248,0.15)",
};

// ─── Typography ──────────────────────────────────────────────────────────────

export const font = {
  sans:  "'Geist', system-ui, -apple-system, sans-serif",
  serif: "'Young Serif', Georgia, serif",
  mono:  "'JetBrains Mono', 'Fira Code', monospace",
};

export const fontSize = {
  "2xs": 11,
  xs:    12,
  sm:    13.5,
  base:  15,
  md:    16,
  lg:    18,
  xl:    22,
  "2xl": 28,
  "3xl": 36,
  hero:  "clamp(42px, 5vw, 64px)",
};

export const fontWeight = {
  light:    300,
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
};

export const lineHeight = {
  tight:   1.1,
  snug:    1.3,
  normal:  1.5,
  relaxed: 1.65,
};

export const letterSpacing = {
  tight:  "-0.3px",
  normal: "-0.1px",
  wide:   "0.05em",
  wider:  "0.08em",
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
  xs:   4,
  sm:   6,
  base: 8,
  md:   10,
  lg:   12,
  xl:   16,
  full: 9999,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadow = {
  sm:    "0 1px 3px rgba(0,0,0,0.4)",
  base:  "0 4px 12px rgba(0,0,0,0.5)",
  lg:    "0 8px 32px rgba(0,0,0,0.6)",
  brand: "0 4px 20px rgba(42,155,204,0.25)",
};

// ─── Layout ──────────────────────────────────────────────────────────────────

export const layout = {
  containerMax:  1200,
  containerPad:  40,
  navbarHeight:  56,
};

// ─── Transitions ─────────────────────────────────────────────────────────────

export const transition = {
  fast:  "0.12s ease",
  base:  "0.2s ease",
  slow:  "0.35s ease",
};

// ─── Composite Style Objects (ready-to-spread) ───────────────────────────────

/** Primary CTA button */
export const styleBtnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: "11px 24px",
  background: color.brandGradient,
  color: color.textPrimary,
  fontFamily: font.sans,
  fontSize: fontSize.base,
  fontWeight: fontWeight.medium,
  border: "none",
  borderRadius: radius.base,
  cursor: "pointer",
  letterSpacing: letterSpacing.normal,
  transition: `opacity ${transition.base}`,
};

/** Secondary / outlined button */
export const styleBtnSecondary = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: "10px 22px",
  background: "white",
  color: color.textInverse,
  fontFamily: font.sans,
  fontSize: fontSize.base,
  fontWeight: fontWeight.medium,
  border: "1.5px solid rgba(255,255,255,0.85)",
  borderRadius: radius.base,
  cursor: "pointer",
  transition: `background ${transition.base}`,
};

/** Standard card */
export const styleCard = {
  background: color.bgSurface,
  border: `1px solid ${color.borderDefault}`,
  borderRadius: radius.lg,
  padding: space[6],
};

/** Elevated card / modal */
export const styleCardElevated = {
  background: color.bgElevated,
  border: `1px solid ${color.borderSubtle}`,
  borderRadius: radius.lg,
  boxShadow: shadow.lg,
};

/** Form input */
export const styleInput = {
  background: color.bgInput,
  border: `1px solid ${color.borderDefault}`,
  borderRadius: radius.base,
  color: color.textPrimary,
  fontFamily: font.sans,
  fontSize: fontSize.base,
  padding: `9px ${space[3]}px`,
  outline: "none",
};

/** Section label (all-caps, muted) */
export const styleLabel = {
  fontFamily: font.sans,
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  letterSpacing: letterSpacing.wider,
  textTransform: "uppercase",
  color: color.textMuted,
};

/** Page-level container */
export const styleContainer = {
  width: "100%",
  maxWidth: layout.containerMax,
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: layout.containerPad,
  paddingRight: layout.containerPad,
};
