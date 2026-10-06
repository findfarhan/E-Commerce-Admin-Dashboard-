import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";

export default async function AudiencePage(){
  const response=await adminRequest<{items:any[]}>("/v1/admin/engagement/subscribers",0);
  const items=response?.items||[];
  return <>
    <PageHeader eyebrow="AUDIENCE" title="Private frequency" description="Storefront newsletter subscribers captured without an external email provider."/>
    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>EMAIL</th><th>STATUS</th><th>SOURCE</th><th>JOINED</th></tr></thead>
        <tbody>
          {items.map((item:any)=><tr key={item.id}>
            <td><b>{item.email}</b></td>
            <td><span className={"status-pill "+(item.status==="subscribed"?"success":"neutral")}>{item.status}</span></td>
            <td>{item.source}</td>
            <td>{new Date(item.created_at).toLocaleString("en-PK")}</td>
          </tr>)}
          {!items.length&&<tr><td colSpan={4}>No subscribers yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
