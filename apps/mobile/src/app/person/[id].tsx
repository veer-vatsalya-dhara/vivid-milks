import { ROLES, userInput, type Role, type User } from '@vivid-milks/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Chip, Field, QueryView, Row, Screen, Text } from '@/components/ui';
import { confirmAction } from '@/lib/alert';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useApiMutation, useUsers } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { closeScreen, closeAllScreens } from '@/lib/navigation';

/** Add a person (`/person/new?role=…`) or edit/remove one (`/person/:id`). */
export default function PersonScreen() {
  const { id, role } = useLocalSearchParams<{ id: string; role?: Role }>();
  const users = useUsers();
  const isNew = id === 'new';

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add person' : 'Edit person' }} />
      {isNew ? (
        <PersonForm person={null} defaultRole={role && ROLES.includes(role) ? role : 'customer'} />
      ) : (
        <QueryView query={users}>
          {(list) => {
            const person = list.find((u) => String(u.id) === id);
            return person ? <PersonForm person={person} defaultRole={person.role} /> : <Text>Person not found.</Text>;
          }}
        </QueryView>
      )}
    </Screen>
  );
}

function PersonForm({ person, defaultRole }: { person: User | null; defaultRole: Role }) {
  const { user: me } = useSession();
  const [name, setName] = useState(person?.name ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [role, setRole] = useState<Role>(defaultRole);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isSelf = person?.id === me?.id;

  const save = useApiMutation(
    (body: unknown) =>
      api(person ? `/admin/users/${person.id}` : '/admin/users', { method: person ? 'PUT' : 'POST', body }),
    { onSuccess: () => closeScreen() },
  );
  // Optional chaining (not `!`): the React Compiler reads these while rendering, when `person` may be null.
  const remove = useApiMutation(() => api(`/admin/users/${person?.id}`, { method: 'DELETE' }), {
    onSuccess: () => closeAllScreens(),
  });

  const submit = () => {
    const parsed = userInput.safeParse({ name, email: email.trim() || null, phone: phone.trim() || null, role });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  const confirmRemove = async () => {
    const ok = await confirmAction(
      `Remove ${person?.name}?`,
      'They will no longer be able to sign in. Their subscriptions and upcoming deliveries stop; past deliveries and wallet history are kept. You can add them back later with the same email.',
      'Remove',
    );
    if (ok) remove.mutate(undefined);
  };

  return (
    <>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      <Field
        label="Google account email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="name@gmail.com"
      />
      <Text type="caption" themeColor="textSecondary">
        They sign in with Google using this email.
      </Text>
      <Field
        label="Mobile number"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
        placeholder="Optional"
      />
      <Text type="smallBold">Role</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {ROLES.map((r) => (
          <Chip key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={isSelf ? undefined : () => setRole(r)} />
        ))}
      </Row>
      {isSelf && (
        <Text type="caption" themeColor="textSecondary">
          You can’t change your own role.
        </Text>
      )}
      <Button title={person ? 'Save' : 'Add'} onPress={submit} loading={save.isPending} />

      {person && !isSelf && (
        <Card tone="danger">
          <Text type="smallBold">Remove {person.name}</Text>
          <Text type="small">They lose access straight away. History is kept.</Text>
          <Button title="Remove" variant="danger" onPress={confirmRemove} loading={remove.isPending} />
        </Card>
      )}
    </>
  );
}
