import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'caption' | 'price';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22 },
  title: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 30 },
  subtitle: { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 24 },
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19 },
  smallBold: { fontFamily: Fonts.semiBold, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15 },
  price: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
});
