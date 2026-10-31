import type { Product } from '@vivid-milks/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRupees } from '@/lib/format';

import { Icon } from './icon';
import { Text } from './ui';

/** Tile colours by milk type, standing in for product photos. */
const THUMB_TINTS: { match: RegExp; background: string; icon: string }[] = [
  { match: /buffalo/i, background: '#FFF1D6', icon: '#E09B00' },
  { match: /toned|skim|low/i, background: '#E3F6EC', icon: '#14945F' },
  { match: /.*/, background: '#E7F1FD', icon: '#1E88E5' },
];

export function ProductThumb({ name, size = 64 }: { name: string; size?: number }) {
  const tint = THUMB_TINTS.find((t) => t.match.test(name))!;
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: tint.background }]}>
      <Icon name="milk" color={tint.icon} size={size * 0.5} />
    </View>
  );
}

/** "Subscribed · 2 daily" or "Subscribe" pill shown under the price. */
export function SubscribePill({ dailyQty, onPress }: { dailyQty: number | null; onPress: () => void }) {
  const theme = useTheme();
  const subscribed = dailyQty !== null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: subscribed ? theme.successBackground : theme.accentBackground },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name="calendar" color={subscribed ? theme.success : theme.warning} size={13} />
      <Text type="caption" themeColor={subscribed ? 'success' : 'warning'}>
        {subscribed ? `Subscribed · ${dailyQty} daily` : 'Subscribe for daily delivery'}
      </Text>
    </Pressable>
  );
}

/**
 * One product: picture, name, pack size and price, with `control` (usually a stepper)
 * on the right and `footer` (e.g. a subscribe pill) under the price.
 */
export function ProductRow({
  product,
  control,
  footer,
  note,
}: {
  product: Pick<Product, 'name' | 'unitLabel' | 'pricePaise'>;
  control?: ReactNode;
  footer?: ReactNode;
  note?: string;
}) {
  return (
    <View style={styles.row}>
      <ProductThumb name={product.name} />
      <View style={styles.body}>
        <Text type="smallBold" numberOfLines={2}>
          {product.name}
        </Text>
        <Text type="small" themeColor="textSecondary">
          {product.unitLabel}
          {note ? ` · ${note}` : ''}
        </Text>
        <View style={styles.priceLine}>
          <Text type="price">{formatRupees(product.pricePaise)}</Text>
          {control}
        </View>
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two },
  body: { flex: 1, gap: 2 },
  priceLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
});
