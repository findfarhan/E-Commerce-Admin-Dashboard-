import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {updateCommissionStatusAction} from "./actions";

export default async function CommissionsPage(){
  const response=await adminRequest<{items:any[]}>("/v1/admin/engagement/commissions",0);
  const items=response?.items||[];

  return <>
    <PageHeader eyebrow="PRIVATE LAB / CRM" title="Commission requests" description="One-of-one jewelry inquiries captured directly from the storefront."/>
    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>CLIENT</th><th>SIGNAL</th><th>MATERIAL / BUDGET</th><th>REQUEST</th><th>STATUS</th></tr></thead>
        <tbody>
          {items.map((item:any)=>{
            const action=updateCommissionStatusAction.bind(null,item.id);
            return <tr key={item.id}>
              <td><b>{item.name}</b><small>{item.email}<br/>{item.phone||"No phone"}</small></td>
              <td>{item.signal||"Open brief"}<small>{item.timeline||"No timeline"}</small></td>
              <td>{item.preferred_material||"Open"}<small>{item.budget_range||"Budget not specified"}</small></td>
              <td style={{maxWidth:360}}>{item.notes}</td>
              <td>
                <form action={action} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <select name="status" defaultValue={item.status}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="won">Won</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button className="secondary-button" type="submit">Save</button>
                </form>
              </td>
            </tr>;
          })}
          {!items.length&&<tr><td colSpan={5}>No commission requests yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
