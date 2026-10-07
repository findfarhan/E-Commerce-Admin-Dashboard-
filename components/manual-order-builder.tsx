"use client";
import {useMemo,useState} from "react";
import {createManualOrderAction} from "@/app/commerce/actions";

type Variant={variant_id:string;product_id?:string;title:string;sku:string;price:number;inventory:number;selected_options?:Record<string,string>};
type Location={id:string;name:string};

export function ManualOrderBuilder({variants,locations}:{variants:Variant[];locations:Location[]}){
  const [query,setQuery]=useState("");
  const [lines,setLines]=useState<Array<{v:Variant;qty:number;price:string}>>([]);
  const [shipping,setShipping]=useState("0");
  const [tax,setTax]=useState("");
  const filtered=useMemo(()=>query.trim()?variants.filter(v=>(v.title+" "+v.sku+" "+Object.values(v.selected_options||{}).join(" ")).toLowerCase().includes(query.toLowerCase())).slice(0,8):[],[query,variants]);
  const subtotal=lines.reduce((s,l)=>s+(l.price!==""?Number(l.price):Number(l.v.price))*l.qty,0);
  const total=subtotal+Number(shipping||0)+Number(tax||0);
  const add=(v:Variant)=>{if(!lines.some(l=>l.v.variant_id===v.variant_id))setLines(x=>[...x,{v,qty:1,price:""}]);setQuery("");};
  return <form action={createManualOrderAction} className="shopify-form-shell">
    <div className="shopify-form-main">
      <section className="shop-card">
        <div className="shop-card-head"><div><h2>Products</h2><p>Search your catalog and add items to this order.</p></div></div>
        <div className="order-product-search">
          <span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products or SKU"/>
          {filtered.length>0&&<div className="order-picker-menu">{filtered.map(v=><button type="button" key={v.variant_id} onClick={()=>add(v)}><span><b>{v.title}</b><small>{v.sku} · {Object.values(v.selected_options||{}).join(" / ")||"Default variant"}</small></span><em>Rs. {Number(v.price).toLocaleString("en-PK")} · {v.inventory} in stock</em></button>)}</div>}
        </div>
        <div className="order-lines">
          {lines.map((l,i)=><div className="order-line" key={l.v.variant_id}>
            <input type="hidden" name={"variantId_"+i} value={l.v.variant_id}/>
            <div className="order-line-thumb">◇</div>
            <div className="order-line-copy"><b>{l.v.title}</b><small>{l.v.sku} · {Object.values(l.v.selected_options||{}).join(" / ")||"Default variant"}</small></div>
            <label><span>Qty</span><input name={"quantity_"+i} type="number" min="1" value={l.qty} onChange={e=>setLines(x=>x.map((r,idx)=>idx===i?{...r,qty:Math.max(1,Number(e.target.value)||1)}:r))}/></label>
            <label><span>Price</span><input name={"unitPrice_"+i} type="number" min="0" placeholder={String(l.v.price)} value={l.price} onChange={e=>setLines(x=>x.map((r,idx)=>idx===i?{...r,price:e.target.value}:r))}/></label>
            <strong>Rs. {((l.price!==""?Number(l.price):Number(l.v.price))*l.qty).toLocaleString("en-PK")}</strong>
            <button type="button" className="icon-danger" onClick={()=>setLines(x=>x.filter((_,idx)=>idx!==i))}>×</button>
          </div>)}
          {!lines.length&&<div className="shop-empty-state"><b>No products added</b><span>Search above to add products to the order.</span></div>}
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><div><h2>Notes</h2><p>Internal context for fulfillment or customer support.</p></div></div>
        <textarea className="shop-textarea" name="notes" rows={4} placeholder="Add a note about this order"/>
      </section>
    </div>

    <aside className="shopify-form-side">
      <section className="shop-card">
        <div className="shop-card-head"><h2>Customer</h2></div>
        <div className="shop-field-stack">
          <label><span>Name</span><input name="customerName" required placeholder="Customer name"/></label>
          <label><span>Email</span><input name="customerEmail" type="email" required placeholder="name@example.com"/></label>
          <label><span>Phone</span><input name="customerPhone" required placeholder="+92..."/></label>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><h2>Delivery</h2></div>
        <div className="shop-field-stack">
          <label><span>Fulfillment location</span><select name="locationId"><option value="">Global stock</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label><span>Address</span><input name="shipping_line1" required placeholder="Street address"/></label>
          <div className="shop-2col"><label><span>City</span><input name="shipping_city" required/></label><label><span>Region</span><input name="shipping_region"/></label></div>
          <label><span>Country</span><input name="shipping_country" defaultValue="Pakistan"/></label>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><h2>Payment</h2></div>
        <div className="shop-field-stack">
          <label><span>Discount code</span><input name="discountCode" placeholder="Optional"/></label>
          <div className="shop-2col"><label><span>Shipping</span><input name="shippingAmount" type="number" min="0" value={shipping} onChange={e=>setShipping(e.target.value)}/></label><label><span>Tax</span><input name="taxAmount" type="number" min="0" value={tax} onChange={e=>setTax(e.target.value)} placeholder="Auto"/></label></div>
          <div className="shop-2col"><label><span>Method</span><select name="paymentMethod"><option value="cod">Cash on delivery</option><option value="manual">Manual payment</option></select></label><label><span>Status</span><select name="paymentStatus"><option value="pending">Payment pending</option><option value="paid">Paid</option></select></label></div>
          <label><span>Paid amount</span><input name="paidAmount" type="number" min="0" defaultValue="0"/></label>
        </div>
      </section>

      <section className="shop-card sticky-summary">
        <div className="shop-card-head"><h2>Order summary</h2></div>
        <div className="order-summary-row"><span>Subtotal</span><b>Rs. {subtotal.toLocaleString("en-PK")}</b></div>
        <div className="order-summary-row"><span>Shipping</span><b>Rs. {Number(shipping||0).toLocaleString("en-PK")}</b></div>
        <div className="order-summary-row"><span>Tax</span><b>{tax===""?"Calculated on submit":"Rs. "+Number(tax).toLocaleString("en-PK")}</b></div>
        <div className="order-summary-row total"><span>Total</span><b>Rs. {total.toLocaleString("en-PK")}</b></div>
        <button className="primary-button wide-button" type="submit" disabled={!lines.length}>Create order</button>
      </section>
    </aside>
  </form>;
}
