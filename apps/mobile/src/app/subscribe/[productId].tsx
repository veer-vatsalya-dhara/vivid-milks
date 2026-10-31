import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ProductRow } from '@/components/product-row';
import { Button, Card, QueryView, Row, Screen, Stepper, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useApiMutation, useProducts, useSubscriptions } from '@/lib/queries';

export default function SubscribeScreen() {
  const productId = Number(useLocalSearchParams<{ productId: string }>().productId);
  const products = useProducts();
  const subscriptions = useSubscriptions();

  return (
    <Screen>
      <QueryView query={products}>
        {(list) => {
          const product = list.find((p) => p.id === productId);
          if (!product) return <Text>This product is not available.</Text>;
          if (!subscriptions.data) return null;
          const current = subscriptions.data.find((s) => s.productId === productId)?.defaultQty ?? null;
          return <SubscribeForm productId={productId} product={product} current={current} />;
        }}
      </QueryView>
    </Screen>
  );
}

function SubscribeForm({
  productId,
  product,
  current,
}: {
  productId: number;
  product: NonNullable<ReturnType<typeof useProducts>['data']>[number];
  current: number | null;
}) {
  const [qty, setQty] = useState(current ?? 1);
  const close = { onSuccess: () => router.back() };
  const save = useApiMutation(
    () => api(`/me/subscriptions/${productId}`, { method: 'PUT', body: { defaultQty: qty } }),
    close,
  );
  const stop = useApiMutation(() => api(`/me/subscriptions/${productId}`, { method: 'DELETE' }), close);

  return (
    <>
      <Card>
        <ProductRow product={product} />
      </Card>
      <Card>
        <Row>
          <Text type="smallBold" style={{ flex: 1 }}>
            Every day
          </Text>
          <Stepper value={qty} min={1} onChange={setQty} />
        </Row>
        <Text type="small" themeColor="textSecondary">
          {formatRupees(product.pricePaise * qty)} a day, about {formatRupees(product.pricePaise * qty * 30)} a month.
          Starts with the next day you can still change.
        </Text>
      </Card>
      <Button
        title={current === null ? 'Subscribe' : 'Save'}
        onPress={() => save.mutate(undefined)}
        loading={save.isPending}
        disabled={qty === current}
      />
      {current !== null && (
        <Button title="Stop subscription" variant="danger" onPress={() => stop.mutate(undefined)} loading={stop.isPending} />
      )}
    </>
  );
}
