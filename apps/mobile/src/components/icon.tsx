import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/** Icons by name, mapped to SF Symbols on iOS and Material Symbols elsewhere. */
const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  plan: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' },
  wallet: { ios: 'indianrupeesign.circle', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  truck: { ios: 'shippingbox.fill', android: 'local_shipping', web: 'local_shipping' },
  dashboard: { ios: 'square.grid.2x2', android: 'dashboard', web: 'dashboard' },
  people: { ios: 'person.2.fill', android: 'group', web: 'group' },
  route: { ios: 'map', android: 'map', web: 'map' },
  milk: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  phone: { ios: 'phone.fill', android: 'call', web: 'call' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  cross: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  pause: { ios: 'pause.circle', android: 'pause_circle', web: 'pause_circle' },
  basket: { ios: 'basket.fill', android: 'shopping_basket', web: 'shopping_basket' },
  shop: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  moon: { ios: 'moon.stars', android: 'bedtime', web: 'bedtime' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, color, size = 22 }: { name: IconName; color: SymbolViewProps['tintColor']; size?: number }) {
  return <SymbolView name={ICONS[name]} tintColor={color} size={size} />;
}
