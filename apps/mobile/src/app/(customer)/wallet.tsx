import { View } from 'react-native';

import { Card, Divider, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { formatDay, formatRupees } from '@/lib/format';
import { useWallet } from '@/lib/queries';

export default function WalletScreen() {
  const wallet = useWallet();

  return (
    <Screen onRefresh={() => wallet.refetch()} refreshing={wallet.isRefetching}>
      <QueryView query={wallet}>
        {(w) => (
          <>
            <Card>
              <Text type="small" themeColor="textSecondary">
                Balance
              </Text>
              <Text type="title" themeColor={w.balancePaise < 0 ? 'danger' : 'text'}>
                {formatRupees(w.balancePaise)}
              </Text>
              {w.availablePaise !== w.balancePaise && (
                <Text type="small" themeColor="textSecondary">
                  {formatRupees(w.balancePaise - w.availablePaise)} is set aside for deliveries on the way.
                </Text>
              )}
            </Card>
            <Card tone="info">
              <Text type="small">
                To add money, pay the Vivid Milks team by cash or UPI. They’ll add it to your wallet.
              </Text>
            </Card>

            <SectionTitle>History</SectionTitle>
            {w.transactions.length === 0 ? (
              <Text themeColor="textSecondary">No transactions yet.</Text>
            ) : (
              <Card>
                {w.transactions.map((t, i) => (
                  <View key={t.id} style={{ gap: 8 }}>
                    {i > 0 && <Divider />}
                    <Row>
                    <Text style={{ flex: 1 }}>
                      <Text type="small">
                        {t.type === 'delivery' && t.deliveryDate ? `Milk for ${formatDay(t.deliveryDate)}` : t.note}
                      </Text>
                      {'\n'}
                      <Text type="caption" themeColor="textSecondary">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </Text>
                    <Text type="smallBold" themeColor={t.amountPaise > 0 ? 'success' : 'text'}>
                      {t.amountPaise > 0 ? '+' : ''}
                      {formatRupees(t.amountPaise)}
                    </Text>
                    </Row>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
