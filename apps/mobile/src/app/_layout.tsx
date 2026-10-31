import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { Loading } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';

function RootNavigator() {
  const { ready, user, mode } = useSession();
  if (!ready) return <Loading />;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Anchor: when a guard changes, navigation falls back here and redirects to the right start screen. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'customer'}>
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="day/[date]" options={{ title: 'Change order', presentation: 'modal' }} />
        <Stack.Screen name="pause" options={{ title: 'Pause deliveries', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'delivery'}>
        <Stack.Screen name="(delivery)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'admin'}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="customer/[id]" options={{ title: 'Customer' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route', presentation: 'modal' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Product', presentation: 'modal' }} />
        <Stack.Screen name="users" options={{ title: 'Users & roles' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="account" options={{ title: 'Account' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
