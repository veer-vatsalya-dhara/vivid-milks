import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
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

import { Fonts, MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRupees } from '@/lib/format';

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

/**
 * − qty + control with outlined square buttons. With `addLabel`, a quantity of 0
 * shows a single ADD button instead.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled = false,
  addLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  addLabel?: string;
}) {
  const theme = useTheme();
  if (addLabel && value === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => onChange(1)}
        style={({ pressed }) => [
          styles.addButton,
          { borderColor: theme.primary, backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          {addLabel}
        </ThemedText>
      </Pressable>
    );
  }
  const step = (delta: number, label: string) => {
    const next = value + delta;
    const blocked = disabled || next < min || next > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={blocked}
        onPress={() => onChange(next)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.stepButton,
          { borderColor: theme.primary, backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
          blocked && styles.disabled,
        ]}>
        <ThemedText type="subtitle" style={{ color: theme.primary, lineHeight: 22 }}>
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

/** Green pill with the wallet balance, as in the top corner of the basket. */
export function WalletPill({ paise, onPress }: { paise: number; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Wallet balance ${formatRupees(paise)}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.walletPill,
        { backgroundColor: paise < 0 ? theme.danger : theme.success },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        {formatRupees(paise)}
      </ThemedText>
    </Pressable>
  );
}

/** Underlined text tabs, e.g. "Tomorrow's Order | Rest of the Month". */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, selected && { borderBottomColor: theme.primary }]}>
            <ThemedText type="smallBold" themeColor={selected ? 'primary' : 'textSecondary'}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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

/** A field that opens a list to pick one option from. */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  error,
  emptyText = 'Nothing to choose from yet.',
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  emptyText?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.input,
          styles.select,
          { backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText style={styles.flex} themeColor={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="caption" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement }]} onPress={() => {}}>
            <ThemedText type="subtitle" style={{ padding: Spacing.three, paddingBottom: Spacing.two }}>
              {label}
            </ThemedText>
            <ScrollView style={{ maxHeight: 420 }}>
              {options.length === 0 && (
                <ThemedText themeColor="textSecondary" style={{ padding: Spacing.three }}>
                  {emptyText}
                </ThemedText>
              )}
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      { borderTopColor: theme.border },
                      isSelected && { backgroundColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type={isSelected ? 'smallBold' : 'default'} themeColor={isSelected ? 'primary' : 'text'}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
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
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' },
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
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    minWidth: 104,
    height: 34,
    borderRadius: Radius.small,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  walletPill: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, gap: Spacing.four },
  tab: { paddingVertical: Spacing.two, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  stepValue: { minWidth: 24, textAlign: 'center' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.small, alignSelf: 'flex-start' },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.four },
  sheet: {
    borderRadius: Radius.large,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingBottom: Spacing.two,
  },
  option: { paddingHorizontal: Spacing.three, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerText: { textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
