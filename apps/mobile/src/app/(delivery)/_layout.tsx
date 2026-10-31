import { ModeTabs } from '@/components/mode-tabs';

export default function DeliveryLayout() {
  return <ModeTabs tabs={[{ name: 'run', title: "Today's deliveries", icon: 'truck' }]} />;
}
