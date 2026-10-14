import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireAdmin(
  request: NextRequest
): Promise<{ admin: SupabaseClient; callerId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  const admin = await createServerClient();
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('is_active, roles(name)')
    .eq('user_id', callerData.user.id)
    .eq('is_active', true);

  if (roleError) {
    return NextResponse.json({ error: 'Could not verify permissions' }, { status: 500 });
  }

  const isAdmin = (roleRows || []).some((row) => {
    const role = row.roles as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(role) ? role[0]?.name : role?.name;
    return name === 'admin' || name === 'super_admin';
  });

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { admin, callerId: callerData.user.id };
}

function roleName(row: { roles: unknown }): string | undefined {
  const role = row.roles as { name: string } | { name: string }[] | null;
  return Array.isArray(role) ? role[0]?.name : role?.name;
}

/** Admin, manager, or operations — same roles that may write inventory photos. */
export async function requireInventoryStaff(
  request: NextRequest
): Promise<{ admin: SupabaseClient; callerId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  const admin = await createServerClient();
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('is_active, roles(name)')
    .eq('user_id', callerData.user.id)
    .eq('is_active', true);

  if (roleError) {
    return NextResponse.json({ error: 'Could not verify permissions' }, { status: 500 });
  }

  const allowed = (roleRows || []).some((row) => {
    const name = roleName(row);
    return name === 'admin' || name === 'super_admin' || name === 'manager' || name === 'operations';
  });

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { admin, callerId: callerData.user.id };
}
