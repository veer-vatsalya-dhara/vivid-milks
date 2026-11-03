import { buildingInput, parseBlocks, type Building } from '@vivid-milks/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Field, QueryView, Screen, Text } from '@/components/ui';
import { confirmAction } from '@/lib/alert';
import { api } from '@/lib/api';
import { closeScreen } from '@/lib/navigation';
import { useApiMutation, useBuildings } from '@/lib/queries';

export default function BuildingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const buildings = useBuildings();
  const isNew = id === 'new';

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New building' : 'Edit building' }} />
      <QueryView query={buildings}>
        {(list) => {
          const building = list.find((b) => String(b.id) === id);
          if (!isNew && !building) return <Text>Building not found.</Text>;
          return <BuildingForm building={building ?? null} />;
        }}
      </QueryView>
    </Screen>
  );
}

function BuildingForm({ building }: { building: Building | null }) {
  const [name, setName] = useState(building?.name ?? '');
  const [blocks, setBlocks] = useState(building?.blocks.join(', ') ?? '');
  const save = useApiMutation(
    (body: unknown) =>
      api(building ? `/admin/buildings/${building.id}` : '/admin/buildings', {
        method: building ? 'PUT' : 'POST',
        body,
      }),
    { onSuccess: () => closeScreen() },
  );
  const remove = useApiMutation(() => api(`/admin/buildings/${building!.id}`, { method: 'DELETE' }), {
    onSuccess: () => closeScreen(),
  });
  const parsed = buildingInput.safeParse({ name, blocks: parseBlocks(blocks) });
  const error = parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === 'blocks')?.message;

  const confirmRemove = async () => {
    if (await confirmAction(`Delete ${building!.name}?`, 'Customers will no longer see it in the list.', 'Delete')) {
      remove.mutate(undefined);
    }
  };

  return (
    <>
      <Field label="Building / Society name" value={name} onChangeText={setName} placeholder="e.g. Vaswani Brentwood" />
      <Field
        label="Blocks (optional)"
        value={blocks}
        onChangeText={setBlocks}
        placeholder="e.g. A, B, C, D"
        autoCapitalize="characters"
        autoCorrect={false}
        error={error}
      />
      <Text type="small" themeColor="textSecondary">
        Separate blocks or towers with commas. Leave empty if the building has no blocks. Customers pick their block
        from this list, and the Excel order list is sorted by it.
      </Text>
      {building && (
        <Text type="small" themeColor="textSecondary">
          {building.customerCount === 0
            ? 'No customers live here yet.'
            : `${building.customerCount} customer${building.customerCount === 1 ? ' lives' : 's live'} here.`}
        </Text>
      )}
      <Button
        title="Save"
        disabled={!parsed.success}
        loading={save.isPending}
        onPress={() => parsed.success && save.mutate(parsed.data)}
      />
      {building && (
        <Button
          title="Delete building"
          variant="danger"
          loading={remove.isPending}
          disabled={building.customerCount > 0}
          onPress={() => void confirmRemove()}
        />
      )}
      {building && building.customerCount > 0 && (
        <Text type="caption" themeColor="textSecondary">
          A building can be deleted once nobody lives there.
        </Text>
      )}
    </>
  );
}
