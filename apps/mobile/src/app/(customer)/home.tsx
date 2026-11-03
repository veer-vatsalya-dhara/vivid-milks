import { formatAddress, type CustomerHome, type Day, type Product, type Subscription } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerAlerts } from '@/components/customer-alerts';
import { Icon } from '@/components/icon';
import { AccountButton } from '@/components/mode-tabs';
import { ProductRow, SubscribePill } from '@/components/product-row';
import { Card, Divider, QueryView, Row, Stepper, Text, WalletPill } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDay, formatRelativeDay, formatRupees, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useHome, useProducts, useSubscriptions } from '@/lib/queries';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const home = useHome();
  const products = useProducts();
  const subscriptions = useSubscriptions();
  const refresh = () => Promise.all([home.refetch(), products.refetch(), subscriptions.refetch()]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: Spacing.six }}
      refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void refresh()} />}>
      <QueryView query={home}>
        {(data) => (
          <>
            <Hero home={data} topInset={insets.top} />
            <View style={styles.content}>
              <CustomerAlerts home={data} />
              <BasketSummary day={data.nextDay} products={products.data ?? []} />
              <Text type="subtitle">Milk</Text>
              <Card style={{ gap: 0, paddingVertical: Spacing.two }}>
                {(products.data ?? []).map((product, i) => (
                  <View key={product.id}>
                    {i > 0 && <Divider />}
                    <ShopRow
                      product={product}
                      day={data.nextDay}
                      subscription={subscriptions.data?.find((s) => s.productId === product.id)}
                    />
                  </View>
                ))}
              </Card>
            </View>
          </>
        )}
      </QueryView>
    </ScrollView>
  );
}

function Hero({ home, topInset }: { home: CustomerHome; topInset: number }) {
  const theme = useTheme();
  const address = home.me.address;
  return (
    <View style={[styles.hero, { backgroundColor: theme.primary, paddingTop: topInset + Spacing.three }]}>
      <View style={styles.heroInner}>
        <Row>
          <Icon name="location" color={theme.onPrimary} size={22} />
          <View style={{ flex: 1 }}>
            <Text type="caption" style={{ color: theme.onPrimary, opacity: 0.85 }}>
              Delivering to
            </Text>
            <Text type="smallBold" numberOfLines={1} style={{ color: theme.onPrimary }}>
              {address ? formatAddress(address) : 'Add your address'}
            </Text>
          </View>
          <WalletPill paise={home.wallet.balancePaise} onPress={() => router.push('/wallet')} />
          <AccountButton color={theme.onPrimary} />
        </Row>
        <View style={[styles.promise, { backgroundColor: theme.primaryDark }]}>
          <Icon name="moon" color={theme.accent} size={20} />
          <Text type="smallBold" style={{ color: theme.onPrimary, flex: 1 }}>
            Order till <Text type="smallBold" style={{ color: theme.accent }}>{formatTimeOfDay(home.settings.orderCutoffTime)}</Text>
            {' · '}Delivered by{' '}
            <Text type="smallBold" style={{ color: theme.accent }}>{formatTimeOfDay(home.settings.deliveryTime)}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function BasketSummary({ day, products }: { day: Day; products: Product[] }) {
  const theme = useTheme();
  const count = day.items.reduce((sum, i) => sum + i.qty, 0);
  const names = day.items
    .filter((i) => i.qty > 0)
    .map((i) => {
      const p = products.find((x) => x.id === i.productId);
      return `${i.qty} × ${p?.name ?? ''} ${p?.unitLabel ?? ''}`.trim();
    });
  return (
    <Card onPress={() => router.push('/basket')}>
      <Row>
        <Icon name="basket" color={theme.primary} size={24} />
        <View style={{ flex: 1 }}>
          <Text type="smallBold">
            {formatRelativeDay(day.date)}’s basket · {formatDay(day.date)}
          </Text>
          <Text type="small" themeColor="textSecondary" numberOfLines={1}>
            {count === 0 ? 'Nothing yet. Add milk below.' : names.join(', ')}
          </Text>
        </View>
        <Text type="price">{formatRupees(day.totalPaise)}</Text>
      </Row>
    </Card>
  );
}

function ShopRow({ product, day, subscription }: { product: Product; day: Day; subscription?: Subscription }) {
  const setQty = useApiMutation((qty: number) =>
    api<Day>(`/me/schedule/${day.date}/${product.id}`, { method: 'PUT', body: { qty } }),
  );
  const qty = day.items.find((i) => i.productId === product.id)?.qty ?? 0;
  return (
    <ProductRow
      product={product}
      control={
        day.editable ? (
          <Stepper value={qty} addLabel="ADD" disabled={setQty.isPending} onChange={(n) => setQty.mutate(n)} />
        ) : undefined
      }
      footer={
        <SubscribePill
          dailyQty={subscription?.defaultQty ?? null}
          onPress={() => router.push(`/subscribe/${product.id}`)}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: Spacing.three, borderBottomLeftRadius: Radius.large, borderBottomRightRadius: Radius.large },
  heroInner: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
