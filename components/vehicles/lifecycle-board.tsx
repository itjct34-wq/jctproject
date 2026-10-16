'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Boxes,
  CalendarCheck2,
  PackageCheck,
  Ship,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LifecycleSnapshot } from '@/lib/vehicles/lifecycle-metrics';
import type { VehicleShippingStatus } from '@/lib/vehicle-lifecycle';

const BUCKET_ICON: Record<VehicleShippingStatus, typeof Warehouse> = {
  not_booked: Warehouse,
  booked: CalendarCheck2,
  shipped: Ship,
  delivered: PackageCheck,
};

const BUCKET_ACCENT: Record<VehicleShippingStatus, string> = {
  not_booked: 'border-t-slate-400/80',
  booked: 'border-t-sky-500/70',
  shipped: 'border-t-teal-600/70',
  delivered: 'border-t-brand/70',
};

const KPI_ICON = {
  total: Boxes,
  not_booked: Warehouse,
  booked: CalendarCheck2,
  shipped: Ship,
  delivered: PackageCheck,
} as const;

type LifecycleBoardProps = {
  snapshot: LifecycleSnapshot;
};

export function LifecycleBoard({ snapshot }: LifecycleBoardProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {snapshot.kpis.map((kpi) => {
          const Icon = KPI_ICON[kpi.key];
          return (
            <Link
              key={kpi.key}
              href={kpi.href}
              className="glass-panel-strong group rounded-xl border-border/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-glass"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {kpi.count.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {kpi.pctOfTotal == null
                  ? 'Grand total inventory'
                  : `${kpi.pctOfTotal}% of stock`}
              </p>
            </Link>
          );
        })}
      </div>

      {snapshot.alerts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {snapshot.alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs font-medium text-red-800 shadow-glass-sm backdrop-blur-sm transition-colors hover:bg-red-100/90"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {alert.count.toLocaleString()} {alert.label.toLowerCase()}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        {snapshot.columns.map((col) => {
          const Icon = BUCKET_ICON[col.bucket];
          return (
            <section
              key={col.bucket}
              className={cn(
                'glass-panel-strong flex min-h-[18rem] flex-col overflow-hidden rounded-xl border-border/40 border-t-[3px]',
                BUCKET_ACCENT[col.bucket]
              )}
            >
              <header className="border-b border-border/40 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={col.href}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-brand"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {col.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{col.cue}</p>
                  </div>
                  <Link
                    href={col.href}
                    className="shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-bold tabular-nums text-foreground"
                  >
                    {col.count.toLocaleString()}
                  </Link>
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                {col.rows.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">No units in this stage</p>
                ) : (
                  col.rows.map((row) => (
                    <Link
                      key={`${row.payment}-${row.shipping}`}
                      href={row.href}
                      className="group rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border/50 hover:bg-muted/35"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {row.label}
                            {row.alert ? (
                              <AlertTriangle className="ml-1 inline h-3 w-3 text-red-600" aria-label="Needs attention" />
                            ) : null}
                          </p>
                          {row.avgDays != null && row.avgDaysLabel ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              Avg {row.avgDays} {row.avgDaysLabel}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums text-foreground">{row.count.toLocaleString()}</p>
                          <p className="text-[10px] tabular-nums text-muted-foreground">{row.pctOfBucket}%</p>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/70">
                        <div
                          className="h-full rounded-full bg-foreground/35 transition-all group-hover:bg-brand/55"
                          style={{ width: `${Math.min(100, row.pctOfBucket)}%` }}
                        />
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {col.footerAlert ? (
                <div className="mt-auto border-t border-red-200/70 bg-red-50/80 px-3 py-2 text-[11px] font-medium text-red-800">
                  <AlertTriangle className="mr-1.5 inline h-3 w-3" />
                  {col.footerAlert}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
