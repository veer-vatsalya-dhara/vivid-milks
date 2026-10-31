import type { Day, Product } from '@vivid-milks/shared';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useApiMutation } from '@/lib/queries';

import { ProductRow } from './product-row';
import { Divider, Row, Stepper, Text } from './ui';

/**
 * Products for one day with quantity controls. Shows the day's items, plus every other
 * active product when `showAllProducts` is set (so customers can add extras).
 */
export function DayItems({
  day,
  products,
  showAllProducts = false,
}: {
  day: Day;
  products: Product[];
  showAllProducts?: boolean;
}) {
  const setQty = useApiMutation(({ productId, qty }: { productId: number; qty: number }) =>
    api<Day>(`/me/schedule/${day.date}/${productId}`, { method: 'PUT', body: { qty } }),
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = [
    ...day.items,
    ...(showAllProducts && day.editable
      ? products
          .filter((p) => p.active && !day.items.some((i) => i.productId === p.id))
          .map((p) => ({ productId: p.id, qty: 0, changed: false }))
      : []),
  ];

  if (rows.length === 0) {
    return <Text themeColor="textSecondary">Nothing scheduled.</Text>;
  }

  return (
    <>
      {rows.map((item, i) => {
        const product = byId.get(item.productId);
        if (!product) return null;
        return (
          <View key={item.productId}>
            {i > 0 && <Divider />}
            <ProductRow
              product={product}
              note={item.changed ? 'changed for this day' : undefined}
              control={
                day.editable ? (
                  <Stepper
                    value={item.qty}
                    addLabel={day.items.some((d) => d.productId === item.productId) ? undefined : 'ADD'}
                    disabled={setQty.isPending}
                    onChange={(qty) => setQty.mutate({ productId: item.productId, qty })}
                  />
                ) : (
                  <Text type="subtitle">× {item.qty}</Text>
                )
              }
            />
          </View>
        );
      })}
      <Divider />
      <Row style={{ paddingTop: 8 }}>
        <Text type="smallBold" style={{ flex: 1 }}>
          Total
        </Text>
        <Text type="price">{formatRupees(day.totalPaise)}</Text>
      </Row>
    </>
  );
}
