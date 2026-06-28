export const colors = {
  bg: "#f3f6fb",
  bgDeep: "#e6edf7",
  surface: "#f8fafc",
  card: "#ffffff",
  elevated: "#ffffff",

  text: "#0b1220",
  textSoft: "#26364d",
  muted: "#667085",
  faint: "#98a2b3",
  border: "#d7e0ea",
  borderSoft: "#e6edf5",

  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  primarySoft: "#dbeafe",
  primaryTint: "#eff6ff",

  navy: "#0f172a",
  navySoft: "#e0ecff",

  success: "#12a150",
  successSoft: "#dcfce7",
  warning: "#f59e0b",
  warningSoft: "#fef3c7",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  info: "#2563eb",
  infoSoft: "#dbeafe",

  shadow: "#101828",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
  page: 18,
  card: 16,
};

export const radius = {
  sm: 10,
  md: 15,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const type = {
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  h2: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  body: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
};

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
};
