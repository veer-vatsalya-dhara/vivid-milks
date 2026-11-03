import { firstEditableDate } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { ProductRow } from '@/components/product-row';
import { Button, Card, Divider, Row, Screen, Stepper, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDay, formatRelativeDay, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, usePause, useProducts, useSettings, useSubscriptions } from '@/lib/queries';

export default function SubscriptionsScreen() {
  const theme = useTheme();
  const subscriptions = useSubscriptions();
  const products = useProducts();
  const pause = usePause();
  const settings = useSettings();
  const startsOn = settings.data && firstEditableDate(settings.data.orderCutoffTime);

  const setQty = useApiMutation(({ productId, defaultQty }: { productId: number; defaultQty: number }) =>
    api(`/me/subscriptions/${productId}`, { method: 'PUT', body: { defaultQty } }),
  );
  const resume = useApiMutation(() => api('/me/pause', { method: 'DELETE' }));

  const subs = subscriptions.data ?? [];
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]));
  const others = (products.data ?? []).filter((p) => !subs.some((s) => s.productId === p.id));
  const activePause = pause.data?.pause;

  return (
    <Screen
      onRefresh={() => Promise.all([subscriptions.refetch(), products.refetch(), pause.refetch()])}
      refreshing={subscriptions.isRefetching}>
      <Text type="small" themeColor="textSecondary">
        Delivered every morning. To change just one day, use My Basket.
      </Text>
      {startsOn && settings.data && (
        <Card tone="info">
          <Text type="small">
            Changes you make now start from{' '}
            <Text type="smallBold">
              {formatRelativeDay(startsOn) === 'Tomorrow' ? 'tomorrow' : formatRelativeDay(startsOn)} ({formatDay(startsOn)})
            </Text>
            . Changes after {formatTimeOfDay(settings.data.orderCutoffTime)} apply from the day
            after tomorrow.
          </Text>
        </Card>
      )}

      {subs.length === 0 ? (
        <Card>
          <Text type="smallBold">No subscriptions yet</Text>
          <Text type="small" themeColor="textSecondary">
            Subscribe below and milk arrives every morning, no ordering needed.
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: 0, paddingVertical: Spacing.two }}>
          {subs.map((sub, i) => {
            const product = byId.get(sub.productId);
            if (!product) return null;
            return (
              <View key={sub.productId}>
                {i > 0 && <Divider />}
                <ProductRow
                  product={product}
                  note="daily"
                  control={
                    <Stepper
                      value={sub.defaultQty}
                      min={1}
                      disabled={setQty.isPending}
                      onChange={(defaultQty) => setQty.mutate({ productId: sub.productId, defaultQty })}
                    />
                  }
                  footer={
                    <Button
                      title="Change or stop"
                      variant="ghost"
                      small
                      onPress={() => router.push(`/subscribe/${sub.productId}`)}
                    />
                  }
                />
              </View>
            );
          })}
        </Card>
      )}

      <Card tone={activePause ? 'warning' : 'default'}>
        <Row>
          <Icon name="pause" color={activePause ? theme.warning : theme.primary} size={24} />
          <View style={{ flex: 1 }}>
            <Text type="smallBold">{activePause ? 'Deliveries paused' : 'Going on a vacation?'}</Text>
            <Text type="small" themeColor="textSecondary">
              {activePause
                ? `From ${formatDay(activePause.startDate)}${
                    activePause.endDate ? ` to ${formatDay(activePause.endDate)}` : ' until you resume'
                  }`
                : 'Pause all deliveries and resume any time.'}
            </Text>
          </View>
        </Row>
        <Row>
          <Button
            title={activePause ? 'Change dates' : 'Pause deliveries'}
            variant="secondary"
            small
            onPress={() => router.push('/pause')}
          />
          {activePause && (
            <Button title="Resume" small onPress={() => resume.mutate(undefined)} loading={resume.isPending} />
          )}
        </Row>
      </Card>

      {others.length > 0 && (
        <>
          <Text type="subtitle">Subscribe to more</Text>
          <Card style={{ gap: 0, paddingVertical: Spacing.two }}>
            {others.map((product, i) => (
              <View key={product.id}>
                {i > 0 && <Divider />}
                <ProductRow
                  product={product}
                  control={
                    <Stepper
                      value={0}
                      addLabel="SUBSCRIBE"
                      disabled={setQty.isPending}
                      onChange={(defaultQty) => setQty.mutate({ productId: product.id, defaultQty })}
                    />
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
