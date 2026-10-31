import { profileInput, type Me } from '@vivid-milks/shared';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/queries';

import { Button, Field } from './ui';

/** Name, phone and delivery address. */
export function ProfileForm({ me, onSaved }: { me: Me; onSaved?: () => void }) {
  const [values, setValues] = useState({
    name: me.name,
    phone: me.phone ?? '',
    line1: me.address?.line1 ?? '',
    line2: me.address?.line2 ?? '',
    area: me.address?.area ?? '',
    landmark: me.address?.landmark ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useApiMutation((body: unknown) => api<Me>('/me/profile', { method: 'PUT', body }), {
    onSuccess: onSaved,
  });

  const set = (key: keyof typeof values) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  const submit = () => {
    const { name, phone, ...address } = values;
    const parsed = profileInput.safeParse({ name, phone, address });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path.at(-1)), i.message])));
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
      <Field
        label="House / flat and street"
        value={values.line1}
        onChangeText={set('line1')}
        error={errors.line1}
        placeholder="e.g. A-12, Green Park"
      />
      <Field label="Building / society (optional)" value={values.line2} onChangeText={set('line2')} />
      <Field label="Area" value={values.area} onChangeText={set('area')} error={errors.area} />
      <Field label="Landmark (optional)" value={values.landmark} onChangeText={set('landmark')} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </>
  );
}
