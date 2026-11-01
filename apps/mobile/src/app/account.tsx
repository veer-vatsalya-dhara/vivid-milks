
import { ProfileForm } from '@/components/profile-form';
import { Button, Card, Chip, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { showMessage } from '@/lib/alert';
import { ROLE_LABELS } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { closeAllScreens } from '@/lib/navigation';

export default function AccountScreen() {
  const { user, mode, modes, setMode, signOut } = useSession();
  const me = useMe();

  return (
    <Screen>
      <Card>
        <Text type="subtitle">{user?.name}</Text>
        <Text type="small" themeColor="textSecondary">
          {user && ROLE_LABELS[user.role]}
        </Text>
      </Card>

      {modes.length > 1 && (
        <>
          <SectionTitle>Mode</SectionTitle>
          <Text type="small" themeColor="textSecondary">
            As an admin you can also use the app as a customer or as delivery staff.
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {modes.map((m) => (
              <Chip
                key={m}
                label={ROLE_LABELS[m]}
                selected={m === mode}
                onPress={() => {
                  if (m === mode) return;
                  closeAllScreens();
                  setMode(m);
                }}
              />
            ))}
          </Row>
        </>
      )}

      {user?.role !== 'delivery' && (
        <>
          <SectionTitle>Profile & delivery address</SectionTitle>
          <QueryView query={me}>
            {(data) => <ProfileForm me={data} onSaved={() => showMessage('Saved')} />}
          </QueryView>
        </>
      )}

      <SectionTitle>Sign out</SectionTitle>
      <Button title="Switch user" variant="danger" onPress={signOut} />
    </Screen>
  );
}
