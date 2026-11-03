import { todayInIst, type OrderHistoryEntry } from '@vivid-milks/shared';
import { View } from 'react-native';

import { Badge, Card, Divider, QueryView, Row, Screen, Text } from '@/components/ui';
import { DAY_STATUS_LABELS, formatRelativeDay, formatRupees, REASON_LABELS } from '@/lib/format';
import { useOrderHistory } from '@/lib/queries';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const STATUS_TONE: Record<OrderHistoryEntry['status'], Tone> = {
  pending: 'info',
  delivered: 'success',
  not_delivered: 'danger',
  skipped_low_balance: 'danger',
};

/** Past deliveries, plus tomorrow's once it is confirmed. */
export default function OrdersScreen() {
  const orders = useOrderHistory();

  return (
    <Screen onRefresh={() => orders.refetch()} refreshing={orders.isRefetching}>
      <QueryView query={orders}>
        {(list) => {
          if (list.length === 0) {
            return (
              <Card>
                <Text type="smallBold">No orders yet</Text>
                <Text type="small" themeColor="textSecondary">
                  Your deliveries will show up here once they are confirmed each evening.
                </Text>
              </Card>
            );
          }
          const delivered = list.filter((o) => o.status === 'delivered');
          return (
            <>
              <Card tone="info">
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text type="caption" themeColor="textSecondary">
                      Delivered
                    </Text>
                    <Text type="subtitle">
                      {delivered.length} {delivered.length === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text type="caption" themeColor="textSecondary">
                      Spent
                    </Text>
                    <Text type="subtitle">{formatRupees(delivered.reduce((sum, o) => sum + o.totalPaise, 0))}</Text>
                  </View>
                </Row>
                <Text type="caption" themeColor="textSecondary">
                  Your last {list.length} orders.
                </Text>
              </Card>
              <Card style={{ gap: 0 }}>
                {list.map((order, i) => (
                  <View key={order.date}>
                    {i > 0 && <Divider />}
                    <OrderRow order={order} />
                  </View>
                ))}
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function OrderRow({ order }: { order: OrderHistoryEntry }) {
  const charged = order.status === 'delivered';
  // A past drop the delivery person never marked.
  const unmarked = order.status === 'pending' && order.date < todayInIst();
  return (
    <View style={{ paddingVertical: 12, gap: 4 }}>
      <Row>
        <Text type="smallBold" style={{ flex: 1 }}>
          {formatRelativeDay(order.date)}
        </Text>
        <Badge
          label={unmarked ? 'Not updated' : DAY_STATUS_LABELS[order.status]}
          tone={unmarked ? 'warning' : STATUS_TONE[order.status]}
        />
      </Row>
      {order.items.map((item) => (
        <Row key={item.productId}>
          <Text type="small" style={{ flex: 1 }}>
            {item.qty} × {item.name} {item.unitLabel}
          </Text>
          <Text type="small" themeColor="textSecondary">
            {formatRupees(item.qty * item.unitPricePaise)}
          </Text>
        </Row>
      ))}
      <Row>
        <Text type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
          {order.status === 'not_delivered' && order.reason
            ? REASON_LABELS[order.reason]
            : order.status === 'skipped_low_balance'
              ? 'Not delivered: wallet balance was too low'
              : charged
                ? 'Paid from wallet'
                : order.status === 'pending'
                  ? 'Charged from your wallet once delivered'
                  : 'Not charged'}
        </Text>
        <Text type="smallBold" themeColor={charged ? 'text' : 'textSecondary'}>
          {formatRupees(order.totalPaise)}
        </Text>
      </Row>
    </View>
  );
}
