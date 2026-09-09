import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

const standardFields = new Set(['first_name','last_name','email','phone','date_of_birth','external_ref','status'])

function matches(value: unknown, operator: string, expected: string) {
  const actual = value == null ? '' : String(value)
  if (operator === 'is_empty') return actual === ''
  if (operator === 'not_empty') return actual !== ''
  if (operator === 'contains') return actual.toLowerCase().includes(expected.toLowerCase())
  if (operator === 'not_equals') return actual !== expected
  return actual === expected
}

function interpolate(value: unknown, answers: Record<string, unknown>, customer: Record<string, unknown>) {
  if (typeof value !== 'string') return value
  return value.replace(/\{\{\s*(?:answer|customer)\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(answers[key] ?? customer[key] ?? ''))
}

async function runAutomations(supabase: any, orgId: string, userId: string, formId: string, customerId: string, answers: Record<string, unknown>) {
  const { data: rules } = await supabase.from('automation_rules').select('id,name,conditions').eq('organization_id',orgId).eq('enabled',true).eq('trigger_type','form_submitted')
  if (!rules?.length) return
  const { data: customer } = await supabase.from('customers').select('*').eq('id',customerId).eq('organization_id',orgId).single()
  for (const rule of rules) {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
    const passes = conditions.every((c: any) => !c.field_key || matches(answers[c.field_key] ?? customer?.[c.field_key] ?? customer?.metadata?.[c.field_key], c.operator || 'equals', String(c.value ?? '')))
    if (!passes) continue
    const { data: actions } = await supabase.from('automation_actions').select('action_type,config').eq('automation_rule_id',rule.id).order('position')
    for (const action of actions || []) {
      const cfg = action.config || {}
      if (action.action_type === 'update_customer') {
        const field = String(cfg.field || '')
        const value = interpolate(cfg.value, answers, customer || {})
        if (!field) continue
        if (standardFields.has(field)) await supabase.from('customers').update({[field]: value, updated_at:new Date().toISOString()}).eq('id',customerId).eq('organization_id',orgId)
        else await supabase.from('customers').update({metadata:{...(customer?.metadata || {}),[field]:value},updated_at:new Date().toISOString()}).eq('id',customerId).eq('organization_id',orgId)
      } else if (action.action_type === 'create_task') {
        await supabase.from('tasks').insert({organization_id:orgId,customer_id:customerId,assigned_to:cfg.assigned_to || null,title:String(interpolate(cfg.title || 'Follow up',answers,customer||{})),description:cfg.description ? String(interpolate(cfg.description,answers,customer||{})) : null,due_at:cfg.due_at || null})
      } else if (action.action_type === 'create_activity') {
        await supabase.from('activities').insert({organization_id:orgId,customer_id:customerId,actor_id:userId,activity_type:String(cfg.activity_type || 'automation'),payload:{title:interpolate(cfg.title || rule.name,answers,customer||{}),automation_rule_id:rule.id}})
      }
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data:{user} } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:'Unauthorised'},{status:401})
  const body = await request.json().catch(()=>({}))
  const formId=String(body.form_id||''), suppliedCustomer=body.customer_id ? String(body.customer_id) : null
  if(!formId || !body.answers || typeof body.answers !== 'object') return NextResponse.json({error:'form_id and answers are required'},{status:422})
  const {data:membership}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).limit(1).maybeSingle()
  if(!membership) return NextResponse.json({error:'Organisation not initialised'},{status:403})
  const orgId=membership.organization_id
  const {data:form}=await supabase.from('forms').select('id,current_version_id,status').eq('id',formId).eq('organization_id',orgId).single()
  if(!form || form.status!=='published') return NextResponse.json({error:'Published form not found'},{status:404})
  const {data:fields}=await supabase.from('form_fields').select('id,field_key,required').eq('form_version_id',form.current_version_id).order('position')
  const answers=body.answers as Record<string,unknown>
  for(const f of fields||[]) if(f.required && (answers[f.field_key]===undefined || answers[f.field_key]===null || String(answers[f.field_key]).trim()==='')) return NextResponse.json({error:`${f.field_key} is required`},{status:422})
  let customerId=suppliedCustomer
  if(customerId){const {data}=await supabase.from('customers').select('id').eq('id',customerId).eq('organization_id',orgId).single();if(!data)return NextResponse.json({error:'Customer not found'},{status:404})}
  const {data:mappings}=await supabase.from('field_mappings').select('form_field_key,target_key,enabled').eq('organization_id',orgId).eq('form_id',formId).eq('target_type','customer').eq('enabled',true)
  const customerPatch:any={}
  const metadata:any={}
  for(const m of mappings||[]){const value=answers[m.form_field_key];if(value===undefined)continue;if(standardFields.has(m.target_key))customerPatch[m.target_key]=value;else metadata[m.target_key]=value}
  if(!customerId){const {data:created,error}=await supabase.from('customers').insert({organization_id:orgId,...customerPatch,metadata}).select('id').single();if(error||!created)return NextResponse.json({error:error?.message||'Could not create customer'},{status:400});customerId=created.id}
  else {const {data:existing}=await supabase.from('customers').select('metadata').eq('id',customerId).single();const {error}=await supabase.from('customers').update({...customerPatch,metadata:{...(existing?.metadata||{}),...metadata},updated_at:new Date().toISOString()}).eq('id',customerId).eq('organization_id',orgId);if(error)return NextResponse.json({error:error.message},{status:400})}
  const {data:submission,error:submissionError}=await supabase.from('form_submissions').insert({organization_id:orgId,form_id:formId,form_version_id:form.current_version_id,customer_id:customerId,submitted_by:user.id,status:'submitted'}).select('id').single()
  if(submissionError||!submission)return NextResponse.json({error:submissionError?.message||'Could not save submission'},{status:400})
  if(fields?.length){const {error}=await supabase.from('form_answers').insert(fields.filter((f:any)=>answers[f.field_key]!==undefined).map((f:any)=>({submission_id:submission.id,form_field_id:f.id,value:answers[f.field_key]})));if(error)return NextResponse.json({error:error.message},{status:400})}
  await runAutomations(supabase,orgId,user.id,formId,customerId,answers)
  await supabase.from('form_submissions').update({status:'processed'}).eq('id',submission.id)
  await supabase.from('activities').insert({organization_id:orgId,customer_id:customerId,actor_id:user.id,activity_type:'form_submitted',payload:{form_id:formId,submission_id:submission.id}})
  return NextResponse.json({ok:true,submission_id:submission.id,customer_id:customerId})
}
