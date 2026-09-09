import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, org: null }
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) return { supabase, user, org: null }
  const { data: org } = await supabase.from('organizations').select('id,name').eq('id', membership.organization_id).single()
  return { supabase, user, org }
}

export async function GET() {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const { data: rules, error } = await supabase.from('automation_rules').select('id,name,trigger_type,conditions,enabled,created_at,updated_at').eq('organization_id', org.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const ids = (rules || []).map(r => r.id)
  const { data: actions } = ids.length ? await supabase.from('automation_actions').select('id,automation_rule_id,action_type,position,config').in('automation_rule_id', ids).order('position') : { data: [] }
  return NextResponse.json({ rules: rules || [], actions: actions || [] })
}

export async function POST(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Automation name is required' }, { status: 422 })
  const triggerType = String(body.trigger_type || 'form_submitted')
  const conditions = Array.isArray(body.conditions) ? body.conditions : []
  const actions = Array.isArray(body.actions) ? body.actions : []
  const { data: rule, error } = await supabase.from('automation_rules').insert({ organization_id: org.id, name, trigger_type: triggerType, conditions, enabled: body.enabled !== false }).select().single()
  if (error || !rule) return NextResponse.json({ error: error?.message || 'Could not create automation' }, { status: 400 })
  if (actions.length) {
    const { error: actionError } = await supabase.from('automation_actions').insert(actions.map((a: Record<string, unknown>, index: number) => ({ automation_rule_id: rule.id, action_type: String(a.action_type || 'create_task'), position: index, config: a.config || {} })))
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 400 })
  }
  return NextResponse.json({ rule }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'Automation id is required' }, { status: 422 })
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.trigger_type !== undefined) patch.trigger_type = String(body.trigger_type)
  if (body.conditions !== undefined) patch.conditions = Array.isArray(body.conditions) ? body.conditions : []
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  const { error } = await supabase.from('automation_rules').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (Array.isArray(body.actions)) {
    await supabase.from('automation_actions').delete().eq('automation_rule_id', id)
    if (body.actions.length) {
      const { error: actionError } = await supabase.from('automation_actions').insert(body.actions.map((a: Record<string, unknown>, index: number) => ({ automation_rule_id: id, action_type: String(a.action_type || 'create_task'), position: index, config: a.config || {} })))
      if (actionError) return NextResponse.json({ error: actionError.message }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { supabase, user, org } = await context()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Automation id is required' }, { status: 422 })
  const { error } = await supabase.from('automation_rules').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
