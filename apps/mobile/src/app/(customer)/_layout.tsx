import { router } from 'expo-router';

import { ModeTabs } from '@/components/mode-tabs';
import { WalletPill } from '@/components/ui';
import { useHome } from '@/lib/queries';

function HeaderWallet() {
  const home = useHome();
  if (!home.data) return null;
  return <WalletPill paise={home.data.wallet.balancePaise} onPress={() => router.push('/wallet')} />;
}

export default function CustomerLayout() {
  return (
    <ModeTabs
      headerExtra={() => <HeaderWallet />}
      tabs={[
        { name: 'home', title: 'Home', icon: 'shop', headerShown: false },
        { name: 'basket', title: 'My Basket', label: 'Basket', icon: 'basket' },
        { name: 'subscriptions', title: 'Subscriptions', label: 'Daily', icon: 'calendar' },
        { name: 'orders', title: 'Orders', icon: 'history' },
        { name: 'wallet', title: 'Wallet', icon: 'wallet' },
      ]}
    />
  );
}
