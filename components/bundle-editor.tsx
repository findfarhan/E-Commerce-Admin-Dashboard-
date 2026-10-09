"use client";
import {useActionState,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {saveBundleAction,archiveBundleAction,type BundleActionState} from "@/app/bundles/actions";

type Variant={
 variant_id:string;sku:string;price:number;inventory:number;
 variant_status:string;product_status:string;product_title:string;product_id:string;handle:string;
 options:Record<string,string>;
};
type Component={variantId:string;quantity:number};
type Bundle={
 id:string;title:string;handle:string;description:string;status:string;
 discountKind:"fixed"|"percentage";discountValue:number;
 components:Array<{variantId:string;quantity:number}>;
 startsAt:string|null;endsAt:string|null;
 regularPrice:number;bundlePrice:number;saving:number;eligible:boolean;maxQuantity:number;
};
const money=(n:number)=>"Rs. "+Number(n||0).toLocaleString("en-PK",{maximumFractionDigits:2});
const empty=():Bundle=>({id:"",title:"",handle:"",description:"",status:"draft",discountKind:"percentage",discountValue:10,startsAt:null,endsAt:null,components:[],regularPrice:0,bundlePrice:0,saving:0,eligible:false,maxQuantity:0});
const slugify=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120);
function optionText(v:Variant){return Object.entries(v.options||{}).map(([k,x])=>k+": "+x).join(" · ")||v.sku;}
const actionState:BundleActionState={ok:false,message:""};

export function BundleEditor({bundles,variants}:{bundles:Bundle[];variants:Variant[]}){
  const [selected,setSelected]=useState<Bundle>(empty);
  const [query,setQuery]=useState("");
  const [picked,setPicked]=useState("");
  const [formResult,save,pending]=useActionState(saveBundleAction,actionState);
  const router=useRouter();
  useEffect(()=>{if(formResult.ok)router.refresh();},[formResult,router]);
  const byId=useMemo(()=>new Map(variants.map(v=>[v.variant_id,v])),[variants]);
  const visible=useMemo(()=>variants.filter(v=>v.variant_status==="active"&&v.product_status==="active"&&
    (v.product_title+" "+v.sku+" "+optionText(v)).toLowerCase().includes(query.toLowerCase())).slice(0,50),[variants,query]);
  const update=(patch:Partial<Bundle>)=>setSelected(previous=>({...previous,...patch}));
  const add=()=>{
    const variant=byId.get(picked);
    if(!variant||selected.components.some(x=>x.variantId===picked)||selected.components.length>=10)return;
    update({components:[...selected.components,{variantId:picked,quantity:1}]});setPicked("");
  };
  const setQuantity=(id:string,qty:number)=>{
    update({components:selected.components.map(c=>c.variantId===id?{...c,quantity:Math.max(1,Math.min(25,Math.floor(qty)||1))}:c)});
  };
  const gross=selected.components.reduce((sum,c)=>sum+(byId.get(c.variantId)?.price||0)*c.quantity,0);
  const saving=Math.min(gross,selected.discountKind==="percentage"?gross*Math.min(100,selected.discountValue)/100:selected.discountValue);
  const ready=selected.components.length>=2&&selected.components.every(c=>{
    const v=byId.get(c.variantId);return v&&v.inventory>=c.quantity&&v.variant_status==="active"&&v.product_status==="active";
  });
  const percent=gross>0?Math.round(saving/gross*100):0;
  const pricingValid=Number.isFinite(selected.discountValue)&&selected.discountValue>=0&&(selected.discountKind!=="fixed"||selected.discountValue<=gross);
  return <div className="bundle-admin-layout">
    <aside className="panel bundle-admin-list">
      <div className="panel-head"><div><span>CURATED SETS</span><h2>Bundle library</h2></div><button type="button" className="secondary-button" onClick={()=>setSelected(empty())}>+ New</button></div>
      <p className="bundle-muted">Select a set to edit pricing, publish status or its exact jewelry variants.</p>
      <div className="bundle-library">
        {bundles.map(bundle=><button type="button" key={bundle.id} className={"bundle-library-card "+(selected.id===bundle.id?"selected":"")} onClick={()=>setSelected({...bundle,components:bundle.components.map(c=>({variantId:c.variantId,quantity:c.quantity}))})}>
          <span className="bundle-library-top"><b>{bundle.title}</b><small>{bundle.status}</small></span>
          <span>{bundle.components.length} variants · {money(bundle.bundlePrice)}</span>
          <span className="bundle-library-bottom"><small>{bundle.saving>0?"Save "+money(bundle.saving):"No discount"}</small><small>{bundle.eligible?"Available":bundle.status==="active"?"Unavailable":"Unpublished"}</small></span>
        </button>)}
        {!bundles.length&&<p className="bundle-empty">No bundles yet. Create your first coordinated set.</p>}
      </div>
    </aside>

    <form action={save} className="panel bundle-editor">
      <input type="hidden" name="id" value={selected.id}/>
      <input type="hidden" name="components" value={JSON.stringify(selected.components)}/>
      <header className="bundle-editor-heading">
        <div><span>{selected.id?"EDIT EXISTING SET":"NEW BUNDLE"}</span><h2>{selected.title||"Build a jewelry set"}</h2><p>Mix individual product variants. Customers see an exact list of pieces, transparent savings and verified availability.</p></div>
        <button disabled={pending||!ready||!pricingValid||!selected.title||!selected.handle} className="primary-button" type="submit">{pending?"Saving…":selected.id?"Save changes":"Create bundle"}</button>
      </header>

      {formResult.message&&<p key={formResult.message} role={formResult.ok?"status":"alert"} className={"bundle-notice "+(formResult.ok?"success":"error")}>{formResult.message}</p>}
      <section className="bundle-editor-section">
        <div className="bundle-section-title"><b>01</b><div><h3>Identity & publishing</h3><p>Give the bundle a clear title, URL and customer-facing description.</p></div></div>
        <div className="bundle-field-grid">
          <label><span>Bundle name</span><input name="title" required minLength={2} maxLength={150} value={selected.title} onChange={e=>update({title:e.target.value,handle:selected.id?selected.handle:slugify(e.target.value)})} placeholder="Evening Radiance Set"/></label>
          <label><span>Handle</span><input name="handle" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={selected.handle} onChange={e=>update({handle:slugify(e.target.value)})}/></label>
          <label><span>Publishing</span><select name="status" value={selected.status} onChange={e=>update({status:e.target.value})}><option value="draft">Draft</option><option value="active">Active / published</option><option value="archived">Archived</option></select></label>
          <label className="wide"><span>Description</span><textarea name="description" rows={3} maxLength={2000} value={selected.description} onChange={e=>update({description:e.target.value})} placeholder="A necklace-and-earrings pairing for evening occasions…"/></label>
          <label><span>Starts at (UTC, optional)</span><input type="datetime-local" name="startsAt" value={selected.startsAt?.slice(0,16)||""} onChange={e=>update({startsAt:e.target.value||null})}/></label>
          <label><span>Ends at (UTC, optional)</span><input type="datetime-local" name="endsAt" value={selected.endsAt?.slice(0,16)||""} onChange={e=>update({endsAt:e.target.value||null})}/></label>
        </div>
      </section>

      <section className="bundle-editor-section">
        <div className="bundle-section-title"><b>02</b><div><h3>Pieces in this set</h3><p>2–10 different active SKUs. Specify quantities and exact variants, not just broad products.</p></div></div>
        <div className="bundle-add-row">
          <label><span>Search SKU, product or variation</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. gold hoops"/></label>
          <label><span>Choose variant</span><select value={picked} onChange={e=>setPicked(e.target.value)}><option value="">Select a SKU…</option>{visible.map(v=><option key={v.variant_id} value={v.variant_id} disabled={selected.components.some(c=>c.variantId===v.variant_id)||v.inventory<1}>{v.product_title} · {optionText(v)} · {money(v.price)} · {v.inventory} in stock</option>)}</select></label>
          <button type="button" className="secondary-button" disabled={!picked||selected.components.length>=10} onClick={add}>Add piece +</button>
        </div>
        <div className="bundle-pieces">
          {selected.components.map((c,i)=>{const v=byId.get(c.variantId);return <article key={c.variantId} className="bundle-piece">
            <span className="bundle-piece-number">{String(i+1).padStart(2,"0")}</span>
            <div><b>{v?.product_title||"Unavailable variant"}</b><p>{v?optionText(v):c.variantId}</p><small>{v?money(v.price)+" each · "+v.inventory+" available":"Archived or missing SKU"}</small></div>
            <label><span>Quantity</span><input type="number" aria-label={"Quantity of "+(v?.product_title||"product")} min={1} max={25} value={c.quantity} onChange={e=>setQuantity(c.variantId,Number(e.target.value))}/></label>
            <strong>{money((v?.price||0)*c.quantity)}</strong>
            <button type="button" className="bundle-remove" aria-label={"Remove "+(v?.product_title||"piece")} onClick={()=>update({components:selected.components.filter(x=>x.variantId!==c.variantId)})}>×</button>
          </article>})}
          {!selected.components.length&&<div className="bundle-empty">Add at least two matching jewelry variants to build this set.</div>}
        </div>
        {!ready&&selected.components.length>0&&<p className="bundle-validation" role="status">Set needs at least two available variants with sufficient stock to save.</p>}
      </section>

      <section className="bundle-editor-section">
        <div className="bundle-section-title"><b>03</b><div><h3>Bundle pricing</h3><p>Saving applies once per set. Coupon stacking is disabled at checkout.</p></div></div>
        <div className="bundle-field-grid bundle-pricing-controls">
          <label><span>Saving type</span><select name="discountKind" value={selected.discountKind} onChange={e=>update({discountKind:e.target.value as "fixed"|"percentage"})}><option value="percentage">Percent off set</option><option value="fixed">Fixed amount off set</option></select></label>
          <label><span>{selected.discountKind==="percentage"?"Discount (%)":"Discount (PKR)"}</span><input name="discountValue" type="number" required min={0} max={selected.discountKind==="percentage"?100:999999} step="0.01" value={selected.discountValue} onChange={e=>update({discountValue:Number(e.target.value)||0})}/></label>
        </div>
        {!pricingValid&&<p className="bundle-validation" role="alert">Fixed bundle saving cannot be greater than the price of its component pieces.</p>}
        <div className="bundle-price-preview">
          <div><span>Separate items</span><strong>{money(gross)}</strong></div>
          <div><span>Bundle saving ({percent}%)</span><strong>− {money(saving)}</strong></div>
          <div className="total"><span>Customer pays (before delivery/tax)</span><strong>{money(gross-saving)}</strong></div>
          <p>Estimate from current admin catalog. Server validates actual prices and stock again before order creation.</p>
        </div>
      </section>
      <footer className="bundle-editor-footer"><span>Inventory is deducted per original SKU, not from an imaginary bundle stock counter.</span>
        <div className="bundle-footer-actions">
          {selected.id&&<button type="submit" formAction={archiveBundleAction} formNoValidate className="secondary-button"
            onClick={e=>{if(!window.confirm("Archive this jewelry set? Existing checkout links will no longer be valid."))e.preventDefault();}}
            disabled={pending}>Archive set</button>}
          <button type="submit" className="primary-button" disabled={pending||!ready||!pricingValid||!selected.handle||!selected.title}>{pending?"Saving…":"Save bundle"}</button>
        </div>
      </footer>
    </form>
  </div>;
}
