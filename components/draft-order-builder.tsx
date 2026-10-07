"use client";

import {useMemo,useState} from "react";
import {submitDraftOrderBuilderAction} from "@/app/commerce/actions";

type Variant={variant_id:string;product_id?:string;title:string;sku:string;price:number;inventory:number;selected_options?:Record<string,string>};
type Customer={id:string;name:string;email:string;orders:number;lifetimeValue:number};
type Location={id:string;name:string};
type Line={v:Variant;qty:number;price:string};

export function DraftOrderBuilder({variants,customers,locations}:{variants:Variant[];customers:Customer[];locations:Location[]}){
  const [productModal,setProductModal]=useState(false);
  const [customerModal,setCustomerModal]=useState(false);
  const [productQuery,setProductQuery]=useState("");
  const [customerQuery,setCustomerQuery]=useState("");
  const [lines,setLines]=useState<Line[]>([]);
  const [selectedCustomer,setSelectedCustomer]=useState<Customer|null>(null);
  const [newCustomer,setNewCustomer]=useState(false);
  const [discountType,setDiscountType]=useState<"fixed"|"percent">("fixed");
  const [discountValue,setDiscountValue]=useState("0");
  const [shipping,setShipping]=useState("0");

  const filteredVariants=useMemo(()=>{
    const q=productQuery.trim().toLowerCase();
    if(!q) return variants.slice(0,24);
    return variants.filter(v=>(v.title+" "+v.sku+" "+Object.values(v.selected_options||{}).join(" ")).toLowerCase().includes(q)).slice(0,40);
  },[variants,productQuery]);

  const filteredCustomers=useMemo(()=>{
    const q=customerQuery.trim().toLowerCase();
    if(!q) return customers.slice(0,24);
    return customers.filter(c=>(c.name+" "+c.email).toLowerCase().includes(q)).slice(0,40);
  },[customers,customerQuery]);

  const subtotal=lines.reduce((sum,line)=>sum+(line.price!==""?Number(line.price):Number(line.v.price))*line.qty,0);
  const discountAmount=discountType==="percent"?Math.min(subtotal,subtotal*Math.max(0,Number(discountValue||0))/100):Math.min(subtotal,Math.max(0,Number(discountValue||0)));
  const estimatedTotal=Math.max(0,subtotal-discountAmount+Number(shipping||0));

  const addVariant=(variant:Variant)=>{
    setLines(current=>{
      const exists=current.find(line=>line.v.variant_id===variant.variant_id);
      return exists?current.map(line=>line.v.variant_id===variant.variant_id?{...line,qty:line.qty+1}:line):[...current,{v:variant,qty:1,price:""}];
    });
  };

  return <>
    <form action={submitDraftOrderBuilderAction} className="draft-builder">
      <div className="draft-builder-main">
        <section className="shop-card">
          <div className="draft-card-title">
            <div><h2>Products</h2><p>Add products and adjust quantities or custom prices.</p></div>
            <button type="button" className="secondary-button" onClick={()=>setProductModal(true)}>Browse products</button>
          </div>
          <button type="button" className="draft-product-search" onClick={()=>setProductModal(true)}><span>⌕</span><span>Search products</span></button>

          <div className="draft-line-list">
            {lines.map((line,index)=>{
              const unit=line.price!==""?Number(line.price):Number(line.v.price);
              return <div className="draft-line" key={line.v.variant_id}>
                <input type="hidden" name={"variantId_"+index} value={line.v.variant_id}/>
                <div className="draft-product-thumb">◇</div>
                <div className="draft-line-copy"><b>{line.v.title}</b><small>{Object.values(line.v.selected_options||{}).join(" / ")||"Default variant"} · {line.v.sku}</small><em>{line.v.inventory} available</em></div>
                <label><span>Quantity</span><input name={"quantity_"+index} type="number" min="1" value={line.qty} onChange={e=>setLines(current=>current.map((row,i)=>i===index?{...row,qty:Math.max(1,Number(e.target.value)||1)}:row))}/></label>
                <label><span>Price</span><div className="draft-money-input"><i>Rs.</i><input name={"unitPrice_"+index} type="number" min="0" placeholder={String(line.v.price)} value={line.price} onChange={e=>setLines(current=>current.map((row,i)=>i===index?{...row,price:e.target.value}:row))}/></div></label>
                <div className="draft-line-total">Rs. {(unit*line.qty).toLocaleString("en-PK")}</div>
                <button type="button" className="draft-remove" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}>×</button>
              </div>;
            })}
            {!lines.length&&<div className="draft-empty"><div>◇</div><b>Add products to build this order</b><span>Browse your catalog and select one or more variants.</span></div>}
          </div>
        </section>

        <section className="shop-card">
          <div className="draft-card-title"><div><h2>Payment</h2><p>Apply discount, shipping and tax handling.</p></div></div>
          <div className="draft-payment-list">
            <div className="draft-payment-row"><div><b>Subtotal</b><span>{lines.length} line item{lines.length===1?"":"s"}</span></div><strong>Rs. {subtotal.toLocaleString("en-PK")}</strong></div>
            <div className="draft-payment-row editable"><div><b>Discount</b><span>Optional order-level discount</span></div><div className="draft-discount-control"><select value={discountType} onChange={e=>setDiscountType(e.target.value as "fixed"|"percent")}><option value="fixed">Rs.</option><option value="percent">%</option></select><input type="number" min="0" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></div></div>
            <div className="draft-payment-row editable"><div><b>Shipping</b><span>Manual shipping charge</span></div><div className="draft-money-input compact"><i>Rs.</i><input name="shippingAmount" type="number" min="0" value={shipping} onChange={e=>setShipping(e.target.value)}/></div></div>
            <div className="draft-payment-row editable"><div><b>Tax</b><span>Blank uses configured tax rules</span></div><div className="draft-money-input compact"><i>Rs.</i><input name="taxAmount" type="number" min="0" placeholder="Auto"/></div></div>
            <input type="hidden" name="discountAmount" value={discountAmount}/>
            <div className="draft-payment-row total"><div><b>Estimated total</b><span>Tax rules may update the final amount</span></div><strong>Rs. {estimatedTotal.toLocaleString("en-PK")}</strong></div>
          </div>
        </section>

        <section className="shop-card">
          <div className="draft-card-title"><div><h2>Notes</h2><p>Only staff can see these notes.</p></div></div>
          <textarea name="notes" rows={4} placeholder="Add an internal note"/>
        </section>
      </div>

      <aside className="draft-builder-side">
        <section className="shop-card">
          <div className="draft-card-title"><h2>Customer</h2>{(selectedCustomer||newCustomer)&&<button type="button" className="text-button" onClick={()=>{setSelectedCustomer(null);setNewCustomer(false);}}>Remove</button>}</div>
          {!selectedCustomer&&!newCustomer&&<button type="button" className="draft-select-customer" onClick={()=>setCustomerModal(true)}><span>⌕</span><span>Search or create customer</span></button>}
          {selectedCustomer&&<div className="selected-customer-card"><div className="selected-customer-avatar">{selectedCustomer.name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div><div><b>{selectedCustomer.name}</b><span>{selectedCustomer.email}</span><small>{selectedCustomer.orders} orders · Rs. {selectedCustomer.lifetimeValue.toLocaleString("en-PK")} LTV</small></div></div>}
          {newCustomer&&<div className="shop-field-stack"><label><span>Name</span><input name="customerName" required placeholder="Customer name"/></label><label><span>Email</span><input name="email" type="email" required placeholder="name@example.com"/></label><label><span>Phone</span><input name="phone" placeholder="+92..."/></label></div>}
          <input type="hidden" name="customerId" value={selectedCustomer?.id||""}/>
          {!newCustomer&&<input type="hidden" name="email" value={selectedCustomer?.email||""}/>}
          {!newCustomer&&<input type="hidden" name="customerName" value={selectedCustomer?.name||""}/>}
        </section>

        <section className="shop-card">
          <div className="draft-card-title"><h2>Shipping address</h2></div>
          <div className="shop-field-stack">
            <label><span>Address</span><input name="shipping_line1" placeholder="Street address"/></label>
            <label><span>Apartment, suite, etc.</span><input name="shipping_line2"/></label>
            <div className="shop-2col"><label><span>City</span><input name="shipping_city"/></label><label><span>Region</span><input name="shipping_region"/></label></div>
            <div className="shop-2col"><label><span>Postal code</span><input name="shipping_postalCode"/></label><label><span>Country</span><input name="shipping_country" defaultValue="Pakistan"/></label></div>
          </div>
        </section>

        <section className="shop-card">
          <div className="draft-card-title"><h2>Order details</h2></div>
          <div className="shop-field-stack">
            <label><span>Fulfillment location</span><select name="locationId"><option value="">Default location</option>{locations.map(location=><option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
            <label><span>Payment method</span><select name="paymentMethod"><option value="cod">Cash on delivery</option><option value="manual">Manual payment</option></select></label>
            <label><span>Quote expires</span><input name="quoteExpiresAt" type="datetime-local"/></label>
          </div>
        </section>

        <section className="draft-actions-card">
          <div className="draft-actions-copy"><b>Order actions</b><span>Drafts do not deduct stock. Creating the order validates and deducts stock.</span></div>
          <button className="secondary-button wide-button" name="submitIntent" value="draft" type="submit" disabled={!lines.length}>Save as draft</button>
          <button className="secondary-button wide-button" name="submitIntent" value="paid" type="submit" disabled={!lines.length}>Mark as paid & create</button>
          <button className="primary-button wide-button" name="submitIntent" value="create" type="submit" disabled={!lines.length}>Create order</button>
        </section>
      </aside>
    </form>

    {productModal&&<div className="admin-modal-backdrop" onMouseDown={()=>setProductModal(false)}><div className="admin-modal product-browser-modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="admin-modal-head"><div><h2>Add products</h2><p>Select products and variants for this order.</p></div><button onClick={()=>setProductModal(false)}>×</button></div>
      <div className="admin-modal-search"><span>⌕</span><input autoFocus value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder="Search products or SKU"/></div>
      <div className="product-browser-list">{filteredVariants.map(v=><button type="button" key={v.variant_id} onClick={()=>addVariant(v)}><div className="browser-product-thumb">◇</div><div><b>{v.title}</b><span>{Object.values(v.selected_options||{}).join(" / ")||"Default variant"} · {v.sku}</span></div><small>{v.inventory} available</small><strong>Rs. {Number(v.price).toLocaleString("en-PK")}</strong></button>)}</div>
      <div className="admin-modal-foot"><button className="primary-button" onClick={()=>setProductModal(false)}>Done</button></div>
    </div></div>}

    {customerModal&&<div className="admin-modal-backdrop" onMouseDown={()=>setCustomerModal(false)}><div className="admin-modal customer-browser-modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="admin-modal-head"><div><h2>Select customer</h2><p>Choose an existing customer or create a new one.</p></div><button onClick={()=>setCustomerModal(false)}>×</button></div>
      <div className="admin-modal-search"><span>⌕</span><input autoFocus value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)} placeholder="Search customers"/></div>
      <button className="create-customer-row" type="button" onClick={()=>{setSelectedCustomer(null);setNewCustomer(true);setCustomerModal(false);}}><span>＋</span><div><b>Create a new customer</b><small>Add name, email and phone to this order</small></div></button>
      <div className="customer-browser-list">{filteredCustomers.map(customer=><button type="button" key={customer.id} onClick={()=>{setSelectedCustomer(customer);setNewCustomer(false);setCustomerModal(false);}}><div className="selected-customer-avatar">{customer.name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div><div><b>{customer.name}</b><span>{customer.email}</span></div><small>{customer.orders} orders</small></button>)}</div>
    </div></div>}
  </>;
}
