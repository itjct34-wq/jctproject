export type RoleName =
  | 'super_admin'
  | 'admin'
  | 'operations'
  | 'manager'
  | 'sales_agent'
  | 'freelancer'
  | 'accounts'
  | 'auditor';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'assign'
  | 'approve_bid'
  | 'cancel'
  | 'finalize'
  | 'credit_note'
  | 'confirm'
  | 'reverse'
  | 'import'
  | 'view_costs'
  | 'view_financials'
  | 'assign_roles'
  | 'assign_teams'
  | 'download'
  | 'manage';

export type PermissionModule =
  | 'dashboard'
  | 'customers'
  | 'vehicles'
  | 'auctions'
  | 'purchases'
  | 'sales'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'shipments'
  | 'documents'
  | 'tasks'
  | 'reports'
  | 'users'
  | 'settings'
  | 'audit'
  | 'notifications';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: RoleName;
  display_name: string;
  description: string | null;
  sort_order: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  module: PermissionModule;
  action: PermissionAction;
  description: string | null;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
  assigned_by: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  is_team_lead: boolean;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  legal_name: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  prefecture: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  default_currency: string;
  supported_currencies: string[];
  invoice_prefix: string;
  invoice_next_number: number;
  quotation_prefix: string;
  quotation_next_number: number;
  payment_instructions: string | null;
  bank_details: Record<string, unknown> | null;
  timezone: string;
  date_format: string;
  reservation_default_days: number;
  low_stock_alert_days: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  record_type: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: 'info' | 'success' | 'warning' | 'error' | 'auction' | 'payment' | 'shipment' | 'task' | 'approval';
  related_module: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  related_module: string | null;
  related_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  customer_type: 'individual' | 'company';
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  tax_id: string | null;
  default_currency: string;
  status: 'lead' | 'active' | 'inactive' | 'blocked';
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CustomerRequirement {
  id: string;
  customer_id: string;
  make: string | null;
  model: string | null;
  year_from: number | null;
  year_to: number | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  status: 'open' | 'matched' | 'closed';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCommunication {
  id: string;
  customer_id: string;
  communication_type: 'call' | 'email' | 'whatsapp' | 'visit' | 'note';
  subject: string;
  body: string | null;
  created_by: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  stock_number: string;
  chassis_number: string;
  make: string;
  model: string;
  model_grade: string | null;
  model_year: number | null;
  registration_year: number | null;
  color: string | null;
  mileage_km: number | null;
  transmission: 'automatic' | 'manual' | 'cvt' | 'other' | null;
  fuel_type: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other' | null;
  source_country: string | null;
  source_supplier: string | null;
  purchase_price: number | null;
  purchase_currency: string;
  listed_price: number | null;
  listed_currency: string;
  status: 'in_stock' | 'reserved' | 'sold' | 'in_transit' | 'exported' | 'on_hold' | 'archived';
  location: string | null;
  arrival_date: string | null;
  reserved_until: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleStatusHistory {
  id: string;
  vehicle_id: string;
  from_status: Vehicle['status'] | null;
  to_status: Vehicle['status'];
  note: string | null;
  changed_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_type: 'auction_house' | 'dealer' | 'wholesaler' | 'individual';
  name: string;
  category: string | null;
  country: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  contact_person: string | null;
  payment_terms: string | null;
  default_currency: string;
  status: 'active' | 'inactive' | 'blocked';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface AuctionListing {
  id: string;
  listing_code: string;
  supplier_id: string | null;
  vehicle_id: string | null;
  chassis_number: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  auction_date: string | null;
  lot_number: string | null;
  start_price: number | null;
  currency: string;
  result: 'pending' | 'won' | 'lost' | 'cancelled';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuctionBid {
  id: string;
  listing_id: string;
  bid_amount: number;
  currency: string;
  max_bid: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'won' | 'lost';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  purchase_code: string;
  supplier_id: string | null;
  vehicle_id: string | null;
  auction_listing_id: string | null;
  purchase_date: string;
  vehicle_price: number;
  auction_fees: number;
  transport_cost: number;
  inspection_cost: number;
  other_cost: number;
  currency: string;
  status: 'draft' | 'confirmed' | 'invoiced' | 'paid' | 'cancelled';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  sale_code: string;
  customer_id: string;
  vehicle_id: string;
  sale_date: string;
  sale_price: number;
  currency: string;
  deposit_amount: number;
  deposit_date: string | null;
  status: 'reserved' | 'confirmed' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  delivery_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  quotation_code: string;
  customer_id: string;
  sale_id: string | null;
  price_type: 'FOB' | 'CNF' | 'CIF';
  subtotal: number;
  freight: number;
  insurance: number;
  other_fees: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  valid_until: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  vehicle_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_code: string;
  customer_id: string;
  sale_id: string | null;
  invoice_type: 'proforma' | 'commercial' | 'credit_note';
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'cancelled' | 'credited';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payment_code: string;
  customer_id: string | null;
  invoice_id: string | null;
  sale_id: string | null;
  payment_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_jpy: number;
  payment_method: 'bank_transfer' | 'cash' | 'credit_card' | 'other' | null;
  bank_reference: string | null;
  status: 'pending' | 'received' | 'reconciled' | 'rejected';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_code: string;
  category: string;
  vehicle_id: string | null;
  sale_id: string | null;
  expense_date: string;
  amount: number;
  currency: string;
  payment_method: 'bank_transfer' | 'cash' | 'credit_card' | 'other' | null;
  vendor: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  shipment_code: string;
  sale_id: string | null;
  booking_date: string | null;
  etd: string | null;
  eta: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  final_destination: string | null;
  bl_number: string | null;
  shipping_line: string | null;
  container_number: string | null;
  status: 'booked' | 'loaded' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  vehicle_id: string;
  created_at: string;
}

export interface ExportDocument {
  id: string;
  shipment_id: string | null;
  sale_id: string | null;
  document_type: 'export_certificate' | 'commercial_invoice' | 'packing_list' | 'bill_of_lading' | 'courier_receipt' | 'inspection_certificate' | 'other';
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  status: 'pending' | 'prepared' | 'submitted' | 'received' | 'verified' | 'rejected';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  vehicle_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface UserWithRoles extends Profile {
  roles: Role[];
  team_name?: string | null;
}

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operations: 'Operations',
  manager: 'Manager',
  sales_agent: 'Sales Agent',
  freelancer: 'Freelancer',
  accounts: 'Accounts / Finance',
  auditor: 'Read-only Auditor',
};

export const ROLE_COLORS: Record<RoleName, string> = {
  super_admin: 'bg-red-100 text-red-700 border-red-200',
  admin: 'bg-orange-100 text-orange-700 border-orange-200',
  operations: 'bg-blue-100 text-blue-700 border-blue-200',
  manager: 'bg-green-100 text-green-700 border-green-200',
  sales_agent: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  freelancer: 'bg-slate-100 text-slate-700 border-slate-200',
  accounts: 'bg-amber-100 text-amber-700 border-amber-200',
  auditor: 'bg-gray-100 text-gray-700 border-gray-200',
};
