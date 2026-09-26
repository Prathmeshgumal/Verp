/** Site Ledger theme (docs/design/README.md). */
export const colors = {
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  text: '#1B1D1F',
  muted: '#4A4944',
  line: '#DDD6C8',
  lineSoft: '#EDE7DA',
  inputBorder: '#CFC7B6',
  dark: '#1B1D1F',
  onDark: '#F4F1EA',
  white: '#FFFFFF',

  checkIn: '#1E6B45',
  checkInShadow: '#144A30',
  checkOut: '#B8480F',
  checkOutShadow: '#7E300A',
  workingSub: '#D5EEDF',
  workingDot: '#8FE0B1',

  successBg: '#E3F0E8',
  successText: '#123D28',
  successMuted: '#2E5140',

  problemBg: '#FBEBDD',
  problemText: '#5C2306',
  problemMuted: '#6B3A1C',

  warnBg: '#FCEBD0',
  warnBorder: '#E3A64B',
  warnText: '#5A2E00',
  warnMuted: '#7A3E00',
  warnIconBg: '#F6D39B',

  info: '#1F4E8C',
  infoBg: '#E1EAF6',
  infoRing: '#C9D8EC',
  infoHalo: '#E6EDF6',
  infoText: '#16365F',
} as const;

export const fonts = {
  heading: 'Archivo-ExtraBold',
  body: 'PublicSans-Regular',
  bodyMedium: 'PublicSans-Medium',
  bodySemi: 'PublicSans-SemiBold',
  bodyBold: 'PublicSans-Bold',
  mono: 'IBMPlexMono-Medium',
  monoSemi: 'IBMPlexMono-SemiBold',
} as const;

export const radius = { sm: 10, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Minimum worker touch target (spec §9). */
export const TOUCH_MIN = 64;
