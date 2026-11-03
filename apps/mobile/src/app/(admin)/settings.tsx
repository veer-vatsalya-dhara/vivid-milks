import {
  addDays,
  MAX_QR_IMAGE_CHARS,
  settingsInput,
  todayInIst,
  type AppSettings,
  type LockResult,
} from '@vivid-milks/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Divider, Field, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, showMessage } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatDay, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useBuildings, usePaymentQr, useSettings } from '@/lib/queries';

export default function SettingsScreen() {
  const settings = useSettings();
  return (
    <Screen>
      <QueryView query={settings}>{(s) => <SettingsForm settings={s} />}</QueryView>
      <Buildings />
      <PaymentQrSection />
      <LockNow />
    </Screen>
  );
}

function Buildings() {
  const theme = useTheme();
  const buildings = useBuildings();
  return (
    <>
      <SectionTitle action={<Button title="Add" small onPress={() => router.push('/building/new')} />}>
        Buildings & societies
      </SectionTitle>
      <Text type="small" themeColor="textSecondary">
        Customers choose their building from this list in their address.
      </Text>
      <QueryView query={buildings}>
        {(list) =>
          list.length === 0 ? (
            <Card tone="warning">
              <Text type="small">No buildings yet. Add them so customers can save their address.</Text>
            </Card>
          ) : (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {list.map((b, i) => (
                <View key={b.id}>
                  {i > 0 && <Divider />}
                  <Card onPress={() => router.push(`/building/${b.id}`)} style={{ borderWidth: 0, paddingHorizontal: 0 }}>
                    <Row>
                      <Icon name="building" color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text type="smallBold">{b.name}</Text>
                        <Text type="caption" themeColor="textSecondary">
                          {b.blocks.length ? `Blocks ${b.blocks.join(', ')}` : 'No blocks'} · {b.customerCount}{' '}
                          {b.customerCount === 1 ? 'customer' : 'customers'}
                        </Text>
                      </View>
                      <Icon name="chevron" color={theme.textSecondary} />
                    </Row>
                  </Card>
                </View>
              ))}
            </Card>
          )
        }
      </QueryView>
    </>
  );
}

function PaymentQrSection() {
  const qr = usePaymentQr();
  const upload = useApiMutation((image: string) => api('/admin/payment-qr', { method: 'PUT', body: { image } }), {
    onSuccess: () => showMessage('QR code saved', 'Customers now see it under Wallet → Add money.'),
  });
  const remove = useApiMutation(() => api('/admin/payment-qr', { method: 'DELETE' }));

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const image = asset.uri.startsWith('data:')
      ? asset.uri
      : asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : null;
    if (!image) return showMessage('Could not read the image', 'Please try a different picture.');
    if (image.length > MAX_QR_IMAGE_CHARS) {
      return showMessage('Image is too large', 'Use a screenshot of the QR code or a smaller picture (under about 1 MB).');
    }
    upload.mutate(image);
  };

  const confirmRemove = async () => {
    if (await confirmAction('Remove the QR code?', 'Customers will only see the cash option.', 'Remove')) {
      remove.mutate(undefined);
    }
  };

  return (
    <>
      <SectionTitle>Payment QR code</SectionTitle>
      <Card>
        <QueryView query={qr}>
          {({ image }) =>
            image ? (
              <View style={{ alignItems: 'center' }}>
                <Image
                  source={{ uri: image }}
                  style={{ width: 200, height: 200, borderRadius: Radius.medium }}
                  contentFit="contain"
                  accessibilityLabel="Current payment QR code"
                />
              </View>
            ) : (
              <Text type="small" themeColor="textSecondary">
                Upload your UPI QR code (from your bank, GPay, PhonePe or Paytm business app). Customers scan it under
                Wallet → Add money, then tap “I have paid” for you to approve.
              </Text>
            )
          }
        </QueryView>
        <Row>
          <View style={{ flex: 1 }}>
            <Button
              title={qr.data?.image ? 'Replace QR code' : 'Upload QR code'}
              onPress={() => void pick()}
              loading={upload.isPending}
            />
          </View>
          {qr.data?.image && (
            <Button title="Remove" variant="danger" onPress={() => void confirmRemove()} loading={remove.isPending} />
          )}
        </Row>
      </Card>
    </>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const [cutoff, setCutoff] = useState(settings.orderCutoffTime);
  const [delivery, setDelivery] = useState(settings.deliveryTime);
  const save = useApiMutation((body: AppSettings) => api('/admin/settings', { method: 'PUT', body }), {
    onSuccess: () => showMessage('Settings saved'),
  });
  const parsed = settingsInput.safeParse({ orderCutoffTime: cutoff, deliveryTime: delivery });
  const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

  return (
    <>
      <SectionTitle>Order times</SectionTitle>
      <Field
        label="Order cutoff (24-hour, the evening before delivery)"
        value={cutoff}
        onChangeText={setCutoff}
        placeholder="18:00"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Delivered by (24-hour)"
        value={delivery}
        onChangeText={setDelivery}
        placeholder="07:00"
        keyboardType="numbers-and-punctuation"
        error={error}
      />
      {parsed.success && (
        <Text type="small" themeColor="textSecondary">
          Customers can change tomorrow’s order until {formatTimeOfDay(cutoff)} today. Milk arrives by{' '}
          {formatTimeOfDay(delivery)}.
        </Text>
      )}
      <Button
        title="Save"
        disabled={!parsed.success}
        loading={save.isPending}
        onPress={() => parsed.success && save.mutate(parsed.data)}
      />
    </>
  );
}

function LockNow() {
  const tomorrow = addDays(todayInIst(), 1);
  const lock = useApiMutation(
    () => api<LockResult>('/admin/lock', { method: 'POST', body: { date: tomorrow } }),
    {
      onSuccess: (r) =>
        showMessage(
          r.alreadyLocked ? 'Already locked' : 'Orders locked',
          r.alreadyLocked
            ? `Orders for ${formatDay(r.date)} were already locked.`
            : `${r.created} deliveries created, ${r.skippedLowBalance} skipped for low balance.`,
        ),
    },
  );
  return (
    <>
      <SectionTitle>Lock orders early</SectionTitle>
      <Card>
        <Text type="small">
          Orders lock automatically at the cutoff. Locking now creates tomorrow’s ({formatDay(tomorrow)}) delivery list
          straight away, and customers can no longer change that day.
        </Text>
        <Button title="Lock tomorrow now" variant="danger" loading={lock.isPending} onPress={() => lock.mutate(undefined)} />
      </Card>
    </>
  );
}
