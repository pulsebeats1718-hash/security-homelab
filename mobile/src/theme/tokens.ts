/**
 * Sophie design tokens. A warm, low-glare dark palette: ink backgrounds, ivory
 * text and a single "brass" accent, with sage/rose reserved for feedback.
 */
export const colors = {
  ink: "#0B0D12",
  inkDeep: "#07080C",
  surface: "#12151C",
  surfaceRaised: "#181C25",
  surfacePressed: "#1E2330",
  hairline: "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.12)",

  text: "#F4F1EA",
  textMuted: "#A9ADB8",
  textFaint: "#6E7383",

  accent: "#E9B68A",
  accentStrong: "#F2C39A",
  accentInk: "#2A1A0E",
  accentSoft: "rgba(233,182,138,0.14)",

  plum: "#2B1F3A",
  plumDeep: "#1A1424",

  sage: "#93C5A8",
  sageSoft: "rgba(147,197,168,0.14)",
  rose: "#EE8F86",
  roseSoft: "rgba(238,143,134,0.14)",
  sky: "#8DB7E8",
  skySoft: "rgba(141,183,232,0.14)",

  danger: "#E5544B",
  overlay: "rgba(7,8,12,0.55)",
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_400Regular_Italic",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  quote: { fontFamily: fonts.displayItalic, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24 },
  callout: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: "uppercase" as const },
} as const;

export type TypeVariant = keyof typeof type;
