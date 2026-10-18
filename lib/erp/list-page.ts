/**
 * Default cap for ERP list queries so pages do not unbounded-select entire tables.
 * Vehicle / customer pickers that must be complete should use `fetchAllPages` instead.
 */
export const ERP_LIST_LIMIT = 500;
