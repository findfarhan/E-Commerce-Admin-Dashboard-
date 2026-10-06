import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {createStaffUserAction,updateStaffUserAction} from "./actions";

export default async function Team(){
  const [users,roles]=await Promise.all([adminRequest<any>("/v1/admin/team/users",0),adminRequest<any>("/v1/admin/team/roles",0)]);
  return <>
    <PageHeader eyebrow="ACCESS / RBAC" title="Team & Roles" description="Database-backed staff accounts with signed sessions and least-privilege route permissions. Basic owner credentials remain an emergency bootstrap path."/>
    <section className="dashboard-grid">
      <form action={createStaffUserAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Add staff account</h2>
          <div className="field-grid">
            <label className="field"><span>Name</span><input name="name" required/></label>
            <label className="field"><span>Email</span><input name="email" type="email" required/></label>
            <label className="field"><span>Temporary password</span><input name="password" type="password" minLength={10} required autoComplete="new-password"/></label>
          </div>
          <div className="tag-list">{(roles?.items||[]).map((r:any)=><label className="tag" key={r.id}><input type="checkbox" name="roleIds" value={r.id}/> {r.name}</label>)}</div>
          <button className="primary-button">Create staff user</button>
        </section>
      </form>
      <article className="panel">
        <div className="panel-head"><div><span>ROLE MATRIX</span><h2>Standard roles</h2></div></div>
        <div className="activity-list">{(roles?.items||[]).map((r:any)=><div className="activity-item" key={r.id}><span>•</span><div><b>{r.name}</b><p>{(r.permissions||[]).join(" · ")}</p></div></div>)}</div>
      </article>
    </section>
    <section className="team-grid" style={{marginTop:14}}>
      {(users?.items||[]).map((u:any)=>{
        const assigned=new Set((u.roles||[]).map((r:any)=>r.id));
        return <form action={updateStaffUserAction.bind(null,u.id)} className="panel settings-panel" key={u.id}>
          <section className="settings-section">
            <div className="customer-cell"><span>{String(u.name||u.email).split(" ").map((x:string)=>x[0]).join("").slice(0,2).toUpperCase()}</span><div><b>{u.name||"Staff"}</b><small>{u.email}</small></div></div>
            <div className="field-grid">
              <label className="field"><span>Name</span><input name="name" defaultValue={u.name||""} required/></label>
              <label className="field"><span>Status</span><select name="status" defaultValue={u.status}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
              <label className="field"><span>Reset password</span><input name="password" type="password" minLength={10} placeholder="Leave blank to keep"/></label>
            </div>
            <div className="tag-list">{(roles?.items||[]).map((r:any)=><label className="tag" key={r.id}><input type="checkbox" name="roleIds" value={r.id} defaultChecked={assigned.has(r.id)}/> {r.name}</label>)}</div>
            <small>Last seen: {u.last_seen_at?new Date(u.last_seen_at).toLocaleString("en-PK"):"Never"}</small>
            <div className="page-actions"><button className="secondary-button">Save access</button></div>
          </section>
        </form>;
      })}
      {!(users?.items||[]).length&&<article className="panel empty-panel"><div><h2>No staff accounts yet</h2><p>Create the first account above, then sign in through /login.</p></div></article>}
    </section>
  </>;
}