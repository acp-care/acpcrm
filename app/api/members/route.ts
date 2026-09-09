import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const memberId = String(body.member_id || '')
  const roleId = String(body.role_id || '')
  if (!memberId || !roleId) return NextResponse.json({ error: 'Member and role are required' }, { status: 422 })
  const { data: actor } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!actor) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const { data: role } = await supabase.from('roles').select('id,organization_id,is_owner').eq('id', roleId).eq('organization_id', actor.organization_id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  const { error } = await supabase.from('organization_members').update({ role_id: roleId, role: role.is_owner ? 'owner' : 'staff' }).eq('id', memberId).eq('organization_id', actor.organization_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
