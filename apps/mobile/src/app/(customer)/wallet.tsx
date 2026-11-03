import { paymentRequestInput, type PaymentMethod, type PaymentRequest } from '@vivid-milks/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Badge, Button, Card, Chip, Divider, Field, QueryView, Row, Screen, Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showMessage } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatDay, formatRupees } from '@/lib/format';
import { useApiMutation, useMyPaymentRequests, usePaymentQr, useWallet } from '@/lib/queries';

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

            <AddMoney />
            <MyPayments />

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

const PAYMENT_STATUS: Record<PaymentRequest['status'], { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Waiting for approval', tone: 'warning' },
  approved: { label: 'Added to wallet', tone: 'success' },
  rejected: { label: 'Not received', tone: 'danger' },
};

function AddMoney() {
  const qr = usePaymentQr();
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string>();
  const send = useApiMutation(
    (body: unknown) => api<PaymentRequest[]>('/me/payment-requests', { method: 'POST', body }),
    {
      onSuccess: () => {
        setAmount('');
        setReference('');
        showMessage('Sent for approval', 'The Vivid Milks team will check your payment and add it to your wallet.');
      },
    },
  );

  const submit = () => {
    const parsed = paymentRequestInput.safeParse({
      amountPaise: Math.round(Number(amount) * 100),
      method,
      reference,
    });
    if (amount.trim() === '' || !Number.isFinite(Number(amount))) return setError('Enter the amount you paid');
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    send.mutate(parsed.data);
  };

  return (
    <Card>
      <Text type="subtitle">Add money</Text>
      <Row>
        <Chip label="UPI" selected={method === 'upi'} onPress={() => setMethod('upi')} />
        <Chip label="Cash" selected={method === 'cash'} onPress={() => setMethod('cash')} />
      </Row>
      {method === 'upi' ? (
        qr.data?.image ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Image
              source={{ uri: qr.data.image }}
              style={{ width: 240, height: 240, borderRadius: Radius.medium }}
              contentFit="contain"
              accessibilityLabel="Vivid Milks UPI QR code"
            />
            <Text type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Scan with any UPI app (GPay, PhonePe, Paytm) and pay. Then tell us below.
            </Text>
          </View>
        ) : (
          <Text type="small" themeColor="textSecondary">
            {qr.isPending ? 'Loading QR code…' : 'The UPI QR code isn’t available yet. Please pay by cash or ask the team.'}
          </Text>
        )
      ) : (
        <Text type="small" themeColor="textSecondary">
          Hand the cash to the Vivid Milks team or your delivery person, then tell us below.
        </Text>
      )}
      <Field
        label="Amount paid (₹)"
        value={amount}
        onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="e.g. 1000"
        error={error}
      />
      {method === 'upi' && (
        <Field
          label="UPI transaction ID (optional)"
          value={reference}
          onChangeText={setReference}
          placeholder="Helps us find your payment quickly"
          autoCorrect={false}
        />
      )}
      <Button title="I have paid" onPress={submit} loading={send.isPending} />
      <Text type="caption" themeColor="textSecondary">
        Your wallet is updated once the team confirms they received the money.
      </Text>
    </Card>
  );
}

function MyPayments() {
  const requests = useMyPaymentRequests();
  // Everything still waiting, plus the latest few that were decided.
  const shown = (requests.data ?? []).filter((r, i) => r.status === 'pending' || i < 5);
  if (shown.length === 0) return null;
  return (
    <>
      <Text type="subtitle">Your payments</Text>
      <Card style={{ gap: 0 }}>
        {shown.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <Row style={{ paddingVertical: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text type="smallBold">
                  {formatRupees(r.amountPaise)} by {r.method === 'upi' ? 'UPI' : 'cash'}
                </Text>
                <Text type="caption" themeColor="textSecondary">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {r.reference ? ` · ${r.reference}` : ''}
                </Text>
              </View>
              <Badge {...PAYMENT_STATUS[r.status]} />
            </Row>
          </View>
        ))}
      </Card>
    </>
  );
}
