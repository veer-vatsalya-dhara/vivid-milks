import { addDays, settingsInput, todayInIst, type AppSettings, type LockResult } from '@vivid-milks/shared';
import { useState } from 'react';

import { Button, Card, Field, QueryView, Screen, SectionTitle, Text } from '@/components/ui';
import { showMessage } from '@/lib/alert';
import { api } from '@/lib/api';
import { formatDay, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useSettings } from '@/lib/queries';

export default function SettingsScreen() {
  const settings = useSettings();
  return (
    <Screen>
      <QueryView query={settings}>{(s) => <SettingsForm settings={s} />}</QueryView>
      <LockNow />
    </Screen>
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
        placeholder="22:00"
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
