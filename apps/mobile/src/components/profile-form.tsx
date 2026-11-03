import { profileInput, type Me } from '@vivid-milks/shared';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useApiMutation, useBuildings } from '@/lib/queries';

import { Button, Field, Select, Text } from './ui';

/** Name, phone and delivery address: building, block, floor and flat from the admin's building list. */
export function ProfileForm({ me, onSaved }: { me: Me; onSaved?: () => void }) {
  const buildings = useBuildings();
  const [values, setValues] = useState({
    name: me.name,
    phone: me.phone ?? '',
    buildingId: me.address?.buildingId ?? null,
    block: me.address?.block ?? '',
    floor: me.address?.floor === null || me.address?.floor === undefined ? '' : String(me.address.floor),
    // Older addresses held the whole address here; start fresh so they enter just the flat number.
    line1: me.address?.buildingId ? me.address.line1 : '',
    landmark: me.address?.landmark ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useApiMutation((body: unknown) => api<Me>('/me/profile', { method: 'PUT', body }), {
    onSuccess: onSaved,
  });

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));
  const building = buildings.data?.find((b) => b.id === values.buildingId);
  const blocks = building?.blocks ?? [];
  // An address saved before buildings were a list: show what they typed so they know what to pick.
  const oldBuilding = !me.address?.buildingId && me.address ? [me.address.line1, me.address.line2, me.address.area] : [];

  const submit = () => {
    const { name, phone, buildingId, block, floor, line1, landmark } = values;
    const parsed = profileInput.safeParse({
      name,
      phone,
      address: {
        buildingId: buildingId ?? undefined,
        block: blocks.length ? block : '',
        floor: floor.trim() === '' ? undefined : Number(floor),
        line1,
        landmark,
      },
    });
    const issues = parsed.success ? [] : parsed.error.issues.map((i) => [String(i.path.at(-1)), i.message] as const);
    if (blocks.length && !blocks.includes(block)) issues.push(['block', 'Choose your block']);
    if (!parsed.success || issues.length) {
      setErrors(Object.fromEntries(issues));
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  return (
    <>
      <Field label="Name" value={values.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
      <Field
        label="Mobile number"
        value={values.phone}
        onChangeText={set('phone')}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="10-digit mobile number"
      />
      {oldBuilding.some(Boolean) && (
        <Text type="small" themeColor="warning">
          Your saved address was “{oldBuilding.filter(Boolean).join(', ')}”. Please choose your building below and save.
        </Text>
      )}
      <Select
        label="Building / Society"
        value={values.buildingId}
        options={(buildings.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        onChange={(buildingId) => setValues((v) => ({ ...v, buildingId, block: '' }))}
        placeholder={buildings.isPending ? 'Loading…' : 'Choose your building or society'}
        emptyText="No buildings added yet. Please ask the Vivid Milks team to add yours."
        error={errors.buildingId}
      />
      {blocks.length > 0 && (
        <Select
          label="Block"
          value={values.block || null}
          options={blocks.map((b) => ({ value: b, label: b }))}
          onChange={(block) => setValues((v) => ({ ...v, block }))}
          placeholder="Choose your block"
          error={errors.block}
        />
      )}
      <Field
        label="Floor"
        value={values.floor}
        onChangeText={(text) => set('floor')(text.replace(/[^0-9]/g, ''))}
        error={errors.floor}
        keyboardType="number-pad"
        placeholder="e.g. 5 (0 for ground floor)"
      />
      <Field
        label="House / Flat number"
        value={values.line1}
        onChangeText={set('line1')}
        error={errors.line1}
        placeholder="e.g. 502"
      />
      <Field
        label="Landmark (optional)"
        value={values.landmark}
        onChangeText={set('landmark')}
        placeholder="e.g. Near the gym"
      />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </>
  );
}
