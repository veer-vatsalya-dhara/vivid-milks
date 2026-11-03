import type { CustomerHome } from '@vivid-milks/shared';
import { router } from 'expo-router';

import { api } from '@/lib/api';
import { cutoffText, formatDay, formatRelativeDay, formatRupees } from '@/lib/format';
import { useApiMutation } from '@/lib/queries';

import { Button, Card, Text } from './ui';

/** Address, route, low-balance and pause notices for the customer's next day. */
export function CustomerAlerts({ home }: { home: CustomerHome }) {
  const resume = useApiMutation(() => api('/me/pause', { method: 'DELETE' }));
  const { me, nextDay, activePause, shortfallPaise, settings } = home;

  return (
    <>
      {!me.address ? (
        <Card tone="warning">
          <Text type="smallBold">Add your delivery address</Text>
          <Text type="small">We need your address and mobile number before we can deliver.</Text>
          <Button title="Add address" onPress={() => router.push('/account')} small />
        </Card>
      ) : !me.address.buildingId ? (
        <Card tone="warning">
          <Text type="smallBold">Update your address</Text>
          <Text type="small">Please choose your building, block and floor so we can find your door quickly.</Text>
          <Button title="Update address" onPress={() => router.push('/account')} small />
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
          <Text type="smallBold">Low balance: add {formatRupees(shortfallPaise)}</Text>
          <Text type="small">
            Top up before {cutoffText(nextDay.date, settings.orderCutoffTime)} or{' '}
            {formatRelativeDay(nextDay.date).toLowerCase()}’s milk won’t be delivered. Pay the Vivid Milks team by
            cash or UPI and they’ll add it to your wallet.
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
          <Button
            title="Resume deliveries"
            variant="secondary"
            small
            onPress={() => resume.mutate(undefined)}
            loading={resume.isPending}
          />
        </Card>
      )}
    </>
  );
}
