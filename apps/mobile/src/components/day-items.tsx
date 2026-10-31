import type { Day, Product } from '@vivid-milks/shared';

import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useApiMutation } from '@/lib/queries';

import { Divider, Row, Stepper, Text } from './ui';

/**
 * Products for one day with − / + controls. Shows the day's items, plus every other
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
      {rows.map((item) => {
        const product = byId.get(item.productId);
        return (
          <Row key={item.productId} style={{ paddingVertical: 4 }}>
            <Row style={{ flex: 1 }}>
              <Text style={{ flex: 1 }}>
                <Text type="smallBold">{product?.name ?? 'Product'}</Text>
                <Text type="small" themeColor="textSecondary">
                  {'  '}
                  {product?.unitLabel} · {product && formatRupees(product.pricePaise)}
                  {item.changed ? '  · changed' : ''}
                </Text>
              </Text>
            </Row>
            {day.editable ? (
              <Stepper
                value={item.qty}
                disabled={setQty.isPending}
                onChange={(qty) => setQty.mutate({ productId: item.productId, qty })}
              />
            ) : (
              <Text type="subtitle">× {item.qty}</Text>
            )}
          </Row>
        );
      })}
      <Divider />
      <Row>
        <Text type="smallBold" style={{ flex: 1 }}>
          Total
        </Text>
        <Text type="smallBold">{formatRupees(day.totalPaise)}</Text>
      </Row>
    </>
  );
}
