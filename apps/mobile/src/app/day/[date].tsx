import { Stack, useLocalSearchParams } from 'expo-router';

import { DayItems } from '@/components/day-items';
import { Badge, Card, QueryView, Row, Screen, Text } from '@/components/ui';
import { dayBadge } from '@/lib/day-status';
import { formatDay, formatRelativeDay } from '@/lib/format';
import { useProducts, useSchedule } from '@/lib/queries';

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const schedule = useSchedule(date, date);
  const products = useProducts();

  return (
    <Screen>
      <Stack.Screen options={{ title: formatRelativeDay(date) }} />
      <QueryView query={schedule}>
        {({ days: [day] }) =>
          day && (
            <Card>
              <Row>
                <Text type="subtitle" style={{ flex: 1 }}>
                  {formatDay(day.date)}
                </Text>
                <Badge {...dayBadge(day)} />
              </Row>
              <DayItems day={day} products={products.data ?? []} showAllProducts />
              {!day.editable && (
                <Text type="caption" themeColor="textSecondary">
                  This day can no longer be changed.
                </Text>
              )}
            </Card>
          )
        }
      </QueryView>
    </Screen>
  );
}
