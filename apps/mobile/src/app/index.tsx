import { Redirect } from 'expo-router';

import { useSession, type Mode } from '@/lib/session';

const START: Record<Mode, '/home' | '/run' | '/dashboard'> = {
  customer: '/home',
  delivery: '/run',
  admin: '/dashboard',
};

/** Sends each mode to its own start screen. */
export default function Index() {
  const { mode } = useSession();
  return <Redirect href={mode ? START[mode] : '/sign-in'} />;
}
