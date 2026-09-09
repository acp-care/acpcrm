import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || 'ACP CRM').trim().slice(0, 120) || 'ACP CRM'
  const { data, error } = await supabase.rpc('bootstrap_first_organization', { p_name: name })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || { created: false })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data } = await supabase.from('organization_members').select('organization_id,role,role_id').eq('user_id', user.id).limit(1).maybeSingle()
  return NextResponse.json({ initialized: !!data, membership: data || null })
}
