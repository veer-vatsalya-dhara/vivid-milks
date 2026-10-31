import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Chip, Field, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation, useRoutes, useUsers } from '@/lib/queries';

export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routes = useRoutes();
  const isNew = id === 'new';

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New route' : 'Edit route' }} />
      <QueryView query={routes}>
        {(list) => {
          const route = list.find((r) => String(r.id) === id);
          if (!isNew && !route) return <Text>Route not found.</Text>;
          return <RouteForm id={route?.id ?? null} name={route?.name ?? ''} deliveryUserId={route?.deliveryUserId ?? null} />;
        }}
      </QueryView>
    </Screen>
  );
}

function RouteForm(props: { id: number | null; name: string; deliveryUserId: number | null }) {
  const users = useUsers();
  const [name, setName] = useState(props.name);
  const [deliveryUserId, setDeliveryUserId] = useState(props.deliveryUserId);
  const save = useApiMutation(
    (body: { name: string; deliveryUserId: number | null }) =>
      api(props.id === null ? '/admin/routes' : `/admin/routes/${props.id}`, {
        method: props.id === null ? 'POST' : 'PUT',
        body,
      }),
    { onSuccess: () => router.back() },
  );
  const staff = (users.data ?? []).filter((u) => u.role !== 'customer');

  return (
    <>
      <Field label="Route name" value={name} onChangeText={setName} placeholder="e.g. Green Park, Block A" />
      <SectionTitle>Delivered by</SectionTitle>
      {staff.length === 0 && (
        <Text type="small" themeColor="textSecondary">
          No delivery staff yet. Make someone delivery staff in Users & roles.
        </Text>
      )}
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Nobody yet" selected={deliveryUserId === null} onPress={() => setDeliveryUserId(null)} />
        {staff.map((u) => (
          <Chip key={u.id} label={u.name} selected={deliveryUserId === u.id} onPress={() => setDeliveryUserId(u.id)} />
        ))}
      </Row>
      <Button
        title="Save"
        disabled={name.trim() === ''}
        loading={save.isPending}
        onPress={() => save.mutate({ name, deliveryUserId })}
      />
    </>
  );
}
