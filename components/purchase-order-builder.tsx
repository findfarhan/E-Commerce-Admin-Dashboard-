"use client";
import {useMemo,useState} from "react";
type Variant={variant_id:string;title:string;sku:string;cost_amount:number|string;inventory:number|string};
type Supplier={id:string;name:string};
type Location={id:string;name:string};
export function PurchaseOrderBuilder({action,catalog,suppliers,locations}:{action:(formData:FormData)=>void|Promise<void>;catalog:Variant[];suppliers:Supplier[];locations:Location[]}){
  const byId=useMemo(()=>new Map(catalog.map(v=>[v.variant_id,v])),[catalog]);
  const [lines,setLines]=useState([{variantId:"",quantity:1,unitCost:0}]);
  const itemsJson=JSON.stringify(lines.filter(l=>l.variantId).map(l=>({variantId:l.variantId,quantity:Number(l.quantity),unitCost:Number(l.unitCost)})));
  const total=lines.reduce((sum,l)=>sum+Number(l.quantity||0)*Number(l.unitCost||0),0);
  function choose(index:number,id:string){const v=byId.get(id);setLines(current=>current.map((l,i)=>i===index?{...l,variantId:id,unitCost:Number(v?.cost_amount||0)}:l));}
  return <form action={action} className="panel enterprise-card">
    <input type="hidden" name="itemsJson" value={itemsJson}/>
    <h3>New purchase order</h3><p>Draft first. Incoming inventory is counted only when the PO is placed.</p>
    <div className="field-grid" style={{marginTop:16}}><label className="field"><span>Supplier</span><select name="supplierId"><option value="">No supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>Receiving location</span><select name="locationId" required>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className="field"><span>Expected</span><input name="expectedAt" type="datetime-local"/></label><label className="field"><span>Notes</span><input name="notes"/></label></div>
    <div style={{display:"grid",gap:12,marginTop:16}}>{lines.map((line,index)=><div className="field-grid" key={index}><label className="field" style={{gridColumn:"span 2"}}><span>Variant</span><select value={line.variantId} onChange={e=>choose(index,e.target.value)} required><option value="">Select variant</option>{catalog.map(v=><option value={v.variant_id} key={v.variant_id}>{v.title} · {v.sku} · current {v.inventory}</option>)}</select></label><label className="field"><span>Qty</span><input type="number" min="1" value={line.quantity} onChange={e=>setLines(current=>current.map((l,i)=>i===index?{...l,quantity:Number(e.target.value)}:l))}/></label><label className="field"><span>Unit cost</span><input type="number" min="0" step=".01" value={line.unitCost} onChange={e=>setLines(current=>current.map((l,i)=>i===index?{...l,unitCost:Number(e.target.value)}:l))}/></label><button className="secondary-button" type="button" onClick={()=>setLines(current=>current.length===1?current:current.filter((_,i)=>i!==index))}>Remove</button></div>)}</div>
    <div className="page-actions" style={{marginTop:16}}><button className="secondary-button" type="button" onClick={()=>setLines(current=>[...current,{variantId:"",quantity:1,unitCost:0}])}>+ Add line</button><button className="primary-button" type="submit">Create PO · Rs. {total.toLocaleString("en-PK")}</button></div>
  </form>;
}
