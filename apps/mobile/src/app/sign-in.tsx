import type { AuthConfig, SignInResult } from '@vivid-milks/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '@/components/google-button';
import { Icon } from '@/components/icon';
import { Badge, Card, QueryView, Row, Text } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showMessage } from '@/lib/alert';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { useSession, type SessionUser } from '@/lib/session';

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfig>('/auth/config') });

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
        <QueryView query={config}>
          {(c) => (
            <>
              {c.googleWebClientId ? (
                <GoogleSignIn clientId={c.googleWebClientId} />
              ) : (
                !c.devSignIn && <Text themeColor="textSecondary">Sign-in is not set up yet.</Text>
              )}
              {c.devSignIn && <DevSignIn />}
            </>
          )}
        </QueryView>
      </View>
    </ScrollView>
  );
}

function GoogleSignIn({ clientId }: { clientId: string }) {
  const { signIn } = useSession();
  const exchange = useMutation({
    mutationFn: (idToken: string) => api<SignInResult>('/auth/google', { method: 'POST', body: { idToken } }),
    onSuccess: ({ token, user }) => signIn(user, { token }),
    onError: (error) => showMessage('Could not sign in', error.message),
  });
  return (
    <Card>
      <Text type="subtitle" style={{ textAlign: 'center' }}>
        Welcome
      </Text>
      <Text type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Sign in to manage your daily milk.
      </Text>
      {exchange.isPending ? (
        <ActivityIndicator style={{ minHeight: 44 }} />
      ) : (
        <GoogleButton
          clientId={clientId}
          onIdToken={(idToken) => exchange.mutate(idToken)}
          onError={(message) => showMessage('Google sign-in', message)}
        />
      )}
    </Card>
  );
}

/** Development only: act as any user. */
function DevSignIn() {
  const { signIn } = useSession();
  const users = useQuery({ queryKey: ['dev-users'], queryFn: () => api<SessionUser[]>('/dev/users') });
  return (
    <>
      <Card tone="info">
        <Text type="smallBold">Test sign-in</Text>
        <Text type="small">For testing only: pick who you want to be.</Text>
      </Card>
      <QueryView query={users}>
        {(list) =>
          list.map((user) => (
            <Card key={user.id} onPress={() => signIn(user, { devUserId: user.id })}>
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
    </>
  );
}
