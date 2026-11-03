import { productInput, type Product } from '@vivid-milks/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Chip, Field, QueryView, Row, Screen, Text } from '@/components/ui';
import { confirmAction } from '@/lib/alert';
import { api } from '@/lib/api';
import { useAllProducts, useApiMutation } from '@/lib/queries';
import { closeScreen } from '@/lib/navigation';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const products = useAllProducts();
  const isNew = id === 'new';

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New product' : 'Edit product' }} />
      <QueryView query={products}>
        {(list) => {
          const product = list.find((p) => String(p.id) === id);
          if (!isNew && !product) return <Text>Product not found.</Text>;
          return <ProductForm product={product ?? null} />;
        }}
      </QueryView>
    </Screen>
  );
}

function ProductForm({ product }: { product: Product | null }) {
  const [name, setName] = useState(product?.name ?? '');
  const [unitLabel, setUnitLabel] = useState(product?.unitLabel ?? '');
  const [price, setPrice] = useState(product ? String(product.pricePaise / 100) : '');
  const [active, setActive] = useState(product?.active ?? true);
  const save = useApiMutation(
    (body: unknown) =>
      api(product ? `/admin/products/${product.id}` : '/admin/products', { method: product ? 'PUT' : 'POST', body }),
    { onSuccess: () => closeScreen() },
  );
  const remove = useApiMutation(() => api(`/admin/products/${product!.id}`, { method: 'DELETE' }), {
    onSuccess: () => closeScreen(),
  });
  const confirmRemove = async () => {
    const ok = await confirmAction(
      `Delete ${product!.name} ${product!.unitLabel}?`,
      'It disappears from the shop, and customers’ subscriptions and upcoming orders for it are removed. Past orders keep it.',
      'Delete',
    );
    if (ok) remove.mutate(undefined);
  };
  const parsed = productInput.safeParse({ name, unitLabel, pricePaise: Math.round(Number(price) * 100), active });

  return (
    <>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Cow Milk" />
      <Field label="Pack size" value={unitLabel} onChangeText={setUnitLabel} placeholder="e.g. 500 ml" />
      <Field label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="e.g. 34" />
      <Row>
        <Chip label="Available" selected={active} onPress={() => setActive(true)} />
        <Chip label="Hidden" selected={!active} onPress={() => setActive(false)} />
      </Row>
      <Text type="small" themeColor="textSecondary">
        Price changes apply to orders locked after you save. Hidden products are left out of future orders.
      </Text>
      <Button
        title="Save"
        disabled={!parsed.success}
        loading={save.isPending}
        onPress={() => parsed.success && save.mutate(parsed.data)}
      />
      {product && (
        <Button title="Delete product" variant="danger" loading={remove.isPending} onPress={() => void confirmRemove()} />
      )}
    </>
  );
}
