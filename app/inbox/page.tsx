import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";

export default async function Inbox(){
  const data=await adminRequest<any>("/v1/admin/operations/inbox",0);
  if(!data) throw new Error("Inbox data unavailable.");
  const commissions=data.commissions||[];
  const conversations=data.conversations||[];
  const connectors=data.externalConnectors||{};

  return <>
    <PageHeader eyebrow="CRM / LIVE INBOX" title="Inbox" description="Real website and CRM activity only. Email, Instagram and WhatsApp are not represented as connected until their providers are configured."/>
    <section className="stats-grid">
      <article className="stat-card"><span>WEBSITE COMMISSIONS</span><strong>{commissions.length}</strong><small>Captured bespoke requests</small></article>
      <article className="stat-card"><span>CRM CONVERSATIONS</span><strong>{conversations.length}</strong><small>Persisted conversation records</small></article>
      <article className="stat-card"><span>EMAIL</span><strong>{connectors.email?"ON":"OFF"}</strong><small>{connectors.email?"Provider configured":"Not connected"}</small></article>
      <article className="stat-card"><span>SOCIAL / WHATSAPP</span><strong>{connectors.instagram||connectors.whatsapp?"PARTIAL":"OFF"}</strong><small>No fake external threads</small></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>COMMISSION INBOX</span><h2>Private-lab requests</h2></div><Link href="/commissions">Manage pipeline</Link></div>
        <div className="activity-list">
          {commissions.slice(0,20).map((item:any)=><div className="activity-item" key={item.id}><span>•</span><div><b>{item.name}</b><p>{item.notes}</p><small>{item.email} · {item.phone||"no phone"}</small></div><StatusPill tone={item.status==="new"?"warning":"neutral"}>{item.status}</StatusPill></div>)}
          {!commissions.length&&<div className="activity-item"><span>•</span><div><b>No website leads yet</b><p>New bespoke requests will appear here.</p></div></div>}
        </div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span>PERSISTED THREADS</span><h2>CRM records</h2></div></div>
        <div className="activity-list">
          {conversations.slice(0,20).map((item:any)=><div className="activity-item" key={item.id}><span>•</span><div><b>{item.subject||item.customer_name||"Conversation"}</b><p>{item.channel} · {item.customer_email||"No customer email"}</p></div><StatusPill tone="neutral">{item.status}</StatusPill></div>)}
          {!conversations.length&&<div className="activity-item"><span>•</span><div><b>No external conversations</b><p>Email / Meta / WhatsApp connectors are intentionally not fabricated.</p></div></div>}
        </div>
      </article>
    </section>
  </>;
}
