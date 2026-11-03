import { formatAddress, type CustomerDetail } from '@vivid-milks/shared';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { Button, Card, Chip, Field, QueryView, Row, Screen, SectionTitle, Stepper, Text } from '@/components/ui';
import { showMessage } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatDay, formatRupees } from '@/lib/format';
import { useApiMutation, useCustomer, useProducts } from '@/lib/queries';

export default function CustomerScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const customer = useCustomer(id);

  return (
    <Screen onRefresh={() => customer.refetch()} refreshing={customer.isRefetching}>
      <QueryView query={customer}>
        {(c) => (
          <>
            <Stack.Screen options={{ title: c.user.name }} />
            <Details customer={c} />
            <WalletSection customer={c} />
            <SubscriptionsSection customer={c} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Details({ customer: { user, address } }: { customer: CustomerDetail }) {
  return (
    <Card>
      <Row>
        <Text type="subtitle" style={{ flex: 1 }}>
          {user.name}
        </Text>
        <Button title="Edit or remove" small variant="secondary" onPress={() => router.push(`/person/${user.id}`)} />
      </Row>
      {user.email && (
        <Text type="small" themeColor="textSecondary">
          {user.email}
        </Text>
      )}
      {user.phone && (
        <Row>
          <Text style={{ flex: 1 }}>{user.phone}</Text>
          <Button title="Call" small variant="secondary" onPress={() => Linking.openURL(`tel:${user.phone}`)} />
        </Row>
      )}
      <Text type="small" themeColor="textSecondary">
        {address ? formatAddress(address) : 'No address yet'}
      </Text>
    </Card>
  );
}

function WalletSection({ customer }: { customer: CustomerDetail }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Cash');
  const add = useApiMutation(
    (body: { amountPaise: number; note: string }) =>
      api(`/admin/customers/${customer.user.id}/wallet`, { method: 'POST', body }),
    {
      onSuccess: () => {
        setAmount('');
        showMessage('Wallet updated');
      },
    },
  );
  const rupees = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(rupees) && rupees !== 0;

  return (
    <>
      <SectionTitle>Wallet</SectionTitle>
      <Card>
        <Row>
          <Text style={{ flex: 1 }}>Balance</Text>
          <Text type="subtitle" themeColor={customer.wallet.balancePaise < 0 ? 'danger' : 'text'}>
            {formatRupees(customer.wallet.balancePaise)}
          </Text>
        </Row>
        <Field
          label="Amount received (₹)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numbers-and-punctuation"
          placeholder="e.g. 500, or -50 to correct"
        />
        <Row>
          {['Cash', 'UPI'].map((n) => (
            <Chip key={n} label={n} selected={note === n} onPress={() => setNote(n)} />
          ))}
        </Row>
        <Field label="Note" value={note} onChangeText={setNote} />
        <Button
          title={valid && rupees < 0 ? `Deduct ${formatRupees(-Math.round(rupees * 100))}` : 'Add to wallet'}
          disabled={!valid}
          loading={add.isPending}
          onPress={() => add.mutate({ amountPaise: Math.round(rupees * 100), note })}
        />
        {customer.wallet.transactions.slice(0, 5).map((t) => (
          <Row key={t.id}>
            <Text type="small" style={{ flex: 1 }}>
              {t.type === 'delivery' && t.deliveryDate ? `Milk for ${formatDay(t.deliveryDate)}` : t.note}
            </Text>
            <Text type="small" themeColor={t.amountPaise > 0 ? 'success' : 'text'}>
              {t.amountPaise > 0 ? '+' : ''}
              {formatRupees(t.amountPaise)}
            </Text>
          </Row>
        ))}
      </Card>
    </>
  );
}

function SubscriptionsSection({ customer }: { customer: CustomerDetail }) {
  const products = useProducts();
  const base = `/admin/customers/${customer.user.id}/subscriptions`;
  const setQty = useApiMutation(({ productId, defaultQty }: { productId: number; defaultQty: number }) =>
    api(`${base}/${productId}`, { method: 'PUT', body: { defaultQty } }),
  );
  const remove = useApiMutation((productId: number) => api(`${base}/${productId}`, { method: 'DELETE' }));
  const busy = setQty.isPending || remove.isPending;

  return (
    <>
      <SectionTitle>Daily milk</SectionTitle>
      <Card>
        {(products.data ?? []).map((p) => {
          const sub = customer.subscriptions.find((s) => s.productId === p.id);
          return (
            <Row key={p.id}>
              <Text type="small" style={{ flex: 1 }}>
                {p.name} {p.unitLabel}
              </Text>
              {sub ? (
                <>
                  <Stepper
                    value={sub.defaultQty}
                    min={1}
                    disabled={busy}
                    onChange={(defaultQty) => setQty.mutate({ productId: p.id, defaultQty })}
                  />
                  <Button title="Stop" small variant="ghost" disabled={busy} onPress={() => remove.mutate(p.id)} />
                </>
              ) : (
                <Button
                  title="Add"
                  small
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setQty.mutate({ productId: p.id, defaultQty: 1 })}
                />
              )}
            </Row>
          );
        })}
      </Card>
    </>
  );
}
