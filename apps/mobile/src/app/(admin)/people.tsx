import type { Role, User } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { Badge, Button, Card, Field, QueryView, Row, Screen, TabBar, Text } from '@/components/ui';
import { formatRupees } from '@/lib/format';
import { useCustomers, useUsers } from '@/lib/queries';

const TABS: { key: Role; label: string }[] = [
  { key: 'customer', label: 'Customers' },
  { key: 'delivery', label: 'Delivery staff' },
  { key: 'admin', label: 'Admins' },
];

export default function PeopleScreen() {
  const [tab, setTab] = useState<Role>('customer');
  return (
    <Screen>
      <TabBar tabs={TABS} value={tab} onChange={setTab} />
      <Button
        title={`Add ${tab === 'customer' ? 'customer' : tab === 'delivery' ? 'delivery person' : 'admin'}`}
        onPress={() => router.push(`/person/new?role=${tab}`)}
      />
      {tab === 'customer' ? <CustomerList /> : <StaffList role={tab} />}
    </Screen>
  );
}

function CustomerList() {
  const [query, setQuery] = useState('');
  const customers = useCustomers(query);
  return (
    <>
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name, phone or area" autoCorrect={false} />
      <QueryView query={customers}>
        {(list) =>
          list.length === 0 ? (
            <Text themeColor="textSecondary">No customers found.</Text>
          ) : (
            list.map((c) => (
              <Card key={c.id} onPress={() => router.push(`/customer/${c.id}`)}>
                <Row>
                  <Text type="smallBold" style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                  {c.role === 'admin' && <Badge label="Admin" tone="info" />}
                  <Text type="smallBold" themeColor={c.balancePaise < 0 ? 'danger' : 'text'}>
                    {formatRupees(c.balancePaise)}
                  </Text>
                </Row>
                <Text type="small" themeColor="textSecondary">
                  {[c.phone, c.area].filter(Boolean).join(' · ')}
                </Text>
              </Card>
            ))
          )
        }
      </QueryView>
    </>
  );
}

function StaffList({ role }: { role: Role }) {
  const users = useUsers();
  return (
    <QueryView query={users}>
      {(list) => {
        const people = list.filter((u: User) => u.role === role);
        if (people.length === 0) return <Text themeColor="textSecondary">Nobody yet.</Text>;
        return people.map((u) => (
          <Card key={u.id} onPress={() => router.push(`/person/${u.id}`)}>
            <Row>
              <Text type="smallBold" style={{ flex: 1 }}>
                {u.name}
              </Text>
              {!u.email && <Badge label="No Google email" tone="warning" />}
            </Row>
            <Text type="small" themeColor="textSecondary">
              {[u.email, u.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </Text>
          </Card>
        ));
      }}
    </QueryView>
  );
}
