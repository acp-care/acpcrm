import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, org: null }
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role,role_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) return { supabase, user, org: null, membership: null }
  const { data: org } = await supabase.from('organizations').select('id,name').eq('id', membership.organization_id).single()
  return { supabase, user, org, membership }
}

export async function GET() {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const [{ data: roles, error: roleError }, { data: permissions, error: permissionError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from('roles').select('id,name,description,is_system,is_owner,created_at,updated_at').eq('organization_id', org.id).order('is_owner', { ascending: false }).order('name'),
    supabase.from('permissions').select('id,key,name,description,module').order('module').order('name'),
    supabase.from('organization_members').select('id,user_id,role,role_id,created_at').eq('organization_id', org.id).order('created_at')
  ])
  if (roleError || permissionError || memberError) return NextResponse.json({ error: roleError?.message || permissionError?.message || memberError?.message }, { status: 400 })
  const roleIds = (roles || []).map(r => r.id)
  const { data: rolePermissions } = roleIds.length ? await supabase.from('role_permissions').select('role_id,permission_id').in('role_id', roleIds) : { data: [] }
  return NextResponse.json({ roles: roles || [], permissions: permissions || [], rolePermissions: rolePermissions || [], members: members || [], organisation: org })
}

export async function POST(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Role name is required' }, { status: 422 })
  const { data: role, error } = await supabase.from('roles').insert({ organization_id: org.id, name, description: String(body.description || '').trim(), is_system: false, is_owner: false }).select().single()
  if (error || !role) return NextResponse.json({ error: error?.message || 'Could not create role' }, { status: 400 })
  if (Array.isArray(body.permission_ids) && body.permission_ids.length) {
    const { error: permissionError } = await supabase.from('role_permissions').insert(body.permission_ids.map((permission_id: string) => ({ role_id: role.id, permission_id })))
    if (permissionError) return NextResponse.json({ error: permissionError.message }, { status: 400 })
  }
  return NextResponse.json({ role }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'Role id is required' }, { status: 422 })
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.description !== undefined) patch.description = String(body.description).trim()
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('roles').update(patch).eq('id', id).eq('organization_id', org.id).eq('is_owner', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (Array.isArray(body.permission_ids)) {
    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
    if (body.permission_ids.length) {
      const { error: insertError } = await supabase.from('role_permissions').insert(body.permission_ids.map((permission_id: string) => ({ role_id: id, permission_id })))
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Role id is required' }, { status: 422 })
  const { data: role } = await supabase.from('roles').select('id,is_owner').eq('id', id).eq('organization_id', org.id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  if (role.is_owner) return NextResponse.json({ error: 'The owner role is protected' }, { status: 409 })
  const { count } = await supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('role_id', id)
  if ((count || 0) > 0) return NextResponse.json({ error: 'Reassign members before deleting this role' }, { status: 409 })
  const { error } = await supabase.from('roles').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
