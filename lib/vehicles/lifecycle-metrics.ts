import type { Vehicle } from '@/lib/types';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  SHIPPING_STATUSES,
  effectivePaymentStatus,
  effectiveShippingStatus,
  type VehiclePaymentStatus,
  type VehicleShippingStatus,
} from '@/lib/vehicle-lifecycle';

const SHIPPING_COMBO_LABEL: Record<VehicleShippingStatus, string> = {
  not_booked: 'Not booked',
  booked: 'Booked',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

/** Pipeline columns keyed by shipping_status (primary lifecycle axis). */
export type LifecycleBucket = VehicleShippingStatus;

export type LifecycleVehicleRow = Pick<
  Vehicle,
  | 'id'
  | 'payment_status'
  | 'shipping_status'
  | 'status'
  | 'created_at'
  | 'shipping_etd'
  | 'shipping_eta'
  | 'shipping_bl_date'
  | 'arrival_date'
  | 'stock_category'
>;

export type LifecycleComboRow = {
  payment: VehiclePaymentStatus;
  shipping: VehicleShippingStatus;
  label: string;
  count: number;
  pctOfBucket: number;
  /** Average age in days when enough rows have a reliable date; otherwise null. */
  avgDays: number | null;
  avgDaysLabel: string | null;
  href: string;
  alert: boolean;
};

export type LifecycleColumn = {
  bucket: LifecycleBucket;
  title: string;
  cue: string;
  count: number;
  pctOfTotal: number;
  href: string;
  rows: LifecycleComboRow[];
  footerAlert: string | null;
};

export type LifecycleAlert = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type LifecycleSnapshot = {
  total: number;
  kpis: Array<{
    key: 'total' | LifecycleBucket;
    label: string;
    count: number;
    pctOfTotal: number | null;
    href: string;
  }>;
  columns: LifecycleColumn[];
  alerts: LifecycleAlert[];
};

const BUCKET_META: Record<
  LifecycleBucket,
  { title: string; cue: string; kpiLabel: string }
> = {
  not_booked: {
    title: 'In yard',
    cue: 'Open stock — book when ready',
    kpiLabel: 'In yard',
  },
  booked: {
    title: 'Booked',
    cue: 'Allocated — watch payment & cut-off',
    kpiLabel: 'Booked',
  },
  shipped: {
    title: 'En route',
    cue: 'Monitor arrival & collection',
    kpiLabel: 'En route',
  },
  delivered: {
    title: 'Landed',
    cue: 'Reconcile payment & commission',
    kpiLabel: 'Landed',
  },
};

/** Incomplete payment relative to full settlement. */
export function isIncompletePayment(pay: VehiclePaymentStatus): boolean {
  return pay === 'available' || pay === 'reserved' || pay === 'partial_paid';
}

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Stage-appropriate anchor date. Returns null when no reliable field exists
 * (we never invent ages from updated_at alone).
 */
export function ageAnchorDate(
  vehicle: LifecycleVehicleRow,
  shipping: VehicleShippingStatus
): { date: Date; label: string } | null {
  if (shipping === 'not_booked') {
    const created = parseDay(vehicle.created_at);
    return created ? { date: created, label: 'days on books' } : null;
  }
  if (shipping === 'booked') {
    // No dedicated booked_at — only use explicit shipping schedule dates.
    const cut = parseDay(vehicle.shipping_bl_date) ?? parseDay(vehicle.shipping_etd);
    return cut ? { date: cut, label: 'days since BL / ETD' } : null;
  }
  if (shipping === 'shipped') {
    const etd = parseDay(vehicle.shipping_etd) ?? parseDay(vehicle.shipping_bl_date);
    return etd ? { date: etd, label: 'days since ETD' } : null;
  }
  const landed = parseDay(vehicle.arrival_date) ?? parseDay(vehicle.shipping_eta);
  return landed ? { date: landed, label: 'days since arrival / ETA' } : null;
}

function avgDaysFor(
  vehicles: LifecycleVehicleRow[],
  shipping: VehicleShippingStatus,
  now: Date
): { avg: number; label: string } | null {
  if (vehicles.length === 0) return null;
  const samples: number[] = [];
  let label: string | null = null;
  for (const v of vehicles) {
    const anchor = ageAnchorDate(v, shipping);
    if (!anchor) continue;
    samples.push(daysBetween(anchor.date, now));
    label = anchor.label;
  }
  // Require coverage on at least half the bucket so sparse dates don't mislead.
  if (!label || samples.length < Math.ceil(vehicles.length / 2)) return null;
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  return { avg, label };
}

function vehiclesHref(params: {
  payment?: VehiclePaymentStatus;
  shipping?: VehicleShippingStatus;
  alert?: 'shipped_unpaid' | 'delivered_unpaid';
}): string {
  const q = new URLSearchParams();
  if (params.payment) q.set('payment', params.payment);
  if (params.shipping) q.set('shipping', params.shipping);
  if (params.alert) q.set('lifecycleAlert', params.alert);
  const qs = q.toString();
  return qs ? `/vehicles?${qs}` : '/vehicles';
}

export function buildLifecycleSnapshot(
  vehicles: LifecycleVehicleRow[],
  now: Date = new Date()
): LifecycleSnapshot {
  const total = vehicles.length;

  const byBucket = new Map<LifecycleBucket, LifecycleVehicleRow[]>();
  for (const ship of SHIPPING_STATUSES) byBucket.set(ship, []);

  for (const v of vehicles) {
    const ship = effectiveShippingStatus(v as Vehicle);
    byBucket.get(ship)?.push(v);
  }

  const columns: LifecycleColumn[] = SHIPPING_STATUSES.map((bucket) => {
    const meta = BUCKET_META[bucket];
    const bucketVehicles = byBucket.get(bucket) || [];
    const count = bucketVehicles.length;

    const comboMap = new Map<VehiclePaymentStatus, LifecycleVehicleRow[]>();
    for (const pay of PAYMENT_STATUSES) comboMap.set(pay, []);
    for (const v of bucketVehicles) {
      const pay = effectivePaymentStatus(v as Vehicle);
      comboMap.get(pay)?.push(v);
    }

    const rows: LifecycleComboRow[] = PAYMENT_STATUSES.map((payment) => {
      const list = comboMap.get(payment) || [];
      const comboCount = list.length;
      const age = avgDaysFor(list, bucket, now);
      const alert =
        (bucket === 'shipped' || bucket === 'delivered') &&
        isIncompletePayment(payment) &&
        comboCount > 0;
      return {
        payment,
        shipping: bucket,
        label: `${PAYMENT_STATUS_LABELS[payment]} · ${SHIPPING_COMBO_LABEL[bucket]}`,
        count: comboCount,
        pctOfBucket: count > 0 ? Math.round((comboCount / count) * 1000) / 10 : 0,
        avgDays: age?.avg ?? null,
        avgDaysLabel: age ? age.label : null,
        href: vehiclesHref({ payment, shipping: bucket }),
        alert,
      };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    let footerAlert: string | null = null;
    if (bucket === 'shipped') {
      const unpaid = bucketVehicles.filter((v) =>
        isIncompletePayment(effectivePaymentStatus(v as Vehicle))
      ).length;
      if (unpaid > 0) {
        footerAlert = `${unpaid.toLocaleString()} en route without full payment`;
      }
    } else if (bucket === 'delivered') {
      const unpaid = bucketVehicles.filter((v) =>
        isIncompletePayment(effectivePaymentStatus(v as Vehicle))
      ).length;
      if (unpaid > 0) {
        footerAlert = `${unpaid.toLocaleString()} landed without full payment`;
      }
    }

    return {
      bucket,
      title: meta.title,
      cue: meta.cue,
      count,
      pctOfTotal: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      href: vehiclesHref({ shipping: bucket }),
      rows,
      footerAlert,
    };
  });

  const shippedUnpaid = vehicles.filter((v) => {
    const ship = effectiveShippingStatus(v as Vehicle);
    const pay = effectivePaymentStatus(v as Vehicle);
    return ship === 'shipped' && isIncompletePayment(pay);
  }).length;

  const deliveredUnpaid = vehicles.filter((v) => {
    const ship = effectiveShippingStatus(v as Vehicle);
    const pay = effectivePaymentStatus(v as Vehicle);
    return ship === 'delivered' && isIncompletePayment(pay);
  }).length;

  const alerts: LifecycleAlert[] = [];
  if (shippedUnpaid > 0) {
    alerts.push({
      id: 'shipped_unpaid',
      label: 'En route without full payment',
      count: shippedUnpaid,
      href: vehiclesHref({ shipping: 'shipped', alert: 'shipped_unpaid' }),
    });
  }
  if (deliveredUnpaid > 0) {
    alerts.push({
      id: 'delivered_unpaid',
      label: 'Landed without full payment',
      count: deliveredUnpaid,
      href: vehiclesHref({ shipping: 'delivered', alert: 'delivered_unpaid' }),
    });
  }

  const kpis: LifecycleSnapshot['kpis'] = [
    {
      key: 'total',
      label: 'All stock',
      count: total,
      pctOfTotal: null,
      href: '/vehicles',
    },
    ...SHIPPING_STATUSES.map((bucket) => {
      const col = columns.find((c) => c.bucket === bucket)!;
      return {
        key: bucket,
        label: BUCKET_META[bucket].kpiLabel,
        count: col.count,
        pctOfTotal: col.pctOfTotal,
        href: col.href,
      };
    }),
  ];

  return { total, kpis, columns, alerts };
}

export function parsePaymentQuery(value: string | null): VehiclePaymentStatus | null {
  if (!value) return null;
  return (PAYMENT_STATUSES as string[]).includes(value) ? (value as VehiclePaymentStatus) : null;
}

export function parseShippingQuery(value: string | null): VehicleShippingStatus | null {
  if (!value) return null;
  return (SHIPPING_STATUSES as string[]).includes(value) ? (value as VehicleShippingStatus) : null;
}
