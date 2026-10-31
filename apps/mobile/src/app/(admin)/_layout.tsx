import { ModeTabs } from '@/components/mode-tabs';

export default function AdminLayout() {
  return (
    <ModeTabs
      tabs={[
        { name: 'dashboard', title: 'Dashboard', icon: 'dashboard' },
        { name: 'customers', title: 'Customers', icon: 'people' },
        { name: 'routes', title: 'Routes', icon: 'route' },
        { name: 'catalog', title: 'Products', icon: 'milk' },
        { name: 'settings', title: 'Settings', icon: 'settings' },
      ]}
    />
  );
}
