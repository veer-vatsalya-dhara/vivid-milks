import type { AdminDashboard, LineItem, PaymentRequest, RouteProgress } from '@vivid-milks/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Badge, Button, Card, Divider, QueryView, Row, Screen, SectionTitle, Text } from '@/components/ui';
import { Fonts, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/alert';
import { api, downloadFile } from '@/lib/api';
import { formatDay, formatRupees, formatTimeOfDay } from '@/lib/format';
import { useApiMutation, useDashboard, useSettings } from '@/lib/queries';

export default function DashboardScreen() {
  const dashboard = useDashboard();

  return (
    <Screen onRefresh={() => dashboard.refetch()} refreshing={dashboard.isRefetching}>
      <QueryView query={dashboard}>
        {(d) => (
          <>
            <TomorrowHero tomorrow={d.tomorrow} />
            <StatTiles dashboard={d} />
            <MilkNeeded totals={d.tomorrow.totals} />
            <PendingPayments payments={d.pendingPayments} />
            <TodayRoutes today={d.today} />
            <LowBalance customers={d.lowBalanceCustomers} />
            <Unrouted customers={d.unroutedCustomers} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

/** The number the day starts with: how much milk goes out tomorrow, and the delivery list. */
function TomorrowHero({ tomorrow }: { tomorrow: AdminDashboard['tomorrow'] }) {
  const theme = useTheme();
  const settings = useSettings();
  const packs = tomorrow.totals.reduce((sum, t) => sum + t.qty, 0);
  const download = useApiMutation(() =>
    downloadFile(`/admin/orders/${tomorrow.date}/export`, `vivid-milks-orders-${tomorrow.date}.xlsx`),
  );

  return (
    <View style={[styles.hero, { backgroundColor: theme.primary }]}>
      <Row>
        <Text type="smallBold" style={{ color: theme.onPrimary, flex: 1 }}>
          Tomorrow · {formatDay(tomorrow.date)}
        </Text>
        <View style={[styles.heroBadge, { backgroundColor: theme.primaryDark }]}>
          <Text type="caption" style={{ color: theme.onPrimary }}>
            {tomorrow.locked
              ? 'Locked · final'
              : `Open till ${settings.data ? formatTimeOfDay(settings.data.orderCutoffTime) : '…'}`}
          </Text>
        </View>
      </Row>
      <Row gap={Spacing.two} style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.heroNumber, { color: theme.onPrimary }]}>{packs}</Text>
        <Text type="smallBold" style={{ color: theme.onPrimary, opacity: 0.85, paddingBottom: 10 }}>
          {packs === 1 ? 'pack' : 'packs'} of milk
        </Text>
      </Row>
      <Text type="small" style={{ color: theme.onPrimary, opacity: 0.9 }}>
        {tomorrow.customerCount} {tomorrow.customerCount === 1 ? 'home' : 'homes'} · {formatRupees(tomorrow.totalPaise)}
        {tomorrow.skippedLowBalance > 0 ? ` · ${tomorrow.skippedLowBalance} skipped for low balance` : ''}
      </Text>
      <View style={[styles.heroButton, { backgroundColor: theme.onPrimary }]}>
        <Button
          title={download.isPending ? 'Preparing…' : 'Download delivery list (Excel)'}
          variant="ghost"
          loading={download.isPending}
          onPress={() => download.mutate(undefined)}
        />
      </View>
      {!tomorrow.locked && (
        <Text type="caption" style={{ color: theme.onPrimary, opacity: 0.85 }}>
          Orders can still change. Download after the cutoff for the final list.
        </Text>
      )}
    </View>
  );
}

function StatTiles({ dashboard: d }: { dashboard: AdminDashboard }) {
  const todayTotal = d.today.routes.reduce((sum, r) => sum + r.total, 0);
  const todayDone = d.today.routes.reduce((sum, r) => sum + r.delivered + r.notDelivered, 0);
  return (
    <View style={styles.tiles}>
      <StatTile
        icon="truck"
        label="Delivered today"
        value={todayTotal ? `${todayDone}/${todayTotal}` : '–'}
        note={todayTotal === 0 ? 'No deliveries' : todayDone === todayTotal ? 'All done' : `${todayTotal - todayDone} to go`}
        tone={todayTotal && todayDone === todayTotal ? 'success' : 'default'}
      />
      <StatTile
        icon="rupee"
        label="Payments to approve"
        value={String(d.pendingPayments.length)}
        note={
          d.pendingPayments.length
            ? formatRupees(d.pendingPayments.reduce((sum, p) => sum + p.amountPaise, 0))
            : 'All clear'
        }
        tone={d.pendingPayments.length ? 'warning' : 'default'}
      />
      <StatTile
        icon="wallet"
        label="Low balance"
        value={String(d.lowBalanceCustomers.length)}
        note={d.lowBalanceCustomers.length ? 'Will be skipped' : 'Everyone covered'}
        tone={d.lowBalanceCustomers.length ? 'danger' : 'default'}
      />
      <StatTile
        icon="route"
        label="Need a route"
        value={String(d.unroutedCustomers.length)}
        note={d.unroutedCustomers.length ? 'Not delivered yet' : 'All assigned'}
        tone={d.unroutedCustomers.length ? 'warning' : 'default'}
      />
    </View>
  );
}

const TILE_TONES: Record<'default' | 'success' | 'warning' | 'danger', { icon: ThemeColor; background: ThemeColor }> = {
  default: { icon: 'primary', background: 'backgroundSelected' },
  success: { icon: 'success', background: 'successBackground' },
  warning: { icon: 'warning', background: 'warningBackground' },
  danger: { icon: 'danger', background: 'dangerBackground' },
};

function StatTile({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  tone: keyof typeof TILE_TONES;
}) {
  const theme = useTheme();
  const colors = TILE_TONES[tone];
  return (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: theme[colors.background] }]}>
        <Icon name={icon} color={theme[colors.icon]} size={18} />
      </View>
      <Text type="caption" themeColor="textSecondary">
        {label}
      </Text>
      <Text type="title" style={styles.tileValue}>
        {value}
      </Text>
      <Text type="caption" themeColor={tone === 'default' ? 'textSecondary' : colors.icon}>
        {note}
      </Text>
    </Card>
  );
}

/** Packs per product, largest first, as bars of one colour with the count printed beside each. */
function MilkNeeded({ totals }: { totals: LineItem[] }) {
  const theme = useTheme();
  const sorted = [...totals].sort((a, b) => b.qty - a.qty);
  const max = Math.max(1, ...sorted.map((t) => t.qty));
  return (
    <>
      <SectionTitle>Milk to load tomorrow</SectionTitle>
      <Card>
        {sorted.length === 0 ? (
          <Text themeColor="textSecondary">No orders yet.</Text>
        ) : (
          sorted.map((t) => (
            <View key={t.productId} style={{ gap: 4 }} accessibilityLabel={`${t.name} ${t.unitLabel}: ${t.qty} packs`}>
              <Row>
                <Text type="small" style={{ flex: 1 }}>
                  {t.name} {t.unitLabel}
                </Text>
                <Text type="smallBold">{t.qty}</Text>
              </Row>
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View style={[styles.bar, { width: `${(t.qty / max) * 100}%`, backgroundColor: theme.primary }]} />
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function PendingPayments({ payments }: { payments: PaymentRequest[] }) {
  if (payments.length === 0) return null;
  return (
    <>
      <SectionTitle action={<Badge label={`${payments.length} waiting`} tone="warning" />}>Payments to approve</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
        {payments.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider />}
            <PaymentRow payment={p} />
          </View>
        ))}
      </Card>
    </>
  );
}

function PaymentRow({ payment: p }: { payment: PaymentRequest }) {
  const decide = useApiMutation((action: 'approve' | 'reject') =>
    api(`/admin/payment-requests/${p.id}/${action}`, { method: 'POST' }),
  );
  const amount = formatRupees(p.amountPaise);
  const approve = async () => {
    const ok = await confirmAction(
      `Add ${amount} to ${p.customerName}’s wallet?`,
      p.method === 'upi'
        ? `Check that ${amount} arrived in your UPI account${p.reference ? ` (transaction ${p.reference})` : ''}.`
        : `Confirm you received ${amount} in cash.`,
      'Approve',
    );
    if (ok) decide.mutate('approve');
  };
  const reject = async () => {
    const ok = await confirmAction(
      `Reject ${p.customerName}’s ${amount}?`,
      'Their wallet won’t change. They will see the payment as not received.',
      'Reject',
    );
    if (ok) decide.mutate('reject');
  };

  return (
    <View style={{ paddingVertical: Spacing.two, gap: Spacing.two }}>
      <Row>
        <View style={{ flex: 1, gap: 2 }}>
          <Text type="smallBold" onPress={() => router.push(`/customer/${p.customerId}`)}>
            {p.customerName}
          </Text>
          <Text type="caption" themeColor="textSecondary">
            {p.method === 'upi' ? 'UPI' : 'Cash'}
            {p.reference ? ` · ${p.reference}` : ''} ·{' '}
            {new Date(p.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text type="subtitle">{amount}</Text>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Button title="Approve" small loading={decide.isPending} onPress={() => void approve()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Reject" small variant="danger" disabled={decide.isPending} onPress={() => void reject()} />
        </View>
      </Row>
    </View>
  );
}

function TodayRoutes({ today }: { today: AdminDashboard['today'] }) {
  return (
    <>
      <SectionTitle>Today · {formatDay(today.date)}</SectionTitle>
      {today.routes.length === 0 ? (
        <Text themeColor="textSecondary">No deliveries today.</Text>
      ) : (
        <Card>
          {today.routes.map((r, i) => (
            <View key={r.routeId} style={{ gap: Spacing.one }}>
              {i > 0 && <Divider />}
              <RouteMeter route={r} />
            </View>
          ))}
        </Card>
      )}
      {today.skippedLowBalance > 0 && (
        <Row>
          <ToneIcon name="warning" color="danger" />
          <Text type="small" themeColor="danger">
            {today.skippedLowBalance} skipped today for low balance.
          </Text>
        </Row>
      )}
    </>
  );
}

/** Progress along one route: delivered and not-delivered segments on a track, with the counts in words. */
function RouteMeter({ route: r }: { route: RouteProgress }) {
  const theme = useTheme();
  const done = r.delivered + r.notDelivered;
  const pct = (n: number) => `${r.total ? (n / r.total) * 100 : 0}%` as const;
  return (
    <View style={{ gap: 6, paddingTop: Spacing.one }}>
      <Row>
        <Text type="smallBold" style={{ flex: 1 }}>
          {r.routeName}
        </Text>
        <Text type="small" themeColor="textSecondary">
          {done} of {r.total}
        </Text>
      </Row>
      <View
        style={[styles.track, styles.meter, { backgroundColor: theme.backgroundSelected }]}
        accessibilityLabel={`${r.delivered} delivered, ${r.notDelivered} not delivered, ${r.total - done} left`}>
        {r.delivered > 0 && <View style={{ width: pct(r.delivered), backgroundColor: theme.success }} />}
        {r.notDelivered > 0 && (
          <View style={{ width: pct(r.notDelivered), backgroundColor: theme.danger, marginLeft: r.delivered ? 2 : 0 }} />
        )}
      </View>
      <Text type="caption" themeColor="textSecondary">
        {r.deliveryUserName ?? 'No delivery person'} · {r.delivered} delivered
        {r.notDelivered ? ` · ${r.notDelivered} not delivered` : ''}
        {r.total - done ? ` · ${r.total - done} left` : ''}
      </Text>
    </View>
  );
}

function LowBalance({ customers }: { customers: AdminDashboard['lowBalanceCustomers'] }) {
  if (customers.length === 0) return null;
  return (
    <>
      <SectionTitle>Low balance</SectionTitle>
      <Text type="small" themeColor="textSecondary">
        These customers won’t get milk on their next delivery day unless they add money.
      </Text>
      <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
        {customers.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <Card onPress={() => router.push(`/customer/${c.id}`)} style={styles.listRow}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text type="smallBold">{c.name}</Text>
                  <Text type="caption" themeColor="textSecondary">
                    Balance {formatRupees(c.balancePaise)}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </Text>
                </View>
                <Text type="smallBold" themeColor="danger">
                  needs {formatRupees(c.shortfallPaise)}
                </Text>
              </Row>
            </Card>
          </View>
        ))}
      </Card>
    </>
  );
}

function Unrouted({ customers }: { customers: AdminDashboard['unroutedCustomers'] }) {
  const theme = useTheme();
  if (customers.length === 0) return null;
  return (
    <>
      <SectionTitle>Waiting for a route</SectionTitle>
      <Text type="small" themeColor="textSecondary">
        They have orders but no delivery route, so nothing will be delivered. Tap to assign one.
      </Text>
      <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
        {customers.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <Card onPress={() => router.push(`/customer/${c.id}`)} style={styles.listRow}>
              <Row>
                <Text type="smallBold" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <Icon name="chevron" color={theme.textSecondary} />
              </Row>
            </Card>
          </View>
        ))}
      </Card>
    </>
  );
}

function ToneIcon({ name, color }: { name: IconName; color: ThemeColor }) {
  const theme = useTheme();
  return <Icon name={name} color={theme[color]} size={18} />;
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  heroBadge: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.pill },
  heroNumber: { fontSize: 56, lineHeight: 64, fontFamily: Fonts.semiBold },
  heroButton: { borderRadius: Radius.medium, marginTop: Spacing.one },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  tileValue: { fontSize: 26, lineHeight: 34 },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: Radius.pill },
  meter: { flexDirection: 'row' },
  listRow: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: Spacing.two },
});
