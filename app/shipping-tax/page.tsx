import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {createShippingZoneAction,createTaxRuleAction} from "@/app/commerce/actions";

export default async function ShippingTax(){
  const [shipping,taxes]=await Promise.all([
    adminRequest<any>("/v1/admin/commerce/shipping",0),
    adminRequest<any>("/v1/admin/commerce/taxes",0),
  ]);
  return <>
    <PageHeader eyebrow="CHECKOUT RULES" title="Shipping & Tax" description="Country/region/city shipping zones, order/weight thresholds, courier metadata and inclusive/exclusive tax rules."/>
    <section className="dashboard-grid">
      <form action={createShippingZoneAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Shipping zone & rate</h2>
          <div className="field-grid">
            <label className="field"><span>Zone name</span><input name="name" required placeholder="Pakistan major cities"/></label>
            <label className="field"><span>Countries</span><input name="countries" defaultValue="Pakistan"/></label>
            <label className="field"><span>Regions</span><input name="regions" placeholder="Punjab, Sindh"/></label>
            <label className="field"><span>Cities</span><input name="cities" placeholder="Lahore, Karachi"/></label>
            <label className="field"><span>Rate name</span><input name="rateName" defaultValue="Standard"/></label>
            <label className="field"><span>Rate type</span><select name="rateType"><option value="flat">Flat</option><option value="free">Free</option><option value="order_value">Order value</option><option value="weight">Weight</option></select></label>
            <label className="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.01" defaultValue="0"/></label>
            <label className="field"><span>Minimum order</span><input name="minimumOrder" type="number" min="0"/></label>
            <label className="field"><span>Maximum order</span><input name="maximumOrder" type="number" min="0"/></label>
            <label className="field"><span>Minimum weight (g)</span><input name="minimumWeightGrams" type="number" min="0"/></label>
            <label className="field"><span>Maximum weight (g)</span><input name="maximumWeightGrams" type="number" min="0"/></label>
            <label className="field"><span>Courier</span><input name="courier" placeholder="TCS / DHL / Leopards"/></label>
            <label className="field"><span>Service code</span><input name="serviceCode" placeholder="OVERNIGHT"/></label>
          </div>
          <button className="primary-button">Add zone & rate</button>
        </section>
      </form>

      <form action={createTaxRuleAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Tax rule</h2>
          <div className="field-grid">
            <label className="field"><span>Name</span><input name="name" required placeholder="Regional sales tax"/></label>
            <label className="field"><span>Country</span><input name="country" defaultValue="Pakistan"/></label>
            <label className="field"><span>Region</span><input name="region" placeholder="Blank = country-wide"/></label>
            <label className="field"><span>Rate %</span><input name="ratePercent" type="number" step="0.01" min="0" max="100" required/></label>
            <label className="field"><span>Tax inclusive</span><input name="inclusive" type="checkbox"/></label>
            <label className="field"><span>Priority</span><input name="priority" type="number" defaultValue="0"/></label>
          </div>
          <p>Inclusive tax is reported separately and is not added twice to the payable total. Exclusive tax is added at checkout.</p>
          <button className="primary-button">Add tax rule</button>
        </section>
      </form>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><span>DELIVERY</span><h2>Zones</h2></div></div>
        <div className="activity-list">{(shipping?.items||[]).map((z:any)=><div className="activity-item" key={z.id}><span>•</span><div><b>{z.name}</b><p>{(z.cities||[]).join(", ")||"All configured regions"}</p><small>{(z.rates||[]).map((r:any)=>r.name+" · "+r.rate_type+" · Rs. "+Number(r.amount||0).toLocaleString("en-PK")+(r.courier?" · "+r.courier:"")).join(" | ")}</small></div></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span>TAX ENGINE</span><h2>Rules</h2></div></div>
        <div className="activity-list">{(taxes?.items||[]).map((x:any)=><div className="activity-item" key={x.id}><span>•</span><div><b>{x.name}</b><p>{(Number(x.rate)*100).toFixed(2)}% · {x.inclusive?"inclusive":"exclusive"} · {x.country||"Any country"}{x.region?" / "+x.region:""}</p></div><em>{x.active?"ACTIVE":"OFF"}</em></div>)}</div>
      </article>
    </section>
  </>;
}
