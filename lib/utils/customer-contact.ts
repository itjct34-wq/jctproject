/** Map Supabase/Postgres customer contact errors to clear UI messages. */
export function customerContactErrorMessage(error: {
  code?: string;
  message?: string;
  details?: string;
} | null | undefined): string {
  if (!error) return 'Could not save customer';
  const msg = `${error.message || ''} ${error.details || ''}`;
  if (error.code === '23505' || /duplicate key|unique constraint/i.test(msg)) {
    if (/customers_email_unique|email/i.test(msg)) {
      return 'A customer with this email already exists. Email must be unique.';
    }
    if (/customers_phone_unique|phone/i.test(msg)) {
      return 'A customer with this phone number already exists. Contact must be unique.';
    }
    return 'Email or phone is already used by another customer.';
  }
  if (/customers_require_email_and_phone/i.test(msg)) {
    return 'Consignee email and contact (phone) are required.';
  }
  if (/customers_require_shipping_address/i.test(msg)) {
    return 'Consignee address is required for shipping.';
  }
  if (/row-level security|RLS|42501/i.test(msg) || error.code === '42501') {
    return 'You do not have permission to update this customer.';
  }
  return error.message || 'Could not save customer';
}

export function isCustomerConsigneeComplete(input: {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
}): string | null {
  if (!input.full_name?.trim()) return 'Consignee name is required';
  if (!input.email?.trim()) return 'Consignee email is required';
  if (!input.phone?.trim()) return 'Consignee contact (phone) is required';
  if (!input.address_line1?.trim()) return 'Consignee address is required for shipping';
  return null;
}
