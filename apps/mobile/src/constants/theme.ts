export const Colors = {
  light: {
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#F3F5F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7F1FD',
    border: '#E5E9F0',
    primary: '#1E88E5',
    primaryDark: '#1565C0',
    onPrimary: '#FFFFFF',
    accent: '#FFB300',
    accentBackground: '#FFF4D9',
    success: '#0E9F6E',
    successBackground: '#E5F6EF',
    warning: '#B45309',
    warningBackground: '#FFF4E5',
    danger: '#D93025',
    dangerBackground: '#FDECEA',
    thumb: '#EAF3FD',
  },
  dark: {
    text: '#F1F3F5',
    textSecondary: '#A9AEB6',
    background: '#0F1114',
    backgroundElement: '#1B1E23',
    backgroundSelected: '#17304D',
    border: '#2C3036',
    primary: '#4DA3F2',
    primaryDark: '#1E88E5',
    onPrimary: '#FFFFFF',
    accent: '#FFC94D',
    accentBackground: '#3A2E12',
    success: '#3CCB8E',
    successBackground: '#143326',
    warning: '#F0B35A',
    warningBackground: '#3A2A12',
    danger: '#FF6B6B',
    dangerBackground: '#3D1B1B',
    thumb: '#1D2A3A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Poppins weights loaded in the root layout. Android ignores `fontWeight` for custom fonts, so pick by family. */
export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { small: 6, medium: 10, large: 14, pill: 999 } as const;

export const MaxContentWidth = 800;
