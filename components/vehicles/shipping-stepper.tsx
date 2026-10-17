'use client';

import { cn } from '@/lib/utils';
import {
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGES,
  workflowStage,
  type VehicleWorkflowStage,
} from '@/lib/vehicle-lifecycle';
import type { Vehicle } from '@/lib/types';

export function ShippingStepper({ vehicle }: { vehicle: Pick<Vehicle, 'payment_status' | 'shipping_status' | 'customer_id' | 'status'> }) {
  const current = workflowStage(vehicle as Vehicle);
  const currentIdx = WORKFLOW_STAGES.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {WORKFLOW_STAGES.map((stage, idx) => (
        <li key={stage} className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
              idx < currentIdx && 'border-emerald-200 bg-emerald-50 text-emerald-800',
              idx === currentIdx && 'border-primary bg-primary text-primary-foreground',
              idx > currentIdx && 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            {WORKFLOW_STAGE_LABELS[stage as VehicleWorkflowStage]}
          </span>
          {idx < WORKFLOW_STAGES.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </li>
      ))}
    </ol>
  );
}
