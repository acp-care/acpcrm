import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: form, error } = await supabase.from('forms').select('id,name,description,status,current_version_id').eq('id', id).single()
  if (error || !form) return NextResponse.json({ error: error?.message || 'Form not found' }, { status: 404 })
  const { data: version } = await supabase.from('form_versions').select('id,version_number,status,published_at').eq('id', form.current_version_id).maybeSingle()
  const { data: fields, error: fieldError } = version ? await supabase.from('form_fields').select('id,field_key,label,field_type,position,required,config,visibility_rule').eq('form_version_id', version.id).order('position') : { data: [], error: null }
  if (fieldError) return NextResponse.json({ error: fieldError.message }, { status: 400 })
  return NextResponse.json({ form, version, fields: fields || [] })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await request.json()
  const { data: form } = await supabase.from('forms').select('id,current_version_id,status').eq('id', id).single()
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  if (body.action === 'save') {
    const { error } = await supabase.from('forms').update({ name: body.name, description: body.description || null }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!form.current_version_id) return NextResponse.json({ ok: true })
    const { data: version } = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single()
    if (version?.status !== 'draft') {
      const { data: versions } = await supabase.from('form_versions').select('version_number').eq('form_id', id).order('version_number', { ascending: false }).limit(1)
      const nextNumber = (versions?.[0]?.version_number || 0) + 1
      const { data: newVersion, error: newVersionError } = await supabase.from('form_versions').insert({ form_id: id, version_number: nextNumber, status: 'draft', created_by: user.id }).select().single()
      if (newVersionError || !newVersion) return NextResponse.json({ error: newVersionError?.message || 'Could not create draft' }, { status: 400 })
      const { data: oldFields } = await supabase.from('form_fields').select('field_key,label,field_type,position,required,config,visibility_rule').eq('form_version_id', form.current_version_id)
      if (oldFields?.length) await supabase.from('form_fields').insert(oldFields.map(f => ({ ...f, form_version_id: newVersion.id })))
      await supabase.from('forms').update({ current_version_id: newVersion.id, status: 'draft' }).eq('id', id)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'save_fields') {
    const { data: version } = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single()
    if (!version || version.status !== 'draft') return NextResponse.json({ error: 'Only draft versions can be edited' }, { status: 409 })
    const fields = Array.isArray(body.fields) ? body.fields : []
    const { error: deleteError } = await supabase.from('form_fields').delete().eq('form_version_id', version.id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
    if (fields.length) {
      const { error } = await supabase.from('form_fields').insert(fields.map((f: Record<string, unknown>, index: number) => ({ form_version_id: version.id, field_key: f.field_key, label: f.label, field_type: f.field_type, position: index, required: Boolean(f.required), config: f.config || {}, visibility_rule: f.visibility_rule || {} })))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'publish') {
    const { data: version } = await supabase.from('form_versions').select('id,status').eq('id', form.current_version_id).single()
    if (!version || version.status !== 'draft') return NextResponse.json({ error: 'No draft version available' }, { status: 409 })
    await supabase.from('form_versions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', version.id)
    await supabase.from('forms').update({ status: 'published' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
