"use client";
import {useState} from "react";
type Rule={field:string;operator:string;value:any};
export function SmartCollectionRules({action,mode:initialMode,rules:initialRules}:{action:(formData:FormData)=>void|Promise<void>;mode:string;rules:Rule[]}){
  const [mode,setMode]=useState(initialMode==="smart"?"smart":"manual");
  const [rules,setRules]=useState<Rule[]>(initialRules.length?initialRules:[{field:"category",operator:"equals",value:""}]);
  const payload=JSON.stringify(rules.map(rule=>({...rule,value:rule.value})));
  return <form action={action} className="panel enterprise-card">
    <input type="hidden" name="rulesJson" value={payload}/>
    <h3>Collection mode</h3><p>Manual collections preserve exact merchandising order. Smart collections rebuild membership from rules.</p>
    <label className="field" style={{marginTop:14}}><span>Mode</span><select name="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="manual">Manual</option><option value="smart">Smart / automated</option></select></label>
    {mode==="smart"&&<div style={{display:"grid",gap:12,marginTop:14}}>{rules.map((rule,index)=><div className="field-grid" key={index}>
      <label className="field"><span>Field</span><select value={rule.field} onChange={e=>setRules(cur=>cur.map((r,i)=>i===index?{...r,field:e.target.value}:r))}><option value="category">Category</option><option value="material">Material</option><option value="vendor">Vendor</option><option value="product_type">Product type</option><option value="status">Status</option><option value="featured">Featured</option><option value="tag">Primary tag</option><option value="tags">Tags</option><option value="price">Price</option><option value="inventory">Inventory</option></select></label>
      <label className="field"><span>Operator</span><select value={rule.operator} onChange={e=>setRules(cur=>cur.map((r,i)=>i===index?{...r,operator:e.target.value}:r))}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="in">In</option><option value="gte">≥</option><option value="lte">≤</option></select></label>
      <label className="field"><span>Value</span><input value={String(rule.value??"")} onChange={e=>setRules(cur=>cur.map((r,i)=>i===index?{...r,value:e.target.value}:r))}/></label>
      <button className="secondary-button" type="button" onClick={()=>setRules(cur=>cur.length===1?cur:cur.filter((_,i)=>i!==index))}>Remove</button>
    </div>)}
    <button className="secondary-button" type="button" onClick={()=>setRules(cur=>[...cur,{field:"category",operator:"equals",value:""}])}>+ Add rule</button></div>}
    <div className="page-actions" style={{marginTop:16}}><button className="primary-button" type="submit">Save collection mode</button></div>
  </form>;
}
