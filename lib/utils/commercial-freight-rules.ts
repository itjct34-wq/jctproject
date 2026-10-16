/**
 * Commercial-document freight rules (invoices, quotations, reservation invoices).
 *
 * Matrix (term × mode → freight):
 *   FOB × any mode              → no freight (vehicle cost only)
 *   C&F/CFR/CNF/CIF × RORO      → freight allowed; rolled into vehicle cost on print
 *   non-FOB × Container 20/40   → freight required; show as separate line on document
 *   other non-FOB × other       → freight allowed; show when present
 */

export type CommercialFreightContext = {
  incoterm?: string | null;
  /** Invoice/quote shipment_type, e.g. RORO, Container */
  shipmentType?: string | null;
  /** e.g. RORO Vessel, 20ft Container, 40ft Container */
  containerMode?: string | null;
  /** Vehicle freight_mode: roro | container */
  freightMode?: string | null;
};

export type CommercialFreightPolicy = {
  /** Seller invoice may include a freight charge line */
  allowFreight: boolean;
  /** Freight amount should be entered (Container 20/40 + non-FOB) */
  requireFreight: boolean;
  /** Print/export should render a separate freight block / summary line */
  showFreightOnDocument: boolean;
  /**
   * RORO non-FOB: hide freight lines on print/export and fold the freight
   * amount into vehicle unit / line / vehicles total so the grand total stays correct.
   */
  rollFreightIntoVehicleCost: boolean;
  /** Default description for freight line */
  defaultFreightLabel: string;
  isFob: boolean;
  isContainer: boolean;
  isRoro: boolean;
  normalizedTerm: string;
};

export type DocumentFreightDisplay = {
  /** Freight amount to render as its own line (0 when rolled/hidden) */
  documentFreight: number;
  /** Whether to render freight table / Ocean freight summary */
  showFreightBlock: boolean;
  /** Amount added into vehicles total / line prices for display */
  vehiclesFreightAddon: number;
};

const FOB_ALIASES = new Set(['FOB']);
/** Terms where ocean freight is typically seller-arranged / included in the offer */
const FREIGHT_INCLUSIVE_ALIASES = new Set([
  'C&F',
  'CNF',
  'CFR',
  'CIF',
  'CPT',
  'CIP',
  'DAP',
  'DDP',
  'DAT',
  'DPU',
]);

export function normalizeIncoterm(term?: string | null): string {
  const raw = (term || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return 'FOB';
  if (raw === 'CNF' || raw === 'CANDF' || raw === 'C&F') return 'C&F';
  if (raw === 'CFR') return 'CFR';
  return raw;
}

export function isFobTerm(term?: string | null): boolean {
  return FOB_ALIASES.has(normalizeIncoterm(term));
}

export function isFreightInclusiveTerm(term?: string | null): boolean {
  const t = normalizeIncoterm(term);
  return FREIGHT_INCLUSIVE_ALIASES.has(t);
}

export function isContainerShipment(ctx: CommercialFreightContext): boolean {
  const mode = (ctx.freightMode || '').toLowerCase();
  if (mode === 'container') return true;
  const type = (ctx.shipmentType || '').toLowerCase();
  if (type.includes('container')) return true;
  const container = (ctx.containerMode || '').toLowerCase();
  return container.includes('container') || /\b(20|40)\s*ft\b/.test(container) || container.includes('lcl');
}

export function isRoroShipment(ctx: CommercialFreightContext): boolean {
  // Any explicit "roro" token wins (e.g. "RORO Vessel", "RoRo").
  const haystack = [ctx.freightMode, ctx.shipmentType, ctx.containerMode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (haystack.includes('roro')) return true;
  if (isContainerShipment(ctx)) return false;
  // Empty / unspecified mode defaults to RORO (platform default for car exports).
  if (!haystack.trim()) return true;
  return false;
}

/** True when a line item description is a freight charge (not a vehicle). */
export function isFreightChargeDescription(description?: string | null): boolean {
  const d = (description || '').trim().toLowerCase();
  if (!d) return false;
  // Strip optional [JCTV] wrapper / notes
  const plain = d.replace(/^\[jctv\]\s*/i, '').split(/\s\|\|\s/)[0]?.trim() || d;
  if (
    /^(ocean|sea|marine|container|roro)\s*freight$/.test(plain) ||
    plain === 'freight' ||
    plain === 'ocean freight' ||
    plain === 'sea freight'
  ) {
    return true;
  }
  return /\bocean\s*freight\b|\bsea\s*freight\b|\broro\s*freight\b|\bcontainer\s*freight\b/.test(
    plain
  );
}

type DescribedLine = {
  description?: string | null;
  vehicle_id?: string | null;
};

/**
 * Drop stand-alone freight charge rows from the vehicle table.
 * Freight either rolls into vehicle prices (RORO), is forbidden (FOB),
 * or is rendered in its own freight section (container 20/40).
 */
export function filterFreightChargeLines<T extends DescribedLine>(
  lines: T[],
  _policy?: CommercialFreightPolicy
): T[] {
  if (!lines.length) return lines;
  return lines.filter((line) => {
    if (line.vehicle_id) return true;
    return !isFreightChargeDescription(line.description);
  });
}

export function isSizedContainer(ctx: CommercialFreightContext): boolean {
  if (!isContainerShipment(ctx)) return false;
  const container = (ctx.containerMode || '').toLowerCase();
  // Explicit 20/40 sizes, or generic Container shipment (treated as sized box shipment)
  if (/\b20\s*ft\b/.test(container) || /\b40\s*ft\b/.test(container) || container.includes('40ft hc')) {
    return true;
  }
  const type = (ctx.shipmentType || '').toLowerCase();
  return type.includes('container') || (ctx.freightMode || '').toLowerCase() === 'container';
}

export function defaultFreightLabel(ctx: CommercialFreightContext): string {
  if (isContainerShipment(ctx)) return 'Ocean freight';
  if (isRoroShipment(ctx)) return 'Ocean freight';
  return 'Freight';
}

export function resolveFreightPolicy(ctx: CommercialFreightContext): CommercialFreightPolicy {
  const normalizedTerm = normalizeIncoterm(ctx.incoterm);
  const fob = isFobTerm(normalizedTerm);
  const container = isContainerShipment(ctx);
  const roro = isRoroShipment(ctx);
  const sizedContainer = isSizedContainer(ctx);
  const label = defaultFreightLabel(ctx);

  if (fob) {
    return {
      allowFreight: false,
      requireFreight: false,
      showFreightOnDocument: false,
      rollFreightIntoVehicleCost: false,
      defaultFreightLabel: label,
      isFob: true,
      isContainer: container,
      isRoro: roro,
      normalizedTerm,
    };
  }

  // Non-FOB container (20/40): freight must appear as its own line
  if (sizedContainer) {
    return {
      allowFreight: true,
      requireFreight: true,
      showFreightOnDocument: true,
      rollFreightIntoVehicleCost: false,
      defaultFreightLabel: label,
      isFob: false,
      isContainer: true,
      isRoro: false,
      normalizedTerm,
    };
  }

  // RORO: freight allowed in the form/DB, but folded into vehicle cost on documents
  if (roro) {
    return {
      allowFreight: true,
      requireFreight: false,
      showFreightOnDocument: false,
      rollFreightIntoVehicleCost: true,
      defaultFreightLabel: label,
      isFob: false,
      isContainer: false,
      isRoro: true,
      normalizedTerm,
    };
  }

  // Other non-FOB modes: allow freight; show when term is freight-inclusive
  return {
    allowFreight: true,
    requireFreight: false,
    showFreightOnDocument: isFreightInclusiveTerm(normalizedTerm),
    rollFreightIntoVehicleCost: false,
    defaultFreightLabel: label,
    isFob: false,
    isContainer: container,
    isRoro: false,
    normalizedTerm,
  };
}

/** Zero freight when policy disallows it. */
export function normalizeFreightAmount(
  policy: CommercialFreightPolicy,
  amount: number | string | null | undefined
): number {
  if (!policy.allowFreight) return 0;
  const n = Math.round(Number(amount) || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function normalizeFreightNotes(
  policy: CommercialFreightPolicy,
  notes?: string | null
): string | null {
  if (!policy.allowFreight) return null;
  const trimmed = (notes || '').trim();
  if (trimmed) return trimmed;
  return policy.showFreightOnDocument || policy.requireFreight || policy.rollFreightIntoVehicleCost
    ? policy.defaultFreightLabel
    : null;
}

/** How freight should appear on print / preview / Excel / DOCX. */
export function resolveDocumentFreightDisplay(
  policy: CommercialFreightPolicy,
  amount: number | string | null | undefined
): DocumentFreightDisplay {
  const freight = normalizeFreightAmount(policy, amount);
  if (policy.rollFreightIntoVehicleCost) {
    return {
      documentFreight: 0,
      showFreightBlock: false,
      vehiclesFreightAddon: freight,
    };
  }
  const showFreightBlock =
    policy.showFreightOnDocument || (policy.allowFreight && freight > 0);
  return {
    documentFreight: showFreightBlock ? freight : 0,
    showFreightBlock,
    vehiclesFreightAddon: 0,
  };
}

type PricedLine = {
  quantity?: number | null;
  unit_price: number;
  line_total: number;
  description?: string | null;
  vehicle_id?: string | null;
};

/**
 * Distribute freight across vehicle lines for document display.
 * Single-line invoices (typical RORO) get the full amount on unit + line total.
 * Freight-charge rows are never used as distribution targets.
 */
export function applyFreightToVehicleLines<T extends PricedLine>(
  lines: T[],
  freightAddon: number
): T[] {
  const addon = Math.round(Number(freightAddon) || 0);
  if (!(addon > 0) || !lines.length) return lines;

  const targets = lines
    .map((line, idx) => ({ line, idx }))
    .filter(
      ({ line }) =>
        Boolean(line.vehicle_id) || !isFreightChargeDescription(line.description)
    );
  if (!targets.length) return lines;

  const bases = targets.map(({ line }) => {
    const qty = Number(line.quantity || 0) || 1;
    const unit = Number(line.unit_price || 0);
    const total = Number(line.line_total || 0) || qty * unit;
    return { qty, total: Math.round(total) };
  });
  const baseSum = bases.reduce((sum, b) => sum + b.total, 0);
  let remaining = addon;
  const shares = new Map<number, number>();

  targets.forEach(({ idx }, tIdx) => {
    const isLast = tIdx === targets.length - 1;
    let share: number;
    if (isLast) {
      share = remaining;
    } else if (baseSum > 0) {
      share = Math.round((bases[tIdx].total / baseSum) * addon);
      remaining -= share;
    } else {
      share = Math.floor(addon / targets.length);
      remaining -= share;
    }
    shares.set(idx, share);
  });

  return lines.map((line, idx) => {
    const share = shares.get(idx);
    if (share == null) return line;
    const qty = Number(line.quantity || 0) || 1;
    const baseTotal =
      Number(line.line_total || 0) || qty * Number(line.unit_price || 0);
    const newTotal = Math.round(baseTotal) + share;
    const newUnit = qty === 1 ? newTotal : Math.round(newTotal / qty);
    return {
      ...line,
      unit_price: newUnit,
      line_total: newTotal,
    };
  });
}

/** Validation message when freight is required but missing; null if OK. */
export function freightValidationError(
  policy: CommercialFreightPolicy,
  amount: number | string | null | undefined
): string | null {
  if (!policy.requireFreight) return null;
  const n = Number(amount) || 0;
  if (n > 0) return null;
  return 'Container shipments require a freight amount on the invoice.';
}
