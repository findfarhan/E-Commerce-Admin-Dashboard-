"use client";
import {useActionState,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {archivePackagingAction,savePackagingAction,type PackagingActionState} from "@/app/gift-packaging/actions";

type Packaging={
 id:string;sku:string;title:string;description:string;imageUrl:string|null;
 price:number;inventory:number;weightGrams:number;taxable:boolean;
 status:"active"|"draft"|"archived";position:number;
};
const empty=():Packaging=>({id:"",sku:"",title:"",description:"",imageUrl:null,price:0,inventory:0,weightGrams:40,taxable:false,status:"draft",position:0});
const initial:PackagingActionState={ok:false,message:""};
const money=(n:number)=>"Rs. "+Number(n||0).toLocaleString("en-PK",{minimumFractionDigits:0,maximumFractionDigits:2});

export function GiftPackagingEditor({items}:{items:Packaging[]}){
 const router=useRouter();
 const [draft,setDraft]=useState<Packaging>(empty);
 const [state,submit,pending]=useActionState(savePackagingAction,initial);
 useEffect(()=>{
  if(!state.ok)return;
  if(state.id)setDraft(current=>({...current,id:state.id||current.id}));
  router.refresh();
 },[state,router]);
 const set=(value:Partial<Packaging>)=>setDraft(old=>({...old,...value}));
 const ready=draft.sku.length>=2&&draft.title.length>=2&&draft.inventory>=0&&draft.price>=0&&draft.weightGrams>=0;
 const active=items.filter(x=>x.status==="active").length;
 const purchasable=items.filter(x=>x.status==="active"&&x.inventory>0).length;
 return <>
   <section className="gift-admin-stats" aria-label="Gift packaging overview">
    <article><span>Packaging options</span><strong>{items.length}</strong></article>
    <article><span>Published</span><strong>{active}</strong></article>
    <article><span>Available at checkout</span><strong>{purchasable}</strong></article>
    <article><span>Stock accounting</span><strong>Per SKU</strong></article>
   </section>
   <div className="gift-admin-layout">
    <aside className="panel gift-admin-library">
     <header><div><span>CURATED PRESENTATIONS</span><h2>Your packaging</h2></div><button type="button" className="secondary-button" onClick={()=>setDraft(empty())}>+ New</button></header>
     <p>Keep physical box, pouch and premium presentation inventories separate from jewelry stock.</p>
     <div className="gift-admin-list">
      {items.map(option=><button type="button" key={option.id} className={"gift-admin-row "+(option.id===draft.id?"selected":"")}
       onClick={()=>setDraft({...option})}>
       <span className="gift-admin-row-top"><b>{option.title}</b><small>{option.status}</small></span>
       <span className="gift-admin-row-info">{option.sku} · {money(option.price)}</span>
       <span className="gift-admin-row-info">{option.inventory} ready-to-pack units</span>
      </button>)}
      {!items.length&&<p className="gift-admin-no-items">No packaging styles created. Add a basic pouch or branded box to begin.</p>}
     </div>
    </aside>
    <form action={submit} className="panel gift-admin-editor">
      <input type="hidden" name="id" value={draft.id}/>
      <header><div><span>PHASE 4 / ORDER PRESENTATION</span><h2>{draft.title||"Create a gift presentation"}</h2>
       <p>Shoppers can select one packaging SKU per gift order. Prices, stock and shipping weight are checked on the server.</p></div>
       <button className="primary-button" type="submit" disabled={pending||!ready}>{pending?"Saving…":"Save option"}</button>
      </header>
      {state.message&&<p className={"gift-admin-notice "+(state.ok?"success":"error")} role={state.ok?"status":"alert"}>{state.message}</p>}
      <div className="gift-admin-fields">
       <label><span>Presentation name</span><input name="title" minLength={2} maxLength={130} required value={draft.title} onChange={e=>set({title:e.target.value})} placeholder="The Signature Gift Box"/></label>
       <label><span>Packaging SKU</span><input name="sku" minLength={2} maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" required value={draft.sku} onChange={e=>set({sku:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")})} placeholder="BOX-GOLD-01"/></label>
       <label className="wide"><span>Buyer-facing description</span><textarea name="description" value={draft.description} maxLength={1200} rows={3} onChange={e=>set({description:e.target.value})} placeholder="A rigid keepsake box with soft lining and a protective outer sleeve."/></label>
       <label className="wide"><span>Optional product photo (HTTPS)</span><input name="imageUrl" type="url" value={draft.imageUrl||""} onChange={e=>set({imageUrl:e.target.value})} placeholder="https://cdn.example.com/packaging/box.webp"/></label>
       <label><span>Customer price (PKR)</span><input name="price" type="number" required min={0} max={100000} step="0.01" value={draft.price} onChange={e=>set({price:Number(e.target.value)||0})}/></label>
       <label><span>Physical boxes / pouches available</span><input name="inventory" type="number" required min={0} max={1000000} step="1" value={draft.inventory} onChange={e=>set({inventory:Number(e.target.value)||0})}/></label>
       <label><span>Extra parcel weight (grams)</span><input name="weightGrams" type="number" required min={0} max={25000} step="1" value={draft.weightGrams} onChange={e=>set({weightGrams:Number(e.target.value)||0})}/></label>
       <label><span>Display order</span><input name="position" type="number" required min={0} max={10000} step="1" value={draft.position} onChange={e=>set({position:Number(e.target.value)||0})}/></label>
       <label><span>Storefront status</span><select name="status" value={draft.status} onChange={e=>set({status:e.target.value as Packaging["status"]})}>
         <option value="draft">Draft (hidden)</option><option value="active">Active (if stock available)</option><option value="archived">Archived</option>
       </select></label>
       <label className="gift-admin-checkbox"><input type="checkbox" name="taxable" checked={draft.taxable} onChange={e=>set({taxable:e.target.checked})}/><span>Packaging price is taxable under matching store tax rules</span></label>
      </div>
      <section className="gift-admin-preview">
       <span>BUYER PREVIEW</span>
       <div><strong>{draft.title||"Presentation name"}</strong><b>{draft.price===0?"Complimentary":money(draft.price)}</b></div>
       <p>{draft.description||"Your optional packaging description appears here."}</p>
       <small>{draft.inventory>0?draft.inventory+" in stock":"Currently unavailable"} · {draft.weightGrams}g added to shipping calculation</small>
      </section>
      <footer><p>No packaging charge or deduction happens until an order is confirmed. Existing orders preserve SKU and charged price as snapshots.</p>
       <div className="gift-admin-footer-actions">
        {draft.id&&<button type="submit" formAction={archivePackagingAction} formNoValidate className="secondary-button" disabled={pending}
          onClick={e=>{if(!window.confirm("Archive this packaging option? Buyers can no longer select it."))e.preventDefault();}}>Archive option</button>}
        <button className="primary-button" type="submit" disabled={pending||!ready}>{pending?"Saving…":"Save packaging"}</button>
       </div>
      </footer>
    </form>
   </div>
 </>;
}
