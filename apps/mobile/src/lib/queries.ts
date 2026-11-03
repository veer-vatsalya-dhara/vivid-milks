import type {
  AdminDashboard,
  AppSettings,
  Building,
  CustomerDetail,
  CustomerHome,
  CustomerSummary,
  DeliveryRun,
  IsoDate,
  Me,
  OrderHistoryEntry,
  Pause,
  PaymentQr,
  PaymentRequest,
  Product,
  Route,
  Schedule,
  Subscription,
  User,
  Wallet,
} from '@vivid-milks/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showMessage } from './alert';
import { api } from './api';

const get = <T>(path: string) => () => api<T>(path);

// Customer (and admin acting as customer)
export const useHome = () => useQuery({ queryKey: ['home'], queryFn: get<CustomerHome>('/me/home') });
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: get<Me>('/me') });
export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: get<Product[]>('/products') });
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: get<AppSettings>('/settings') });
export const useBuildings = () => useQuery({ queryKey: ['buildings'], queryFn: get<Building[]>('/buildings') });
export const usePaymentQr = () =>
  useQuery({ queryKey: ['payment-qr'], queryFn: get<PaymentQr>('/payment-qr'), staleTime: 5 * 60_000 });
export const useMyPaymentRequests = () =>
  useQuery({ queryKey: ['my-payment-requests'], queryFn: get<PaymentRequest[]>('/me/payment-requests') });
export const useOrderHistory = () =>
  useQuery({ queryKey: ['orders'], queryFn: get<OrderHistoryEntry[]>('/me/orders') });
export const useSubscriptions = () =>
  useQuery({ queryKey: ['subscriptions'], queryFn: get<Subscription[]>('/me/subscriptions') });
export const usePause = () => useQuery({ queryKey: ['pause'], queryFn: get<{ pause: Pause | null }>('/me/pause') });
export const useWallet = () => useQuery({ queryKey: ['wallet'], queryFn: get<Wallet>('/me/wallet') });
export const useSchedule = (from: IsoDate, to: IsoDate) =>
  useQuery({ queryKey: ['schedule', from, to], queryFn: get<Schedule>(`/me/schedule?from=${from}&to=${to}`) });

// Delivery
export const useDeliveryRun = (routeId: number | null) =>
  useQuery({
    queryKey: ['run', routeId],
    queryFn: get<DeliveryRun>(routeId === null ? '/delivery/run' : `/delivery/run?routeId=${routeId}`),
  });

// Admin
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: get<AdminDashboard>('/admin/dashboard') });
export const useCustomers = (q: string) =>
  useQuery({
    queryKey: ['customers', q],
    queryFn: get<CustomerSummary[]>(`/admin/customers?q=${encodeURIComponent(q)}`),
  });
export const useCustomer = (id: number) =>
  useQuery({ queryKey: ['customer', id], queryFn: get<CustomerDetail>(`/admin/customers/${id}`) });
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: get<User[]>('/admin/users') });
export const useRoutes = () => useQuery({ queryKey: ['routes'], queryFn: get<Route[]>('/admin/routes') });
export const useAllProducts = () =>
  useQuery({ queryKey: ['admin-products'], queryFn: get<Product[]>('/admin/products') });

/**
 * Sends a change to the server, then refreshes everything on screen. Failures are
 * shown as an alert, so screens only need to handle success.
 */
export function useApiMutation<TVars, TResult = unknown>(
  request: (vars: TVars) => Promise<TResult>,
  options: { onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      options.onSuccess?.(result);
    },
    onError: (error) => showMessage('Could not save', error.message),
  });
}
