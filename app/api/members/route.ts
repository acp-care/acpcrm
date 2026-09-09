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

  const { data: actor } = await supabase.from('organization_members').select('id,organization_id,role_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!actor) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })

  const [{ data: actorRole }, { data: role }, { data: target }] = await Promise.all([
    actor.role_id ? supabase.from('roles').select('is_owner').eq('id', actor.role_id).eq('organization_id', actor.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('roles').select('id,organization_id,is_owner').eq('id', roleId).eq('organization_id', actor.organization_id).single(),
    supabase.from('organization_members').select('id,user_id,role_id').eq('id', memberId).eq('organization_id', actor.organization_id).single()
  ])
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Only the existing owner can grant the protected owner role.
  if (role.is_owner && !actorRole?.is_owner) return NextResponse.json({ error: 'Only the organisation owner can assign the Owner role' }, { status: 403 })
  // Do not allow the owner to remove their own ownership accidentally.
  if (target.user_id === user.id && !role.is_owner) return NextResponse.json({ error: 'The owner cannot remove their own Owner role' }, { status: 409 })

  const { error } = await supabase.from('organization_members').update({ role_id: roleId, role: role.is_owner ? 'owner' : 'staff' }).eq('id', memberId).eq('organization_id', actor.organization_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
