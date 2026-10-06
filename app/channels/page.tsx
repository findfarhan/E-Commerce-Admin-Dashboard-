import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";

export default async function Channels(){
  const response=await adminRequest<{items:any[]}>("/v1/admin/operations/channels",0);
  const channels=response?.items||[];
  return <>
    <PageHeader eyebrow="MULTICHANNEL / REAL STATE" title="Channel Hub" description="Canonical catalog stays central. External channels show connected only when credentials and a real sync exist."/>
    <section className="channel-hub-grid">
      {channels.map(channel=><article className="channel-publish-card" key={channel.id}>
        <div className="channel-publish-head">
          <div><span>{String(channel.channel_type).toUpperCase()}</span><b>{channel.name}</b></div>
          <StatusPill tone={channel.status==="connected"?"success":"neutral"}>{channel.status.replaceAll("_"," ")}</StatusPill>
        </div>
        <p>{channel.channel_key==="storefront"?"Primary Vercel storefront connected to the Render commerce API.":"Provider credentials have not been connected yet."}</p>
        <div className="channel-publish-meta"><small>{Number(channel.publication_count||0)} publications</small><small>{channel.last_sync_at?new Date(channel.last_sync_at).toLocaleString("en-PK"):"Never synced"}</small></div>
        <div className="tag-list">{(channel.settings?.capabilities||[]).map((cap:string)=><span className="tag" key={cap}>{cap}</span>)}</div>
      </article>)}
    </section>
  </>;
}
