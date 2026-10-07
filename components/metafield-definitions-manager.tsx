"use client";

import {useMemo,useState} from "react";
import {createMetafieldDefinitionAction} from "@/app/commerce/actions";

type Definition={id:string;name:string;namespace:string;key:string;value_type:string;description?:string|null;filterable?:boolean;searchable?:boolean};

const slugKey=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");

const types=[
  ["text","Single line text","Names, labels and short content"],
  ["number","Number","Weights, dimensions and numeric values"],
  ["boolean","True or false","Simple yes/no attributes"],
  ["date","Date","Dates without time"],
  ["url","URL","Links and external references"],
  ["single_select","Single select","One value from a controlled list"],
  ["multi_select","Multi select","Multiple values from a controlled list"],
  ["json","JSON","Structured advanced data"],
] as const;

export function MetafieldDefinitionsManager({items}:{items:Definition[]}){
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [namespace,setNamespace]=useState("custom");
  const [key,setKey]=useState("");
  const [keyTouched,setKeyTouched]=useState(false);
  const [type,setType]=useState("text");
  const [query,setQuery]=useState("");

  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return q?items.filter(item=>(item.name+" "+item.namespace+"."+item.key+" "+item.value_type).toLowerCase().includes(q)):items;
  },[items,query]);

  const onName=(value:string)=>{
    setName(value);
    if(!keyTouched) setKey(slugKey(value));
  };

  return <div className="metafield-settings-shell">
    <div className="metafield-settings-head">
      <div><h2>Product metafield definitions</h2><p>Definitions control the type and behavior of custom product data.</p></div>
      <button className="primary-button" type="button" onClick={()=>setOpen(true)}>Add definition</button>
    </div>

    <div className="metafield-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search definitions"/></div>

    <div className="metafield-definition-table">
      <div className="metafield-definition-header"><span>Name</span><span>Namespace and key</span><span>Type</span><span>Capabilities</span></div>
      {visible.map(item=><div className="metafield-definition-row" key={item.id}>
        <div><span className="definition-pin">⋮⋮</span><span><b>{item.name}</b><small>{item.description||"No description"}</small></span></div>
        <code>{item.namespace}.{item.key}</code>
        <span className="definition-type">{String(item.value_type).replaceAll("_"," ")}</span>
        <div className="definition-capabilities">{item.filterable&&<span>Filter</span>}{item.searchable&&<span>Search</span>}{!item.filterable&&!item.searchable&&<span className="quiet">Internal</span>}</div>
      </div>)}
      {!visible.length&&<div className="catalog-empty"><b>No definitions found</b><span>Create a definition or change your search.</span></div>}
    </div>

    {open&&<div className="admin-modal-backdrop" onMouseDown={()=>setOpen(false)}>
      <div className="admin-modal metafield-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="admin-modal-head"><div><h2>Add product metafield definition</h2><p>Create a reusable field that appears on product records.</p></div><button type="button" onClick={()=>setOpen(false)}>×</button></div>
        <form action={createMetafieldDefinitionAction} className="metafield-definition-form">
          <label className="shopify-admin-field"><span>Name</span><input name="name" required autoFocus value={name} onChange={e=>onName(e.target.value)} placeholder="Stone type"/><small>A clear label staff will recognize.</small></label>
          <label className="shopify-admin-field"><span>Description</span><textarea name="description" rows={3} placeholder="Describe what should be stored in this field"/></label>

          <div className="definition-type-section">
            <span>Type</span>
            <div className="definition-type-grid">
              {types.map(([value,label,desc])=><label className={type===value?"active":""} key={value}>
                <input type="radio" name="valueType" value={value} checked={type===value} onChange={()=>setType(value)}/>
                <span><b>{label}</b><small>{desc}</small></span>
              </label>)}
            </div>
          </div>

          <details className="definition-advanced">
            <summary>Namespace and key</summary>
            <div className="schema-pair">
              <label className="shopify-admin-field"><span>Namespace</span><input name="namespace" value={namespace} onChange={e=>setNamespace(slugKey(e.target.value))}/></label>
              <label className="shopify-admin-field"><span>Key</span><input name="key" required value={key} onChange={e=>{setKeyTouched(true);setKey(slugKey(e.target.value));}}/></label>
            </div>
            <p>Identifier: <code>{namespace||"custom"}.{key||"field_name"}</code></p>
          </details>

          <section className="definition-capability-settings">
            <h3>Capabilities</h3>
            <label className="shopify-admin-check"><input name="filterable" type="checkbox"/><span><b>Use in filters</b><small>Allow this field to participate in catalog and smart-collection filtering.</small></span></label>
            <label className="shopify-admin-check"><input name="searchable" type="checkbox"/><span><b>Use in search</b><small>Include values when building product discovery/search.</small></span></label>
          </section>

          <div className="admin-modal-foot">
            <button className="secondary-button" type="button" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit">Save definition</button>
          </div>
        </form>
      </div>
    </div>}
  </div>;
}
