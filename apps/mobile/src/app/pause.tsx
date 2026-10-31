import { addDays, dateRange, firstEditableDate, type Pause } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Card, Chip, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { useApiMutation, useSettings } from '@/lib/queries';

const START_CHOICES = 21;
const END_CHOICES = 45;

export default function PauseScreen() {
  const settings = useSettings();
  return (
    <Screen>
      <QueryView query={settings}>{(s) => <PauseForm first={firstEditableDate(s.orderCutoffTime)} />}</QueryView>
    </Screen>
  );
}

function DateChips({ dates, value, onChange }: { dates: string[]; value: string | null; onChange: (d: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Row>
        {dates.map((d) => (
          <Chip key={d} label={formatDay(d)} selected={d === value} onPress={() => onChange(d)} />
        ))}
      </Row>
    </ScrollView>
  );
}

function PauseForm({ first }: { first: string }) {
  const [startDate, setStartDate] = useState(first);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [untilResume, setUntilResume] = useState(false);
  const save = useApiMutation(
    (body: { startDate: string; endDate: string | null }) => api<{ pause: Pause }>('/me/pause', { method: 'POST', body }),
    { onSuccess: () => router.back() },
  );

  const end = untilResume ? null : endDate;
  const valid = untilResume || (endDate !== null && endDate >= startDate);

  return (
    <>
      <SectionTitle>First day without milk</SectionTitle>
      <DateChips
        dates={dateRange(first, addDays(first, START_CHOICES - 1))}
        value={startDate}
        onChange={(d) => {
          setStartDate(d);
          if (endDate && endDate < d) setEndDate(null);
        }}
      />

      <SectionTitle>Last day without milk</SectionTitle>
      <Row>
        <Chip label="Until I resume" selected={untilResume} onPress={() => setUntilResume(true)} />
        <Chip label="Pick a date" selected={!untilResume} onPress={() => setUntilResume(false)} />
      </Row>
      {!untilResume && (
        <DateChips dates={dateRange(startDate, addDays(startDate, END_CHOICES - 1))} value={endDate} onChange={setEndDate} />
      )}

      <Card tone="info">
        <Text type="small">
          {valid
            ? `No deliveries from ${formatDay(startDate)}${end ? ` to ${formatDay(end)}` : ' until you resume'}.`
            : 'Choose the last day without milk.'}
        </Text>
      </Card>
      <Button title="Pause deliveries" disabled={!valid} loading={save.isPending} onPress={() => save.mutate({ startDate, endDate: end })} />
    </>
  );
}
