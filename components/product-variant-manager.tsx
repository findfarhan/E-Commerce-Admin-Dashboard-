"use client";

import {useMemo,useState} from "react";
import type {ProductMediaSet,ProductOption,ProductVariant} from "@/lib/types";

type Tab="options"|"variants"|"media";

export function ProductVariantManager({options,variants,mediaSets}:{options:ProductOption[];variants:ProductVariant[];mediaSets:ProductMediaSet[]}){
  const [tab,setTab]=useState<Tab>("options");
  const [selection,setSelection]=useState<Record<string,string>>(()=>Object.fromEntries(options.map(o=>[o.name,o.values[0]?.value??""])));
  const resolvedVariant=useMemo(()=>variants.find(v=>Object.entries(selection).every(([key,value])=>v.selectedOptions[key]===value)),[selection,variants]);
  const visualSelection=useMemo(()=>Object.fromEntries(options.filter(o=>o.isVisual).map(o=>[o.name,selection[o.name]])),[options,selection]);
  const resolvedMedia=useMemo(()=>mediaSets.find(set=>Object.entries(set.matchOptions).every(([key,value])=>visualSelection[key]===value))??mediaSets.find(set=>set.isDefault)??mediaSets[0],[mediaSets,visualSelection]);

  return <section className="product-detail-layout">
    <div className="product-detail-main">
      <div className="variant-tabs">
        {(["options","variants","media"] as Tab[]).map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item==="options"?"Options & rules":item==="variants"?"Variant matrix":"Variant media"}</button>)}
      </div>

      {tab==="options"&&<article className="panel variant-panel">
        <div className="variant-panel-title"><div><h3>Product options</h3><p>Appearance-changing options are visual. Size remains sellable without forcing duplicate galleries.</p></div></div>
        {options.map(option=><div className="option-card" key={option.id}>
          <div className="option-card-head"><div><b>{option.name}</b><small>{option.values.length} values</small></div>{option.isVisual&&<span className="visual-badge">VISUAL OPTION</span>}</div>
          <div className="option-values">{option.values.map(value=><span className="option-value" key={value.id}>{value.swatchColor&&<i className="option-swatch" style={{background:value.swatchColor}}/>}{value.value}</span>)}</div>
        </div>)}
      </article>}

      {tab==="variants"&&<article className="panel variant-panel">
        <div className="variant-panel-title"><div><h3>Variant matrix</h3><p>Every sellable combination gets its own SKU, price and stock while visual combinations share media.</p></div><span className="free-tier-chip">{variants.length} variants</span></div>
        <div className="variant-matrix"><table><thead><tr><th>VARIANT</th><th>SKU</th><th>PRICE</th><th>STOCK</th><th>STATUS</th></tr></thead><tbody>{variants.map(v=><tr key={v.id}><td className="variant-combo">{v.title}<small>{Object.entries(v.selectedOptions).map(([k,val])=>k+": "+val).join(" · ")}</small></td><td>{v.sku}</td><td>{"Rs. "+v.price.toLocaleString("en-PK")}</td><td>{v.inventory}</td><td><span className="status-pill success">{v.status}</span></td></tr>)}</tbody></table></div>
      </article>}

      {tab==="media"&&<article className="panel variant-panel">
        <div className="variant-panel-title"><div><h3>Media sets</h3><p>Metal + Stone control imagery; Size does not duplicate the gallery.</p></div><span className="free-tier-chip">{mediaSets.length} visual sets</span></div>
        <div className="media-set-grid">{mediaSets.map(set=><article className="media-set-card" key={set.id}><div className="media-set-head"><b>{set.name}</b><span>{Object.values(set.matchOptions).join(" + ")}</span></div><div className="media-thumbs">{set.imageUrls.map((_,i)=><div className="media-thumb" key={i}><span>{String(i+1).padStart(2,"0")}</span></div>)}<div className="media-thumb upload">+</div></div><div className="variant-media-map"><div><span>Matches</span><b>{Object.entries(set.matchOptions).map(([k,v])=>k+": "+v).join(" · ")}</b></div><div><span>Size dependency</span><b>None</b></div></div></article>)}</div>
      </article>}
    </div>

    <aside className="panel variant-side-panel">
      <h3>Live variant resolver</h3>
      <p>The storefront consumes this exact resolution contract.</p>
      <div className="resolver-form">{options.map(option=><label className="resolver-field" key={option.id}><span>{option.name}</span><select value={selection[option.name]} onChange={e=>setSelection(current=>({...current,[option.name]:e.target.value}))}>{option.values.map(v=><option key={v.id}>{v.value}</option>)}</select></label>)}</div>
      <div className="resolved-box"><span>RESOLVED VARIANT</span><b>{resolvedVariant?.sku??"No exact match"}</b><div className="resolved-meta"><div><small>PRICE</small><strong>{resolvedVariant?"Rs. "+resolvedVariant.price.toLocaleString("en-PK"):"—"}</strong></div><div><small>STOCK</small><strong>{resolvedVariant?.inventory??"—"}</strong></div><div><small>MEDIA SET</small><strong>{resolvedMedia?.name??"—"}</strong></div><div><small>IMAGES</small><strong>{resolvedMedia?.imageUrls.length??0}</strong></div></div><div className="resolved-gallery">{resolvedMedia?.imageUrls.slice(0,3).map((_,i)=><i key={i}/>)}</div></div>
      <div className="variant-architecture"><span>STOREFRONT CONTRACT</span><code>{JSON.stringify({variantId:resolvedVariant?.id,sku:resolvedVariant?.sku,mediaSetId:resolvedMedia?.id},null,2)}</code></div>
    </aside>
  </section>
}