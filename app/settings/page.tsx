import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {updateStoreSettingsAction} from "./actions";

export default async function Settings(){
  const data=await adminRequest<any>("/v1/admin/operations/settings",0);
  if(!data) throw new Error("Settings unavailable.");
  const store=data.store;
  const infra=data.infrastructure;
  const integrations=[
    ["Render API",infra.api],
    ["Supabase PostgreSQL",infra.database],
    ["Media / Cloudflare",infra.media],
    ["Payment",infra.payment],
    ["Email",infra.email],
    ["Meta / Instagram",infra.meta],
    ["WhatsApp",infra.whatsapp],
  ];
  return <>
    <PageHeader eyebrow="SYSTEM / LIVE" title="Settings" description="Canonical store identity is stored in PostgreSQL. Provider secrets remain in Render/Vercel environment variables."/>
    <section className="dashboard-grid">
      <form action={updateStoreSettingsAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Store identity</h2>
          <div className="field-grid">
            <label className="field"><span>Store name</span><input name="name" required defaultValue={store.name}/></label>
            <label className="field"><span>Currency</span><input name="currency" required maxLength={3} defaultValue={store.currency}/></label>
            <label className="field"><span>Timezone</span><input name="timezone" required defaultValue={store.timezone}/></label>
            <label className="field"><span>Storefront domain</span><input readOnly value={store.domain}/></label>
          </div>
          <button className="primary-button" type="submit">Save store settings</button>
        </section>
      </form>
      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Infrastructure state</h2>
          <p>External services are never shown as connected until credentials exist.</p>
          <div className="integration-list">{integrations.map(([name,status])=><div className="integration-item" key={name}><span>◇</span><div><b>{name}</b><p>{String(status).replaceAll("_"," ")}</p></div><StatusPill tone={["live","configured","cod"].includes(String(status))?"success":"neutral"}>{String(status).replaceAll("_"," ")}</StatusPill></div>)}</div>
        </section>
      </article>
    </section>
  </>;
}
