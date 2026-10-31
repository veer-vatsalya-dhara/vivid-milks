import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, QueryView, Row, Screen, Text } from '@/components/ui';
import { formatRupees } from '@/lib/format';
import { useCustomers } from '@/lib/queries';

export default function CustomersScreen() {
  const [query, setQuery] = useState('');
  const customers = useCustomers(query);

  return (
    <Screen onRefresh={() => customers.refetch()} refreshing={customers.isRefetching}>
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name, phone or area" autoCorrect={false} />
      <Button title="Users & roles" variant="secondary" onPress={() => router.push('/users')} />
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
                  <Text type="smallBold" themeColor={c.balancePaise < 0 ? 'danger' : 'text'}>
                    {formatRupees(c.balancePaise)}
                  </Text>
                </Row>
                <Text type="small" themeColor="textSecondary">
                  {[c.phone, c.area, c.routeName ?? 'No route'].filter(Boolean).join(' · ')}
                </Text>
              </Card>
            ))
          )
        }
      </QueryView>
    </Screen>
  );
}
