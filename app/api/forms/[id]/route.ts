import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, org: null }
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).limit(1).maybeSingle()
  return { supabase, user, org: membership?.organization_id || null }
}

async function ensureDraft(supabase: any, form: any, userId: string) {
  if (!form.current_version_id) return null
  const { data: version } = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single()
  if (version?.status === 'draft') return version
  const { data: versions } = await supabase.from('form_versions').select('version_number').eq('form_id', form.id).order('version_number', { ascending: false }).limit(1)
  const nextNumber = (versions?.[0]?.version_number || 0) + 1
  const { data: newVersion, error } = await supabase.from('form_versions').insert({ form_id: form.id, version_number: nextNumber, status: 'draft', created_by: userId }).select().single()
  if (error || !newVersion) return null
  const { data: oldFields } = await supabase.from('form_fields').select('field_key,label,field_type,position,required,config,visibility_rule').eq('form_version_id', form.current_version_id).order('position')
  if (oldFields?.length) await supabase.from('form_fields').insert(oldFields.map((f: any) => ({ ...f, form_version_id: newVersion.id })))
  const { error: formError } = await supabase.from('forms').update({ current_version_id: newVersion.id, status: 'draft' }).eq('id', form.id).eq('organization_id', form.organization_id)
  if (formError) return null
  return newVersion
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, org } = await getContext()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const { data: form, error } = await supabase.from('forms').select('id,organization_id,name,description,status,current_version_id').eq('id', id).eq('organization_id', org).single()
  if (error || !form) return NextResponse.json({ error: error?.message || 'Form not found' }, { status: 404 })
  const { data: version } = await supabase.from('form_versions').select('id,version_number,status,published_at').eq('id', form.current_version_id).maybeSingle()
  const { data: fields, error: fieldError } = version ? await supabase.from('form_fields').select('id,field_key,label,field_type,position,required,config,visibility_rule').eq('form_version_id', version.id).order('position') : { data: [], error: null }
  if (fieldError) return NextResponse.json({ error: fieldError.message }, { status: 400 })
  return NextResponse.json({ form, version, fields: fields || [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, org } = await getContext()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!org) return NextResponse.json({ error: 'Organisation not initialised' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const { data: form } = await supabase.from('forms').select('id,organization_id,current_version_id,status').eq('id', id).eq('organization_id', org).single()
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  if (body.action === 'save') {
    const { error } = await supabase.from('forms').update({ name: String(body.name || '').trim(), description: body.description || null }).eq('id', id).eq('organization_id', org)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!form.current_version_id) return NextResponse.json({ ok: true })
    const draft = await ensureDraft(supabase, form, user.id)
    if (!draft && form.status !== 'draft') return NextResponse.json({ error: 'Could not create draft version' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'save_fields') {
    let version = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single().then((r:any)=>r.data)
    if (!version || version.status !== 'draft') version = await ensureDraft(supabase, form, user.id)
    if (!version || version.status !== 'draft') return NextResponse.json({ error: 'Could not create editable draft version' }, { status: 409 })
    const fields = Array.isArray(body.fields) ? body.fields : []
    const seen = new Set<string>()
    for (const f of fields) { const key=String(f.field_key||'').trim(); if(!key || seen.has(key)) return NextResponse.json({error:'Every field needs a unique field key'},{status:422}); seen.add(key) }
    const { error: deleteError } = await supabase.from('form_fields').delete().eq('form_version_id', version.id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
    if (fields.length) {
      const { error } = await supabase.from('form_fields').insert(fields.map((f: Record<string, unknown>, index: number) => ({ form_version_id: version.id, field_key: String(f.field_key), label: String(f.label || f.field_key), field_type: String(f.field_type || 'text'), position: index, required: Boolean(f.required), config: f.config || {}, visibility_rule: f.visibility_rule || {} })))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, version_id: version.id })
  }

  if (body.action === 'publish') {
    let version = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single().then((r:any)=>r.data)
    if (!version || version.status !== 'draft') version = await ensureDraft(supabase, form, user.id)
    if (!version || version.status !== 'draft') return NextResponse.json({ error: 'No draft version available' }, { status: 409 })
    const { error: versionError } = await supabase.from('form_versions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', version.id)
    if (versionError) return NextResponse.json({ error: versionError.message }, { status: 400 })
    const { error: formError } = await supabase.from('forms').update({ status: 'published', current_version_id: version.id }).eq('id', id).eq('organization_id', org)
    if (formError) return NextResponse.json({ error: formError.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
