import { ModeTabs } from '@/components/mode-tabs';

export default function CustomerLayout() {
  return (
    <ModeTabs
      tabs={[
        { name: 'home', title: 'Home', icon: 'home' },
        { name: 'calendar', title: 'Calendar', icon: 'calendar' },
        { name: 'plan', title: 'My milk', icon: 'plan' },
        { name: 'wallet', title: 'Wallet', icon: 'wallet' },
      ]}
    />
  );
}
