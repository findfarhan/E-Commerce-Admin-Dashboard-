"use client";
import {useMemo,useState} from "react";

type CatalogItem={variant_id:string;product_id:string;title:string;sku:string;price:number|string;inventory:number|string;selected_options?:Record<string,string>};
type Customer={id:string;name?:string;email?:string;phone?:string};
type Location={id:string;name:string;code:string};
type ShippingRate={id:string;zone_id:string;name:string;carrier?:string|null;amount:number|string};

export function OrderBuilder({
  action,mode,catalog,customers,locations,shippingRates,
}:{action:(formData:FormData)=>void|Promise<void>;mode:"manual"|"draft";catalog:CatalogItem[];customers:Customer[];locations:Location[];shippingRates:ShippingRate[]}){
  const [lines,setLines]=useState<Array<{variantId:string;quantity:number;unitPrice:number}>>([{variantId:"",quantity:1,unitPrice:0}]);
  const selected=useMemo(()=>new Map(catalog.map(item=>[item.variant_id,item])),[catalog]);
  const itemsJson=JSON.stringify(lines.filter(line=>line.variantId).map(line=>({variantId:line.variantId,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice)})));
  const subtotal=lines.reduce((sum,line)=>sum+Number(line.quantity||0)*Number(line.unitPrice||0),0);

  function choose(index:number,variantId:string){
    const item=selected.get(variantId);
    setLines(current=>current.map((line,i)=>i===index?{...line,variantId,unitPrice:Number(item?.price||0)}:line));
  }

  return <form action={action} className="enterprise-grid two">
    <input type="hidden" name="itemsJson" value={itemsJson}/>
    <article className="panel enterprise-card">
      <h3>{mode==="manual"?"Order items":"Quote items"}</h3>
      <p>Select variants, quantities and optional negotiated prices.</p>
      <div style={{display:"grid",gap:12,marginTop:16}}>
        {lines.map((line,index)=><div className="field-grid" key={index}>
          <label className="field" style={{gridColumn:"span 2"}}><span>Variant</span>
            <select value={line.variantId} onChange={e=>choose(index,e.target.value)} required>
              <option value="">Select product / variant</option>
              {catalog.map(item=><option key={item.variant_id} value={item.variant_id} disabled={Number(item.inventory)<=0}>{item.title} · {item.sku} · Rs. {Number(item.price).toLocaleString("en-PK")} · {item.inventory} stock</option>)}
            </select>
          </label>
          <label className="field"><span>Qty</span><input type="number" min="1" value={line.quantity} onChange={e=>setLines(current=>current.map((v,i)=>i===index?{...v,quantity:Number(e.target.value)}:v))}/></label>
          <label className="field"><span>Unit price</span><input type="number" min="0" value={line.unitPrice} onChange={e=>setLines(current=>current.map((v,i)=>i===index?{...v,unitPrice:Number(e.target.value)}:v))}/></label>
          <button type="button" className="secondary-button" onClick={()=>setLines(current=>current.length===1?current:current.filter((_,i)=>i!==index))}>Remove</button>
        </div>)}
        <button type="button" className="secondary-button" onClick={()=>setLines(current=>[...current,{variantId:"",quantity:1,unitPrice:0}])}>+ Add line</button>
        <div className="metric-row"><span>Line subtotal</span><b>Rs. {subtotal.toLocaleString("en-PK")}</b></div>
      </div>
    </article>

    <article className="panel enterprise-card">
      <h3>Customer & delivery</h3>
      <div className="field-grid" style={{marginTop:16}}>
        <label className="field" style={{gridColumn:"1 / -1"}}><span>Existing customer</span><select name="customerId" defaultValue=""><option value="">Create / guest customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name||"Customer"} · {c.email||c.phone||c.id}</option>)}</select></label>
        <label className="field"><span>Name</span><input name="customerName"/></label>
        <label className="field"><span>Email</span><input name="customerEmail" type="email"/></label>
        <label className="field"><span>Phone</span><input name="customerPhone"/></label>
        <label className="field"><span>Address</span><input name="line1"/></label>
        <label className="field"><span>City</span><input name="city"/></label>
        <label className="field"><span>Region</span><input name="region"/></label>
        <label className="field"><span>Postal code</span><input name="postalCode"/></label>
        <label className="field"><span>Country</span><input name="country" defaultValue="Pakistan"/></label>
        <label className="field"><span>Discount code</span><input name="discountCode"/></label>
        <label className="field"><span>Shipping rate</span><select name="shippingRateId" defaultValue=""><option value="">Automatic</option>{shippingRates.map(rate=><option key={rate.id} value={rate.id}>{rate.name} · Rs. {Number(rate.amount).toLocaleString("en-PK")}{rate.carrier?" · "+rate.carrier:""}</option>)}</select></label>
        <label className="field" style={{gridColumn:"1 / -1"}}><span>Price override reason</span><input name="priceOverrideReason" placeholder="Required only if a line price differs from catalog"/></label>
        <label className="field" style={{gridColumn:"1 / -1"}}><span>Internal notes</span><textarea name="notes" rows={3}/></label>
        {mode==="manual"?<>
          <label className="field"><span>Fulfillment location</span><select name="locationId" defaultValue=""><option value="">Default location</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name} · {l.code}</option>)}</select></label>
          <label className="field"><span>Payment status</span><select name="paymentStatus" defaultValue="pending"><option value="pending">Pending</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></label>
          <label className="field"><span>Payment method</span><select name="paymentMethod" defaultValue="cod"><option value="cod">COD</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="manual">Manual</option></select></label>
          <label className="field"><span>Amount received</span><input name="paymentAmount" type="number" min="0" defaultValue="0"/></label>
        </>:<label className="field"><span>Quote expires</span><input name="expiresAt" type="datetime-local"/></label>}
      </div>
      <div className="page-actions" style={{marginTop:18}}><button className="primary-button" type="submit">{mode==="manual"?"Create order":"Save draft quote"}</button></div>
    </article>
  </form>;
}
