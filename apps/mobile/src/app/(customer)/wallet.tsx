import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Divider, QueryView, Row, Screen, Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, formatRupees } from '@/lib/format';
import { useWallet } from '@/lib/queries';

export default function WalletScreen() {
  const theme = useTheme();
  const wallet = useWallet();

  return (
    <Screen onRefresh={() => wallet.refetch()} refreshing={wallet.isRefetching}>
      <QueryView query={wallet}>
        {(w) => (
          <>
            <Card>
              <Row gap={12}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: Radius.pill,
                    backgroundColor: theme.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="wallet" color={theme.onPrimary} size={26} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text type="small" themeColor="textSecondary">
                    Your balance
                  </Text>
                  <Text type="title" themeColor={w.balancePaise < 0 ? 'danger' : 'text'}>
                    {formatRupees(w.balancePaise)}
                  </Text>
                </View>
              </Row>
              {w.availablePaise !== w.balancePaise && (
                <Text type="small" themeColor="textSecondary">
                  {formatRupees(w.balancePaise - w.availablePaise)} is set aside for confirmed deliveries.
                </Text>
              )}
            </Card>

            <Card tone="info">
              <Text type="smallBold">Add money</Text>
              <Text type="small">
                Pay the Vivid Milks team by cash or UPI and they’ll add it to your wallet. Online top-ups are coming
                soon.
              </Text>
            </Card>

            <Text type="subtitle">Transactions</Text>
            {w.transactions.length === 0 ? (
              <Text themeColor="textSecondary">No transactions yet.</Text>
            ) : (
              <Card style={{ gap: 0 }}>
                {w.transactions.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 && <Divider />}
                    <Row style={{ paddingVertical: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text type="smallBold">
                          {t.type === 'delivery' && t.deliveryDate ? `Milk for ${formatDay(t.deliveryDate)}` : t.note}
                        </Text>
                        <Text type="caption" themeColor="textSecondary">
                          {t.type === 'topup' ? 'Added to wallet' : t.type === 'delivery' ? 'Delivered' : 'Adjustment'}
                          {' · '}
                          {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
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
