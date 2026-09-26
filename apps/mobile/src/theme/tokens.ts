/** Neutral page, near-black text, green for check-in and safety orange for check-out; matches the web dashboard. */
export const colors = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  text: '#17171A',
  muted: '#5B5B61',
  line: '#E2E2DE',
  lineSoft: '#EFEFEC',
  inputBorder: '#CFCFCA',
  dark: '#17171A',
  onDark: '#F6F6F4',
  white: '#FFFFFF',

  checkIn: '#15803D',
  checkInShadow: '#0E5A2B',
  checkOut: '#E0500F',
  checkOutShadow: '#9C370A',
  workingSub: '#D5EEDF',
  workingDot: '#8FE0B1',

  successBg: '#E3F3E8',
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

  danger: '#C8321F',
  dangerBg: '#FBE9E6',

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
