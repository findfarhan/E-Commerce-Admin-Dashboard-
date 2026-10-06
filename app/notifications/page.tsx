import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {markNotificationAction} from "@/app/enterprise-actions";
export default async function NotificationsPage(){
 const data=await adminRequest<any>("/v1/admin/notifications",0);const items=data?.items||[];
 return <><PageHeader eyebrow="OPERATIONS / ALERTS" title="Notifications" description="New orders, returns, inventory and operational events generated from real commerce state."/>
 <div className="panel"><div className="activity-list">{items.map((n:any)=><div className="activity-item" key={n.id}><span>•</span><div><b>{n.title}</b><p>{n.body||n.notification_type}</p><small>{new Date(n.created_at).toLocaleString("en-PK")}</small></div><div style={{display:"flex",gap:8,alignItems:"center"}}><StatusPill tone={n.severity==="critical"?"danger":n.severity==="warning"?"warning":n.severity==="success"?"success":"info"}>{n.status}</StatusPill>{n.status==="unread"&&<form action={markNotificationAction.bind(null,n.id)}><button className="secondary-button" type="submit">Read</button></form>}</div></div>)}{!items.length&&<div className="activity-item"><span>•</span><div><b>No notifications</b><p>Operational alerts will appear here.</p></div></div>}</div></div></>;
}
