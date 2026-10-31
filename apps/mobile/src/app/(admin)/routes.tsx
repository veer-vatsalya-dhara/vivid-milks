import { router } from 'expo-router';

import { Button, Card, QueryView, Screen, Text } from '@/components/ui';
import { useRoutes } from '@/lib/queries';

export default function RoutesScreen() {
  const routes = useRoutes();

  return (
    <Screen onRefresh={() => routes.refetch()} refreshing={routes.isRefetching}>
      <Text type="small" themeColor="textSecondary">
        A route is a group of customers delivered by one person. Assign customers to a route from their page.
      </Text>
      <Button title="Add route" onPress={() => router.push('/route/new')} />
      <QueryView query={routes}>
        {(list) =>
          list.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/route/${r.id}`)}>
              <Text type="smallBold">{r.name}</Text>
              <Text type="small" themeColor={r.deliveryUserName ? 'textSecondary' : 'danger'}>
                {r.deliveryUserName ?? 'No delivery person'} · {r.customerCount}{' '}
                {r.customerCount === 1 ? 'customer' : 'customers'}
              </Text>
            </Card>
          ))
        }
      </QueryView>
    </Screen>
  );
}
