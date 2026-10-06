import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
export default async function AuditPage(){
 const data=await adminRequest<any>("/v1/admin/audit-logs?limit=500",0);const items=data?.items||[];
 return <><PageHeader eyebrow="GOVERNANCE / IMMUTABLE EVENTS" title="Audit log" description="Admin and system changes with actor, resource, timestamps and before/after metadata."/>
 <div className="panel table-wrap"><table className="data-table"><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>RESOURCE</th><th>DETAIL</th></tr></thead><tbody>{items.map((e:any)=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString("en-PK")}</td><td><b>{e.actor}</b><small>{e.actor_type}</small></td><td>{e.action}</td><td>{e.resource_type}<small>{e.resource_id||"—"}</small></td><td><small>{JSON.stringify(e.metadata||{}).slice(0,160)}</small></td></tr>)}{!items.length&&<tr><td colSpan={5}>Audit events will appear as enterprise operations are performed.</td></tr>}</tbody></table></div></>;
}
