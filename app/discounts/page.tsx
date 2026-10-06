import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {createDiscountAction} from "@/app/enterprise-actions";

export default async function DiscountsPage(){
  const data=await adminRequest<any>("/v1/admin/discounts",0);
  const items=data?.items||[];
  return <>
    <PageHeader eyebrow="PRICING / PROMOTIONS" title="Discounts" description="Code and automatic discounts with eligibility windows, order minimums, targeting and usage limits."/>
    <section className="dashboard-grid">
      <article className="panel enterprise-card"><h3>Create discount</h3><form action={createDiscountAction} className="field-grid" style={{marginTop:16}}>
        <label className="field"><span>Name</span><input name="name" required/></label><label className="field"><span>Code</span><input name="code" placeholder="Optional for automatic"/></label>
        <label className="field"><span>Type</span><select name="discountType" defaultValue="percentage"><option value="percentage">Percentage</option><option value="fixed_amount">Fixed amount</option><option value="automatic">Automatic</option></select></label>
        <label className="field"><span>Value</span><input name="value" type="number" min="0" step=".01" required/></label>
        <label className="field"><span>Minimum subtotal</span><input name="minimumSubtotal" type="number" min="0" defaultValue="0"/></label><label className="field"><span>Usage limit</span><input name="usageLimit" type="number" min="1"/></label>
        <label className="field"><span>Starts</span><input name="startsAt" type="datetime-local"/></label><label className="field"><span>Ends</span><input name="endsAt" type="datetime-local"/></label>
        <label className="field"><span>Target</span><select name="targetType" defaultValue="order"><option value="order">Whole order</option><option value="product">Products</option><option value="collection">Collections</option></select></label>
        <label className="field"><span>Target IDs</span><input name="targetIds" placeholder="Comma-separated UUIDs"/></label>
        <button className="primary-button" type="submit">Create discount</button>
      </form></article>
      <article className="panel"><div className="panel-head"><div><span>ACTIVE RULES</span><h2>{items.length} discount definitions</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>DISCOUNT</th><th>TYPE</th><th>VALUE</th><th>USAGE</th><th>WINDOW</th><th>STATE</th></tr></thead><tbody>
        {items.map((d:any)=><tr key={d.id}><td><b>{d.name}</b><small>{d.code||"Automatic"}</small></td><td>{d.discount_type}</td><td>{d.discount_type==="percentage"?Number(d.value)+"%":"Rs. "+Number(d.value).toLocaleString("en-PK")}</td><td>{d.usage_count}{d.usage_limit?"/"+d.usage_limit:""}</td><td><small>{d.starts_at?new Date(d.starts_at).toLocaleString("en-PK"):"Now"} → {d.ends_at?new Date(d.ends_at).toLocaleString("en-PK"):"No expiry"}</small></td><td><StatusPill tone={d.active?"success":"neutral"}>{d.active?"active":"off"}</StatusPill></td></tr>)}
        {!items.length&&<tr><td colSpan={6}>No discounts configured.</td></tr>}
      </tbody></table></div></article>
    </section>
  </>;
}
