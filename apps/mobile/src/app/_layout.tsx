import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { Loading } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';

// Mobile browsers size `height: 100%` to the viewport with the address bar showing, leaving a
// gap under the tab bar once it hides. Follow the dynamic viewport height instead.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'html, body, #root { height: 100dvh; }';
  document.head.appendChild(style);
}

function RootNavigator() {
  const { ready, user, mode } = useSession();
  if (!ready) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontFamily: Fonts.semiBold, fontSize: 17 },
        headerShadowVisible: false,
      }}>
      {/* Anchor: when a guard changes, navigation falls back here and redirects to the right start screen. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'customer'}>
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="day/[date]" options={{ title: 'Change order', presentation: 'modal' }} />
        <Stack.Screen name="pause" options={{ title: 'Pause deliveries', presentation: 'modal' }} />
        <Stack.Screen name="subscribe/[productId]" options={{ title: 'Subscription', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'delivery'}>
        <Stack.Screen name="(delivery)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={mode === 'admin'}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="customer/[id]" options={{ title: 'Customer' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route', presentation: 'modal' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Product', presentation: 'modal' }} />
        <Stack.Screen name="person/[id]" options={{ title: 'Person', presentation: 'modal' }} />
        <Stack.Screen name="building/[id]" options={{ title: 'Building', presentation: 'modal' }} />
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
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  // Fall back to system fonts rather than blocking the app if loading fails.
  if (!fontsLoaded && !fontError) return <Loading />;

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
