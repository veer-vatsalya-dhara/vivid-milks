import { addDays, todayInIst, type CustomerHome, type Day, type Product } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CustomerAlerts } from '@/components/customer-alerts';
import { Icon } from '@/components/icon';
import { ProductRow } from '@/components/product-row';
import { Badge, Button, Card, Divider, QueryView, Row, Screen, Stepper, TabBar, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { dayBadge } from '@/lib/day-status';
import { cutoffText, formatDay, formatRelativeDay, formatRupees, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useHome, useProducts, useSchedule } from '@/lib/queries';

type Tab = 'tomorrow' | 'month';

export default function BasketScreen() {
  const [tab, setTab] = useState<Tab>('tomorrow');
  const home = useHome();
  const products = useProducts();

  return (
    <Screen onRefresh={() => Promise.all([home.refetch(), products.refetch()])} refreshing={home.isRefetching}>
      <QueryView query={home}>
        {(data) => (
          <>
            <TabBar
              tabs={[
                { key: 'tomorrow', label: `${formatRelativeDay(data.nextDay.date)}’s Order` },
                { key: 'month', label: 'Rest of the Month' },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'tomorrow' ? (
              <NextDayOrder home={data} products={products.data ?? []} />
            ) : (
              <RestOfMonth products={products.data ?? []} />
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function NextDayOrder({ home, products }: { home: CustomerHome; products: Product[] }) {
  const theme = useTheme();
  const day = home.nextDay;
  const setQty = useApiMutation(({ productId, qty }: { productId: number; qty: number }) =>
    api<Day>(`/me/schedule/${day.date}/${productId}`, { method: 'PUT', body: { qty } }),
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <>
      <CustomerAlerts home={home} />
      <Row>
        <Text type="smallBold" style={{ flex: 1 }}>
          {formatDay(day.date)}
        </Text>
        <Text type="caption" themeColor="textSecondary">
          Edit till {cutoffText(day.date, home.settings.orderCutoffTime)}
        </Text>
      </Row>

      {day.items.length === 0 ? (
        <Card>
          <Text type="smallBold">Your basket is empty</Text>
          <Text type="small" themeColor="textSecondary">
            Add milk for {formatRelativeDay(day.date).toLowerCase()}, or subscribe for daily delivery.
          </Text>
          <Button title="Browse milk" small onPress={() => router.push('/home')} />
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: Spacing.two }}>
          {day.items.map((item, i) => {
            const product = byId.get(item.productId);
            if (!product) return null;
            return (
              <View key={item.productId}>
                {i > 0 && <Divider />}
                <ProductRow
                  product={product}
                  note={item.qty === 0 ? 'skipped' : item.changed ? 'changed for this day' : undefined}
                  control={
                    <Stepper
                      value={item.qty}
                      disabled={setQty.isPending}
                      onChange={(qty) => setQty.mutate({ productId: item.productId, qty })}
                    />
                  }
                />
              </View>
            );
          })}
        </Card>
      )}

      <Card tone="info">
        <Row>
          <Text type="smallBold" style={{ flex: 1 }}>
            Total
          </Text>
          <Text type="price">{formatRupees(day.totalPaise)}</Text>
        </Row>
        <Row>
          <Icon name="clock" color={theme.primary} size={18} />
          <Text type="small" style={{ flex: 1 }}>
            No checkout needed. Delivered by {formatTimeOfDay(home.settings.deliveryTime)}, paid from your wallet.
          </Text>
        </Row>
      </Card>
    </>
  );
}

const MONTH_DAYS = 30;

function RestOfMonth({ products }: { products: Product[] }) {
  const theme = useTheme();
  const from = useMemo(() => todayInIst(), []);
  const schedule = useSchedule(from, addDays(from, MONTH_DAYS - 1));
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <QueryView query={schedule}>
      {({ days }) => (
        <Card style={{ gap: 0, paddingVertical: Spacing.two }}>
          {days.map((day, i) => {
            const badge = dayBadge(day);
            const summary = day.items
              .filter((it) => it.qty > 0)
              .map((it) => `${it.qty} × ${byId.get(it.productId)?.name ?? ''} ${byId.get(it.productId)?.unitLabel ?? ''}`)
              .join(', ');
            return (
              <View key={day.date}>
                {i > 0 && <Divider />}
                <Card
                  onPress={() => router.push(`/day/${day.date}`)}
                  style={{ borderWidth: 0, paddingHorizontal: 0, paddingVertical: 10, gap: 2 }}>
                  <Row>
                    <Text type="smallBold" style={{ flex: 1 }}>
                      {formatRelativeDay(day.date)}
                    </Text>
                    <Badge label={badge.label} tone={badge.tone} />
                    {day.editable && <Icon name="chevron" color={theme.textSecondary} size={16} />}
                  </Row>
                  <Row>
                    <Text type="small" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                      {summary || '—'}
                    </Text>
                    {day.totalPaise > 0 && <Text type="smallBold">{formatRupees(day.totalPaise)}</Text>}
                  </Row>
                </Card>
              </View>
            );
          })}
        </Card>
      )}
    </QueryView>
  );
}
