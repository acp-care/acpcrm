const modules = [
  ['Customers','Manage client records, contacts and custom data.','/customers'],
  ['Forms','Build completely configurable forms and publish versions.','/admin/forms'],
  ['Mappings','Map submitted form fields to customer data.','/admin/mappings'],
  ['Automations','Trigger actions from form submissions and changes.','/admin/automations'],
]

export default function Home() {
  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a className="active" href="/">Dashboard</a><a href="/customers">Customers</a><a href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a href="/admin/automations">Automations</a><a href="/tasks">Tasks</a></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">Administration</div><h1 className="title">CRM Dashboard</h1><div className="muted">A configurable foundation for ACP workflows.</div></div><a className="btn" href="/admin/forms">Create form</a></div><div className="grid"><div className="card"><div className="muted">Customers</div><div className="stat">0</div></div><div className="card"><div className="muted">Forms</div><div className="stat">0</div></div><div className="card"><div className="muted">Submissions</div><div className="stat">0</div></div><div className="card"><div className="muted">Open tasks</div><div className="stat">0</div></div></div><section className="section"><h2>CRM modules</h2><div className="list">{modules.map(([name,description,url])=><div className="row" key={name}><div><strong>{name}</strong><div className="muted">{description}</div></div><a className="btn secondary" href={url}>Open</a></div>)}</div></section></main></div>
}