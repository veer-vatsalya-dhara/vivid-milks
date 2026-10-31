import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export { ThemedText as Text } from './themed-text';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

type Tone = 'default' | 'info' | 'success' | 'warning' | 'danger';

const TONE_COLORS: Record<Tone, { background: ThemeColor; border: ThemeColor }> = {
  default: { background: 'backgroundElement', border: 'border' },
  info: { background: 'backgroundSelected', border: 'backgroundSelected' },
  success: { background: 'successBackground', border: 'successBackground' },
  warning: { background: 'warningBackground', border: 'warningBackground' },
  danger: { background: 'dangerBackground', border: 'dangerBackground' },
};

export function Card({
  children,
  tone = 'default',
  style,
  onPress,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const colors = TONE_COLORS[tone];
  const cardStyle = [
    styles.card,
    { backgroundColor: theme[colors.background], borderColor: theme[colors.border] },
    style,
  ];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Row({
  children,
  style,
  gap = Spacing.two,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row style={styles.sectionTitle}>
      <ThemedText type="subtitle" style={styles.flex}>
        {children}
      </ThemedText>
      {action}
    </Row>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const theme = useTheme();
  const background = {
    primary: theme.primary,
    secondary: theme.backgroundSelected,
    danger: theme.dangerBackground,
    ghost: 'transparent',
  }[variant];
  const color = {
    primary: theme.onPrimary,
    secondary: theme.primary,
    danger: theme.danger,
    ghost: theme.primary,
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background },
        pressed && styles.pressed,
        inactive && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** − qty + control. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const step = (delta: number, label: string) => {
    const next = value + delta;
    const blocked = disabled || next < min || next > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={blocked}
        onPress={() => onChange(next)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.stepButton,
          { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
          blocked && styles.disabled,
        ]}>
        <ThemedText type="subtitle" style={{ color: theme.primary }}>
          {delta > 0 ? '+' : '−'}
        </ThemedText>
      </Pressable>
    );
  };
  return (
    <Row gap={Spacing.two}>
      {step(-1, 'Decrease')}
      <ThemedText type="subtitle" style={styles.stepValue} accessibilityLiveRegion="polite">
        {value}
      </ThemedText>
      {step(1, 'Increase')}
    </Row>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const text: Record<Tone, ThemeColor> = {
    default: 'textSecondary',
    info: 'primary',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  };
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: theme[tone === 'default' ? 'background' : TONE_COLORS[tone].background] },
      ]}>
      <ThemedText type="caption" themeColor={text[tone]}>
        {label}
      </ThemedText>
    </View>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border },
        ]}
        {...input}
      />
      {error ? (
        <ThemedText type="caption" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <ThemedText style={styles.centerText}>{error.message}</ThemedText>
      <Button title="Try again" onPress={onRetry} variant="secondary" />
    </View>
  );
}

/** Renders loading and error states for a query, and `children` once data is available. */
export function QueryView<T>({
  query,
  children,
}: {
  query: { data: T | undefined; error: Error | null; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <Loading />;
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

export const styles = StyleSheet.create({
  screen: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.large, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  sectionTitle: { marginTop: Spacing.two },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: Spacing.three },
  stepButton: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.small, alignSelf: 'flex-start' },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 48, fontSize: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerText: { textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
