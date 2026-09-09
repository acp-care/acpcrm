import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

async function getOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, org: null }
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).limit(1).maybeSingle()
  if (membership) {
    const { data: org } = await supabase.from('organizations').select('id,name').eq('id', membership.organization_id).single()
    return { user, org }
  }
  const { data: org, error } = await supabase.from('organizations').insert({ name: 'ACP CRM', created_by: user.id }).select('id,name').single()
  if (error || !org) return { user, org: null }
  await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'admin' })
  return { user, org }
}

export async function GET() {
  const supabase = await createClient()
  const { user, org } = await getOrg(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Unable to initialise organisation' }, { status: 403 })
  const { data, error } = await supabase.from('forms').select('id,name,description,status,current_version_id,created_at,updated_at').eq('organization_id', org.id).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ forms: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, org } = await getOrg(supabase)
  if (!user || !org) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Form name is required' }, { status: 422 })
  const { data: form, error: formError } = await supabase.from('forms').insert({ organization_id: org.id, name, description: body.description || null, created_by: user.id }).select().single()
  if (formError || !form) return NextResponse.json({ error: formError?.message || 'Could not create form' }, { status: 400 })
  const { data: version, error: versionError } = await supabase.from('form_versions').insert({ form_id: form.id, version_number: 1, status: 'draft', created_by: user.id }).select().single()
  if (versionError || !version) return NextResponse.json({ error: versionError?.message || 'Could not create form version' }, { status: 400 })
  const { error: updateError } = await supabase.from('forms').update({ current_version_id: version.id }).eq('id', form.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json({ id: form.id, version_id: version.id })
}
