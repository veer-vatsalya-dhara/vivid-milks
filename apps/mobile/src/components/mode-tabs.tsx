import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

export interface TabSpec {
  name: string;
  title: string;
  icon: IconName;
}

function AccountButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={12}
      onPress={() => router.push('/account')}
      style={{ paddingHorizontal: 16 }}>
      <Icon name="account" color={theme.primary} size={26} />
    </Pressable>
  );
}

/** Bottom tabs for one mode, each screen with an account button in its header. */
export function ModeTabs({ tabs }: { tabs: TabSpec[] }) {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        headerRight: () => <AccountButton />,
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
