import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Card, QueryView, Row, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api, API_URL } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useSession, type SessionUser } from '@/lib/session';

/** Development sign-in: pick any user. Replaced by real login later. */
export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const users = useQuery({ queryKey: ['dev-users'], queryFn: () => api<SessionUser[]>('/dev/users') });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Screen onRefresh={() => users.refetch()} refreshing={users.isRefetching}>
        <Text type="title">Vivid Milks</Text>
        <Card tone="info">
          <Text type="smallBold">Development sign-in</Text>
          <Text type="small">
            Real login comes later. For now, pick who you want to be. Server: {API_URL}
          </Text>
        </Card>
        <QueryView query={users}>
          {(list) =>
            list.map((user) => (
              <Card key={user.id} onPress={() => signIn(user)}>
                <Row>
                  <Text type="subtitle" style={{ flex: 1 }}>
                    {user.name}
                  </Text>
                  <Badge label={ROLE_LABELS[user.role]} tone={user.role === 'admin' ? 'info' : 'default'} />
                </Row>
              </Card>
            ))
          }
        </QueryView>
      </Screen>
    </SafeAreaView>
  );
}
