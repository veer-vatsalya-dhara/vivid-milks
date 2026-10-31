import { createUserInput, ROLES, type Role, type User } from '@vivid-milks/shared';
import { useState } from 'react';

import { Button, Card, Chip, Field, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useApiMutation, useUsers } from '@/lib/queries';
import { useSession } from '@/lib/session';

export default function UsersScreen() {
  const users = useUsers();
  const { user: me } = useSession();
  const setRole = useApiMutation(({ id, role }: { id: number; role: Role }) =>
    api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
  );

  return (
    <Screen onRefresh={() => users.refetch()} refreshing={users.isRefetching}>
      <AddUser />
      <SectionTitle>Everyone</SectionTitle>
      <QueryView query={users}>
        {(list) =>
          list.map((u: User) => (
            <Card key={u.id}>
              <Text type="smallBold">{u.name}</Text>
              {(u.phone || u.email) && (
                <Text type="small" themeColor="textSecondary">
                  {[u.phone, u.email].filter(Boolean).join(' · ')}
                </Text>
              )}
              <Row style={{ flexWrap: 'wrap' }}>
                {ROLES.map((role) => (
                  <Chip
                    key={role}
                    label={ROLE_LABELS[role]}
                    selected={u.role === role}
                    onPress={u.id === me?.id || u.role === role ? undefined : () => setRole.mutate({ id: u.id, role })}
                  />
                ))}
              </Row>
            </Card>
          ))
        }
      </QueryView>
    </Screen>
  );
}

function AddUser() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const create = useApiMutation((body: unknown) => api('/admin/users', { method: 'POST', body }), {
    onSuccess: () => {
      setName('');
      setPhone('');
    },
  });
  const parsed = createUserInput.safeParse({ name, phone: phone.trim() || null, role });

  return (
    <>
      <SectionTitle>Add a person</SectionTitle>
      <Card>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Row style={{ flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <Chip key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </Row>
        <Button
          title="Add"
          disabled={!parsed.success}
          loading={create.isPending}
          onPress={() => parsed.success && create.mutate(parsed.data)}
        />
      </Card>
    </>
  );
}
