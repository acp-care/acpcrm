import FormBuilder from '../../../../components/forms/form-builder'

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a className="active" href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a href="/admin/automations">Automations</a></nav></aside><main className="main"><FormBuilder formId={id}/></main></div>
}
