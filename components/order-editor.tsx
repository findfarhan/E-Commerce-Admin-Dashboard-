"use client";
import {useMemo,useState} from "react";
type Catalog={variant_id:string;title:string;sku:string;price:number|string;inventory:number|string};
type Line={variant_id?:string|null;quantity:number|string;unit_price:number|string;title:string;sku:string};
export function OrderEditor({action,catalog,initialItems,locations,shippingRates,order}:{action:(formData:FormData)=>void|Promise<void>;catalog:Catalog[];initialItems:Line[];locations:any[];shippingRates:any[];order:any}){
 const byId=useMemo(()=>new Map(catalog.map(v=>[v.variant_id,v])),[catalog]);
 const [lines,setLines]=useState(initialItems.filter(i=>i.variant_id).map(i=>({variantId:String(i.variant_id),quantity:Number(i.quantity),unitPrice:Number(i.unit_price)})));
 const payload=JSON.stringify(lines.filter(l=>l.variantId).map(l=>({variantId:l.variantId,quantity:Number(l.quantity),unitPrice:Number(l.unitPrice)})));
 function choose(index:number,id:string){const v=byId.get(id);setLines(cur=>cur.map((l,i)=>i===index?{...l,variantId:id,unitPrice:Number(v?.price||0)}:l));}
 return <form action={action} className="panel settings-panel">
  <input type="hidden" name="itemsJson" value={payload}/>
  <section className="settings-section"><h2>Edit order contents</h2><p>Before fulfillment, line changes reconcile inventory at the selected location and recalculate discount, shipping and tax.</p>
   <div style={{display:"grid",gap:12,marginTop:14}}>{lines.map((line,index)=><div className="field-grid" key={index}><label className="field" style={{gridColumn:"span 2"}}><span>Variant</span><select value={line.variantId} onChange={ev=>choose(index,ev.target.value)}>{catalog.map(v=><option key={v.variant_id} value={v.variant_id}>{v.title} · {v.sku} · {v.inventory} stock</option>)}</select></label><label className="field"><span>Qty</span><input type="number" min="1" value={line.quantity} onChange={ev=>setLines(cur=>cur.map((l,i)=>i===index?{...l,quantity:Number(ev.target.value)}:l))}/></label><label className="field"><span>Unit price</span><input type="number" min="0" value={line.unitPrice} onChange={ev=>setLines(cur=>cur.map((l,i)=>i===index?{...l,unitPrice:Number(ev.target.value)}:l))}/></label><button type="button" className="secondary-button" onClick={()=>setLines(cur=>cur.filter((_,i)=>i!==index))}>Remove</button></div>)}</div>
   <button type="button" className="secondary-button" style={{marginTop:12}} onClick={()=>setLines(cur=>[...cur,{variantId:catalog[0]?.variant_id||"",quantity:1,unitPrice:Number(catalog[0]?.price||0)}])}>+ Add product</button>
  </section>
  <section className="settings-section"><h2>Pricing & delivery</h2><div className="field-grid">
   <label className="field"><span>Discount code</span><input name="discountCode" defaultValue={order.discount_code||""}/></label>
   <label className="field"><span>Shipping rate</span><select name="shippingRateId"><option value="">Automatic</option>{shippingRates.map((r:any)=><option key={r.id} value={r.id}>{r.name} · Rs. {Number(r.amount).toLocaleString("en-PK")}</option>)}</select></label>
   <label className="field"><span>Location</span><select name="locationId" defaultValue={order.location_id||""}><option value="">Default</option>{locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
   <label className="field"><span>Address</span><input name="line1" defaultValue={order.shipping_address?.line1||""}/></label><label className="field"><span>Address 2</span><input name="line2" defaultValue={order.shipping_address?.line2||""}/></label>
   <label className="field"><span>City</span><input name="city" defaultValue={order.shipping_address?.city||""}/></label><label className="field"><span>Region</span><input name="region" defaultValue={order.shipping_address?.region||""}/></label><label className="field"><span>Postal code</span><input name="postalCode" defaultValue={order.shipping_address?.postalCode||order.shipping_address?.postal_code||""}/></label><label className="field"><span>Country</span><input name="country" defaultValue={order.shipping_address?.country||"Pakistan"}/></label>
   <label className="field" style={{gridColumn:"1 / -1"}}><span>Notes</span><textarea name="notes" rows={3} defaultValue={order.notes||""}/></label>
  </div><button className="primary-button" type="submit">Reprice & save order</button></section>
 </form>;
}
