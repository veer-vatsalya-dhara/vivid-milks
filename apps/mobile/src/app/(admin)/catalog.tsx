import { router } from 'expo-router';

import { Badge, Button, Card, QueryView, Row, Screen, Text } from '@/components/ui';
import { formatRupees } from '@/lib/format';
import { useAllProducts } from '@/lib/queries';

export default function CatalogScreen() {
  const products = useAllProducts();

  return (
    <Screen onRefresh={() => products.refetch()} refreshing={products.isRefetching}>
      <Button title="Add product" onPress={() => router.push('/product/new')} />
      <QueryView query={products}>
        {(list) =>
          list.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/product/${p.id}`)}>
              <Row>
                <Text type="smallBold" style={{ flex: 1 }}>
                  {p.name} {p.unitLabel}
                </Text>
                {!p.active && <Badge label="Hidden" />}
                <Text type="smallBold">{formatRupees(p.pricePaise)}</Text>
              </Row>
            </Card>
          ))
        }
      </QueryView>
    </Screen>
  );
}
