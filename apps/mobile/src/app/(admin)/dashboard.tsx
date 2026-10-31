import { router } from 'expo-router';

import { Badge, Card, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { formatDay, formatRupees } from '@/lib/format';
import { useDashboard } from '@/lib/queries';

export default function DashboardScreen() {
  const dashboard = useDashboard();

  return (
    <Screen onRefresh={() => dashboard.refetch()} refreshing={dashboard.isRefetching}>
      <QueryView query={dashboard}>
        {({ tomorrow, today, lowBalanceCustomers, unroutedCustomers }) => (
          <>
            <SectionTitle action={<Badge label={tomorrow.locked ? 'Locked' : 'Still changing'} tone={tomorrow.locked ? 'success' : 'warning'} />}>
              Milk needed tomorrow
            </SectionTitle>
            <Card>
              <Text type="small" themeColor="textSecondary">
                {formatDay(tomorrow.date)}
              </Text>
              {tomorrow.totals.length === 0 ? (
                <Text themeColor="textSecondary">No orders.</Text>
              ) : (
                tomorrow.totals.map((t) => (
                  <Row key={t.productId}>
                    <Text style={{ flex: 1 }}>
                      {t.name} {t.unitLabel}
                    </Text>
                    <Text type="subtitle">× {t.qty}</Text>
                  </Row>
                ))
              )}
            </Card>

            <SectionTitle>Today’s deliveries</SectionTitle>
            {today.routes.length === 0 && <Text themeColor="textSecondary">No deliveries today.</Text>}
            {today.routes.map((r) => (
              <Card key={r.routeId}>
                <Row>
                  <Text type="smallBold" style={{ flex: 1 }}>
                    {r.routeName}
                  </Text>
                  <Badge
                    label={`${r.delivered + r.notDelivered} of ${r.total} done`}
                    tone={r.delivered + r.notDelivered === r.total ? 'success' : 'info'}
                  />
                </Row>
                <Text type="small" themeColor="textSecondary">
                  {r.deliveryUserName ?? 'No delivery person'} · {r.delivered} delivered
                  {r.notDelivered ? ` · ${r.notDelivered} not delivered` : ''}
                </Text>
              </Card>
            ))}
            {today.skippedLowBalance > 0 && (
              <Text type="small" themeColor="danger">
                {today.skippedLowBalance} skipped today for low balance.
              </Text>
            )}

            <SectionTitle>Low balance</SectionTitle>
            {lowBalanceCustomers.length === 0 ? (
              <Text themeColor="textSecondary">Everyone has enough for their next delivery.</Text>
            ) : (
              lowBalanceCustomers.map((c) => (
                <Card key={c.id} tone="danger" onPress={() => router.push(`/customer/${c.id}`)}>
                  <Row>
                    <Text type="smallBold" style={{ flex: 1 }}>
                      {c.name}
                    </Text>
                    <Text type="smallBold">needs {formatRupees(c.shortfallPaise)}</Text>
                  </Row>
                  <Text type="small">
                    Balance {formatRupees(c.balancePaise)}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </Text>
                </Card>
              ))
            )}

            {unroutedCustomers.length > 0 && (
              <>
                <SectionTitle>Waiting for a route</SectionTitle>
                {unroutedCustomers.map((c) => (
                  <Card key={c.id} tone="warning" onPress={() => router.push(`/customer/${c.id}`)}>
                    <Text type="smallBold">{c.name}</Text>
                    <Text type="small">Has orders but no delivery route, so nothing will be delivered.</Text>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
