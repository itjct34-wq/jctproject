/**
 * Commercial-document freight rules (invoices, quotations, reservation invoices).
 *
 * Matrix (term × mode → freight):
 *   FOB × any mode              → no freight (vehicle cost only)
 *   C&F/CFR/CNF/CIF × RORO      → freight allowed; show/mention on document
 *   non-FOB × Container 20/40   → freight required; show on document
 *   other non-FOB × RORO/other  → freight allowed; show when present
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
  /** Print/export should render the freight block */
  showFreightOnDocument: boolean;
  /** Default description for freight line */
  defaultFreightLabel: string;
  isFob: boolean;
  isContainer: boolean;
  isRoro: boolean;
  normalizedTerm: string;
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
  if (isContainerShipment(ctx)) return false;
  const mode = (ctx.freightMode || '').toLowerCase();
  if (mode === 'roro') return true;
  const type = (ctx.shipmentType || '').toLowerCase();
  if (type.includes('roro')) return true;
  const container = (ctx.containerMode || '').toLowerCase();
  return container.includes('roro');
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
      defaultFreightLabel: label,
      isFob: true,
      isContainer: container,
      isRoro: roro,
      normalizedTerm,
    };
  }

  // Non-FOB container (20/40): freight must be on the invoice
  if (sizedContainer) {
    return {
      allowFreight: true,
      requireFreight: true,
      showFreightOnDocument: true,
      defaultFreightLabel: label,
      isFob: false,
      isContainer: true,
      isRoro: false,
      normalizedTerm,
    };
  }

  // RORO (or other) with freight-inclusive terms: allow + always mention on print
  const showAlways = isFreightInclusiveTerm(normalizedTerm) || roro;
  return {
    allowFreight: true,
    requireFreight: false,
    showFreightOnDocument: showAlways,
    defaultFreightLabel: label,
    isFob: false,
    isContainer: container,
    isRoro: roro,
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
  return policy.showFreightOnDocument || policy.requireFreight ? policy.defaultFreightLabel : null;
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
