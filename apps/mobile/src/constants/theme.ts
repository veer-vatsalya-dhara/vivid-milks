export const Colors = {
  light: {
    text: '#1A1D21',
    textSecondary: '#60646C',
    background: '#F5F7FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6EEFB',
    border: '#E1E4E8',
    primary: '#1F6FEB',
    onPrimary: '#FFFFFF',
    success: '#1A7F37',
    successBackground: '#E6F4EA',
    warning: '#8A5A00',
    warningBackground: '#FFF4D6',
    danger: '#C62828',
    dangerBackground: '#FDECEC',
  },
  dark: {
    text: '#F1F3F5',
    textSecondary: '#A9AEB6',
    background: '#0F1114',
    backgroundElement: '#1B1E23',
    backgroundSelected: '#1D2B44',
    border: '#2C3036',
    primary: '#4C8DFF',
    onPrimary: '#FFFFFF',
    success: '#4CC26B',
    successBackground: '#173322',
    warning: '#E0B44C',
    warningBackground: '#3A2E12',
    danger: '#FF6B6B',
    dangerBackground: '#3D1B1B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { small: 8, medium: 12, large: 16, pill: 999 } as const;

export const MaxContentWidth = 800;
