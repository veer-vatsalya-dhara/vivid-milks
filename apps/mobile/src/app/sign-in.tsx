import { useQuery } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Badge, Card, QueryView, Row, Text } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useSession, type SessionUser } from '@/lib/session';

/** Development sign-in: pick any user. Replaced by real login later. */
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const users = useQuery({ queryKey: ['dev-users'], queryFn: () => api<SessionUser[]>('/dev/users') });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ paddingBottom: Spacing.six }}>
      <View
        style={{
          backgroundColor: theme.primary,
          paddingTop: insets.top + Spacing.five,
          paddingBottom: Spacing.five,
          paddingHorizontal: Spacing.four,
          alignItems: 'center',
          gap: Spacing.two,
          borderBottomLeftRadius: Radius.large,
          borderBottomRightRadius: Radius.large,
        }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: Radius.pill,
            backgroundColor: theme.onPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="milk" color={theme.primary} size={34} />
        </View>
        <Text type="title" style={{ color: theme.onPrimary }}>
          Vivid Milks
        </Text>
        <Text type="smallBold" style={{ color: theme.onPrimary, textAlign: 'center' }}>
          Fresh milk at your door <Text type="smallBold" style={{ color: theme.accent }}>every morning</Text>
        </Text>
      </View>

      <View style={{ padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }}>
        <Card tone="info">
          <Text type="smallBold">Test sign-in</Text>
          <Text type="small">Real login comes later. For now, pick who you want to be.</Text>
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
      </View>
    </ScrollView>
  );
}
