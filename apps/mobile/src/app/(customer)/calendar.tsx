import { addDays, todayInIst } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';

import { Icon } from '@/components/icon';
import { Badge, Card, QueryView, Row, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { dayBadge } from '@/lib/day-status';
import { formatRelativeDay } from '@/lib/format';
import { useProducts, useSchedule } from '@/lib/queries';

const DAYS = 30;

export default function CalendarScreen() {
  const theme = useTheme();
  const from = useMemo(() => todayInIst(), []);
  const schedule = useSchedule(from, addDays(from, DAYS - 1));
  const products = useProducts();
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]));

  return (
    <Screen onRefresh={() => schedule.refetch()} refreshing={schedule.isRefetching}>
      <Text type="small" themeColor="textSecondary">
        Tap a day to change it or skip it.
      </Text>
      <QueryView query={schedule}>
        {({ days }) =>
          days.map((day) => {
            const badge = dayBadge(day);
            const summary = day.items
              .filter((i) => i.qty > 0)
              .map((i) => `${i.qty} × ${byId.get(i.productId)?.name ?? ''} ${byId.get(i.productId)?.unitLabel ?? ''}`)
              .join(', ');
            return (
              <Card key={day.date} onPress={() => router.push(`/day/${day.date}`)}>
                <Row>
                  <Text type="smallBold" style={{ flex: 1 }}>
                    {formatRelativeDay(day.date)}
                    {day.items.some((i) => i.changed) ? ' · changed' : ''}
                  </Text>
                  <Badge label={badge.label} tone={badge.tone} />
                  {day.editable && <Icon name="chevron" color={theme.textSecondary} size={16} />}
                </Row>
                {summary ? (
                  <Text type="small" themeColor="textSecondary">
                    {summary}
                  </Text>
                ) : null}
              </Card>
            );
          })
        }
      </QueryView>
    </Screen>
  );
}
