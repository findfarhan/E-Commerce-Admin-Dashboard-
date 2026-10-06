import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";

export default async function Storefront(){
  const data=await adminRequest<any>("/v1/admin/operations/storefront",0);
  if(!data) throw new Error("Storefront status unavailable.");
  return <>
    <PageHeader eyebrow="HEADLESS CHANNEL / LIVE" title="Storefront API" description="The Vercel theme consumes the same Render commerce contract used by the Admin and Supabase-backed catalog."/>
    <section className="channel-hero">
      <article className="panel channel-card">
        <div className="channel-card-head"><div><span>ONLINE STORE</span><h2>Jewelry Store</h2><p>{data.products} products · {data.collections} collections</p></div><StatusPill tone="success">{data.status}</StatusPill></div>
        <div className="channel-url"><code>{data.url}</code><span>PRIMARY</span></div>
        <div className="channel-contract-grid">
          <div className="channel-contract"><span>CATALOG</span><b>Supabase</b><small>Canonical products / variants / inventory</small></div>
          <div className="channel-contract"><span>API</span><b>Render</b><small>{data.apiBase}</small></div>
          <div className="channel-contract"><span>MEDIA</span><b>{data.mediaProvider}</b><small>Cloudflare remains deferred</small></div>
        </div>
      </article>
      <article className="panel headless-rule"><span>DESIGN INDEPENDENCE</span><h3>Theme stays replaceable</h3><p>Backend returns semantic commerce data. The storefront owns typography, layout and interaction without duplicating catalog truth.</p></article>
    </section>
    <article className="panel">
      <div className="panel-head"><div><span>PUBLIC CONTRACT</span><h2>Actual Storefront endpoints</h2></div></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>METHOD</th><th>ENDPOINT</th><th>PURPOSE</th></tr></thead><tbody>{(data.endpoints||[]).map((row:any[])=><tr key={row[1]}><td>{row[0]}</td><td><code>{row[1]}</code></td><td>{row[2]}</td></tr>)}</tbody></table></div>
    </article>
  </>;
}
