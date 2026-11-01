import { Card, Text } from './ui';

export interface GoogleButtonProps {
  clientId: string;
  onIdToken: (idToken: string) => void;
  onError: (message: string) => void;
}

/**
 * In the phone apps, Google sign-in needs a native module that only works in a full app
 * build (not Expo Go). Until those builds exist, point people to the web app.
 */
export function GoogleButton(_props: GoogleButtonProps) {
  return (
    <Card tone="info">
      <Text type="smallBold">Google sign-in</Text>
      <Text type="small">Available in the web app for now. It comes to the phone apps with their app-store builds.</Text>
    </Card>
  );
}
