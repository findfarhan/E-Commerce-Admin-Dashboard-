"use client";
import {useState} from "react";
type OrderItem={id:string;title:string;sku:string;quantity:number|string;variant_id?:string|null};
type Variant={variant_id:string;title:string;sku:string;inventory:number|string};
export function ReturnBuilder({action,orderId,items,catalog}:{action:(formData:FormData)=>void|Promise<void>;orderId:string;items:OrderItem[];catalog:Variant[]}){
  const [rows,setRows]=useState(items.map(item=>({orderItemId:item.id,quantity:0,action:"return",exchangeVariantId:"",itemCondition:"resellable",restock:true,refundAmount:0})));
  const payload=JSON.stringify(rows.filter(row=>Number(row.quantity)>0).map(row=>({...row,quantity:Number(row.quantity),refundAmount:Number(row.refundAmount)})));
  return <form action={action} className="panel enterprise-card">
    <input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="itemsJson" value={payload}/>
    <h3>Return / exchange lines</h3><p>Use quantity 0 to exclude an item. Exchange stock is validated atomically when the return completes.</p>
    <div style={{display:"grid",gap:14,marginTop:16}}>{items.map((item,index)=><div className="field-grid" key={item.id}>
      <div className="field" style={{gridColumn:"span 2"}}><span>Order item</span><b>{item.title}</b><small>{item.sku} · ordered {item.quantity}</small></div>
      <label className="field"><span>Return qty</span><input type="number" min="0" max={Number(item.quantity)} value={rows[index].quantity} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,quantity:Number(e.target.value)}:r))}/></label>
      <label className="field"><span>Action</span><select value={rows[index].action} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,action:e.target.value}:r))}><option value="return">Return</option><option value="exchange">Exchange</option></select></label>
      {rows[index].action==="exchange"&&<label className="field" style={{gridColumn:"span 2"}}><span>Exchange variant</span><select value={rows[index].exchangeVariantId} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,exchangeVariantId:e.target.value}:r))}><option value="">Select replacement</option>{catalog.map(v=><option key={v.variant_id} value={v.variant_id} disabled={Number(v.inventory)<=0}>{v.title} · {v.sku} · {v.inventory} stock</option>)}</select></label>}
      <label className="field"><span>Condition</span><select value={rows[index].itemCondition} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,itemCondition:e.target.value}:r))}><option value="resellable">Resellable</option><option value="damaged">Damaged</option><option value="repair">Repair</option></select></label>
      <label className="field"><span>Line refund</span><input type="number" min="0" step=".01" value={rows[index].refundAmount} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,refundAmount:Number(e.target.value)}:r))}/></label>
      <label className="field"><span>Restock</span><input type="checkbox" checked={rows[index].restock} onChange={e=>setRows(cur=>cur.map((r,i)=>i===index?{...r,restock:e.target.checked}:r))}/></label>
    </div>)}</div>
    <div className="field-grid" style={{marginTop:18}}><label className="field"><span>Reason</span><input name="reason" required/></label><label className="field"><span>Total refund amount</span><input name="refundAmount" type="number" min="0" step=".01" defaultValue="0"/></label><label className="field" style={{gridColumn:"1 / -1"}}><span>Notes</span><textarea name="notes" rows={3}/></label></div>
    <button className="primary-button" type="submit">Create return request</button>
  </form>;
}
