import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

export interface TabSpec {
  name: string;
  title: string;
  /** Shorter label under the tab icon, when the title doesn't fit. */
  label?: string;
  icon: IconName;
  /** Hide the navigation header (for screens that draw their own). */
  headerShown?: boolean;
}

export function AccountButton({ color }: { color?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={12}
      onPress={() => router.push('/account')}>
      <Icon name="account" color={color ?? theme.text} size={26} />
    </Pressable>
  );
}

/** Bottom tabs for one mode. Each header ends with `headerExtra` (if any) and the account button. */
export function ModeTabs({ tabs, headerExtra }: { tabs: TabSpec[]; headerExtra?: () => ReactNode }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  return (
    <Tabs
      // Tabs stay mounted, so their data can go stale (e.g. a payment approved on another device).
      // Opening a tab refreshes what's on screen.
      screenListeners={{ focus: () => void queryClient.invalidateQueries() }}
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 16 },
        // Mobile browsers report no bottom safe area, so the default web tab bar clips Poppins labels.
        tabBarStyle: [{ borderTopColor: theme.border }, Platform.OS === 'web' && { height: 64, paddingBottom: 10 }],
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: Fonts.bold, fontSize: 19 },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.backgroundElement },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
            {headerExtra?.()}
            <AccountButton />
          </View>
        ),
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.label ?? tab.title,
            headerShown: tab.headerShown ?? true,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
