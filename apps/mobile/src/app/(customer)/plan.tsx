import { router } from 'expo-router';

import { Button, Card, Row, Screen, SectionTitle, Stepper, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDay, formatRupees } from '@/lib/format';
import { useApiMutation, usePause, useProducts, useSubscriptions } from '@/lib/queries';

export default function PlanScreen() {
  const subscriptions = useSubscriptions();
  const products = useProducts();
  const pause = usePause();

  const setQty = useApiMutation(({ productId, defaultQty }: { productId: number; defaultQty: number }) =>
    api(`/me/subscriptions/${productId}`, { method: 'PUT', body: { defaultQty } }),
  );
  const remove = useApiMutation((productId: number) => api(`/me/subscriptions/${productId}`, { method: 'DELETE' }));
  const resume = useApiMutation(() => api('/me/pause', { method: 'DELETE' }));

  const subs = subscriptions.data ?? [];
  const available = (products.data ?? []).filter((p) => !subs.some((s) => s.productId === p.id));
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]));
  const activePause = pause.data?.pause;
  const busy = setQty.isPending || remove.isPending;

  return (
    <Screen
      onRefresh={() => Promise.all([subscriptions.refetch(), products.refetch(), pause.refetch()])}
      refreshing={subscriptions.isRefetching}>
      <SectionTitle>Every day</SectionTitle>
      <Text type="small" themeColor="textSecondary">
        Your usual daily order. To change a single day, use the calendar.
      </Text>
      {subs.length === 0 && <Text themeColor="textSecondary">You haven’t chosen any milk yet.</Text>}
      {subs.map((sub) => {
        const product = byId.get(sub.productId);
        return (
          <Card key={sub.productId}>
            <Row>
              <Text style={{ flex: 1 }}>
                <Text type="smallBold">{product?.name}</Text>
                <Text type="small" themeColor="textSecondary">
                  {'  '}
                  {product?.unitLabel} · {product && formatRupees(product.pricePaise)}
                </Text>
              </Text>
              <Stepper
                value={sub.defaultQty}
                min={1}
                disabled={busy}
                onChange={(defaultQty) => setQty.mutate({ productId: sub.productId, defaultQty })}
              />
            </Row>
            <Button title="Stop this milk" variant="ghost" small onPress={() => remove.mutate(sub.productId)} disabled={busy} />
          </Card>
        );
      })}

      {available.length > 0 && (
        <>
          <SectionTitle>Add milk</SectionTitle>
          {available.map((product) => (
            <Card key={product.id}>
              <Row>
                <Text style={{ flex: 1 }}>
                  <Text type="smallBold">{product.name}</Text>
                  <Text type="small" themeColor="textSecondary">
                    {'  '}
                    {product.unitLabel} · {formatRupees(product.pricePaise)}
                  </Text>
                </Text>
                <Button
                  title="Add daily"
                  small
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setQty.mutate({ productId: product.id, defaultQty: 1 })}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Going away?</SectionTitle>
      {activePause ? (
        <Card tone="warning">
          <Text type="smallBold">
            Paused from {formatDay(activePause.startDate)}
            {activePause.endDate ? ` to ${formatDay(activePause.endDate)}` : ' until you resume'}
          </Text>
          <Row>
            <Button title="Change" variant="secondary" small onPress={() => router.push('/pause')} />
            <Button title="Resume deliveries" small onPress={() => resume.mutate(undefined)} loading={resume.isPending} />
          </Row>
        </Card>
      ) : (
        <Card>
          <Text type="small">Pause all deliveries for a few days, or until you’re back.</Text>
          <Button title="Pause deliveries" variant="secondary" onPress={() => router.push('/pause')} />
        </Card>
      )}
    </Screen>
  );
}
