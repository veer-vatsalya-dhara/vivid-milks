import { addDays, todayInIst, type CustomerHome } from '@vivid-milks/shared';
import { router } from 'expo-router';

import { DayItems } from '@/components/day-items';
import { Button, Card, QueryView, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDay, formatRelativeDay, formatRupees, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useHome, useProducts } from '@/lib/queries';

export default function HomeScreen() {
  const home = useHome();
  const products = useProducts();

  return (
    <Screen onRefresh={() => home.refetch()} refreshing={home.isRefetching}>
      <QueryView query={home}>{(data) => <HomeContent home={data} products={products.data ?? []} />}</QueryView>
    </Screen>
  );
}

function cutoffText(home: CustomerHome) {
  const cutoff = formatTimeOfDay(home.settings.orderCutoffTime);
  const dayBefore = addDays(home.nextDay.date, -1);
  return dayBefore === todayInIst() ? `${cutoff} tonight` : `${cutoff} on ${formatDay(dayBefore)}`;
}

function HomeContent({ home, products }: { home: CustomerHome; products: NonNullable<ReturnType<typeof useProducts>['data']> }) {
  const resume = useApiMutation(() => api('/me/pause', { method: 'DELETE' }));
  const { me, nextDay, activePause, wallet, shortfallPaise, settings } = home;

  return (
    <>
      <Text type="title">Hi {me.name.split(' ')[0]}</Text>

      {!me.address ? (
        <Card tone="warning">
          <Text type="smallBold">Add your delivery address</Text>
          <Text type="small">We need your address and mobile number before we can deliver.</Text>
          <Button title="Add address" onPress={() => router.push('/account')} small />
        </Card>
      ) : !me.routeName ? (
        <Card tone="info">
          <Text type="smallBold">Almost there</Text>
          <Text type="small">
            Deliveries start once our team adds your address to a delivery route. You can set up your milk now.
          </Text>
        </Card>
      ) : null}

      {shortfallPaise !== null && (
        <Card tone="danger">
          <Text type="smallBold">Low balance</Text>
          <Text type="small">
            Add {formatRupees(shortfallPaise)} before {cutoffText(home)} or {formatRelativeDay(nextDay.date).toLowerCase()}
            ’s milk won’t be delivered. Pay the Vivid Milks team by cash or UPI and they’ll top up your wallet.
          </Text>
        </Card>
      )}

      {activePause && (
        <Card tone="warning">
          <Text type="smallBold">Deliveries paused</Text>
          <Text type="small">
            From {formatDay(activePause.startDate)}
            {activePause.endDate ? ` to ${formatDay(activePause.endDate)}` : ' until you resume'}.
          </Text>
          <Button title="Resume deliveries" variant="secondary" small onPress={() => resume.mutate(undefined)} loading={resume.isPending} />
        </Card>
      )}

      <Card onPress={() => router.push('/wallet')}>
        <Row>
          <Text style={{ flex: 1 }}>Wallet balance</Text>
          <Text type="subtitle" themeColor={wallet.balancePaise < 0 ? 'danger' : 'text'}>
            {formatRupees(wallet.balancePaise)}
          </Text>
        </Row>
      </Card>

      <Card>
        <Row>
          <Text type="subtitle" style={{ flex: 1 }}>
            {formatRelativeDay(nextDay.date)}
          </Text>
          {formatRelativeDay(nextDay.date) !== formatDay(nextDay.date) && (
            <Text type="small" themeColor="textSecondary">
              {formatDay(nextDay.date)}
            </Text>
          )}
        </Row>
        {nextDay.items.length === 0 ? (
          <>
            <Text themeColor="textSecondary">You don’t get any milk yet.</Text>
            <Button title="Choose your milk" onPress={() => router.push('/plan')} small />
          </>
        ) : (
          <DayItems day={nextDay} products={products} />
        )}
        <Text type="caption" themeColor="textSecondary">
          Change until {cutoffText(home)} · Delivered by {formatTimeOfDay(settings.deliveryTime)}
        </Text>
        <Button title="Add something else" variant="ghost" small onPress={() => router.push(`/day/${nextDay.date}`)} />
      </Card>
    </>
  );
}
