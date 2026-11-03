import { formatAddress, NOT_DELIVERED_REASONS, type Drop, type NotDeliveredReason } from '@vivid-milks/shared';
import { useState } from 'react';
import { Linking } from 'react-native';

import { Icon } from '@/components/icon';
import { Badge, Button, Card, Chip, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDay, REASON_LABELS } from '@/lib/format';
import { useApiMutation, useDeliveryRun } from '@/lib/queries';

export default function RunScreen() {
  const run = useDeliveryRun();

  return (
    <Screen onRefresh={() => run.refetch()} refreshing={run.isRefetching}>
      <QueryView query={run}>
        {(data) => {
          const done = data.drops.filter((d) => d.status !== 'pending').length;
          return (
            <>
              <Row>
                <Text type="subtitle" style={{ flex: 1 }}>
                  {formatDay(data.date)}
                </Text>
                <Badge
                  label={`${done} of ${data.drops.length} done`}
                  tone={data.drops.length > 0 && done === data.drops.length ? 'success' : 'info'}
                />
              </Row>

              {!data.locked ? (
                <Card tone="warning">
                  <Text type="small">Today’s list isn’t ready yet. Pull down to refresh.</Text>
                </Card>
              ) : data.drops.length === 0 ? (
                <Card>
                  <Text>No deliveries today.</Text>
                </Card>
              ) : (
                <>
                  <Card tone="info">
                    <Text type="smallBold">Load before you leave</Text>
                    {data.totals.map((t) => (
                      <Row key={t.productId}>
                        <Text style={{ flex: 1 }}>
                          {t.name} {t.unitLabel}
                        </Text>
                        <Text type="subtitle">× {t.qty}</Text>
                      </Row>
                    ))}
                  </Card>
                  <SectionTitle>Drops</SectionTitle>
                  {data.drops.map((drop, i) => (
                    <DropCard key={drop.id} drop={drop} number={i + 1} />
                  ))}
                </>
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}


function DropCard({ drop, number }: { drop: Drop; number: number }) {
  const theme = useTheme();
  const [choosingReason, setChoosingReason] = useState(false);
  const mark = useApiMutation(
    (body: { status: Drop['status']; reason?: NotDeliveredReason }) =>
      api(`/delivery/drops/${drop.id}/mark`, { method: 'POST', body }),
    { onSuccess: () => setChoosingReason(false) },
  );
  const address = drop.address;

  return (
    <Card tone={drop.status === 'delivered' ? 'success' : drop.status === 'not_delivered' ? 'danger' : 'default'}>
      <Row>
        <Text type="subtitle" style={{ flex: 1 }}>
          {number}. {drop.customerName}
        </Text>
        {drop.phone && (
          <Button title="Call" small variant="secondary" onPress={() => Linking.openURL(`tel:${drop.phone}`)} />
        )}
      </Row>
      {address && (
        <Text type="small">
          {formatAddress({ ...address, landmark: '' })}
          {address.landmark ? `\n${address.landmark}` : ''}
        </Text>
      )}
      {drop.items.map((item) => (
        <Text key={item.productId} type="smallBold">
          {item.qty} × {item.name} {item.unitLabel}
        </Text>
      ))}

      {drop.status === 'pending' ? (
        choosingReason ? (
          <>
            <Text type="small">Why wasn’t it delivered?</Text>
            <Row style={{ flexWrap: 'wrap' }}>
              {NOT_DELIVERED_REASONS.map((reason) => (
                <Chip
                  key={reason}
                  label={REASON_LABELS[reason]}
                  onPress={() => mark.mutate({ status: 'not_delivered', reason })}
                />
              ))}
              <Chip label="Cancel" onPress={() => setChoosingReason(false)} />
            </Row>
          </>
        ) : (
          <Row>
            <Button
              title="Delivered"
              onPress={() => mark.mutate({ status: 'delivered' })}
              loading={mark.isPending}
            />
            <Button title="Not delivered" variant="danger" onPress={() => setChoosingReason(true)} />
          </Row>
        )
      ) : (
        <Row>
          <Icon
            name={drop.status === 'delivered' ? 'check' : 'cross'}
            color={drop.status === 'delivered' ? theme.success : theme.danger}
          />
          <Text type="smallBold" style={{ flex: 1 }}>
            {drop.status === 'delivered' ? 'Delivered' : `Not delivered: ${drop.reason ? REASON_LABELS[drop.reason] : ''}`}
          </Text>
          <Button title="Undo" small variant="ghost" onPress={() => mark.mutate({ status: 'pending' })} />
        </Row>
      )}
    </Card>
  );
}
