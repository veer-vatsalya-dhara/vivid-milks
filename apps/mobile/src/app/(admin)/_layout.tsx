import { ModeTabs } from '@/components/mode-tabs';

export default function AdminLayout() {
  return (
    <ModeTabs
      tabs={[
        { name: 'dashboard', title: 'Dashboard', icon: 'dashboard' },
        { name: 'people', title: 'People', icon: 'people' },
        { name: 'catalog', title: 'Products', icon: 'milk' },
        { name: 'settings', title: 'Settings', icon: 'settings' },
      ]}
    />
  );
}
