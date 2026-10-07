import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {createMetafieldDefinitionAction} from "@/app/commerce/actions";

export default async function Metafields(){
  const response=await adminRequest<any>("/v1/admin/commerce/metafield-definitions?resourceType=product",0);
  const items=response?.items||[];
  const filterable=items.filter((x:any)=>x.filterable).length;
  const searchable=items.filter((x:any)=>x.searchable).length;
  const namespaces=new Set(items.map((x:any)=>x.namespace)).size;

  return <div className="catalog-page">
    <PageHeader eyebrow="CATALOG SCHEMA" title="Product metafields" description="Define structured jewelry data for filtering, search, merchandising and integrations."/>

    <section className="catalog-kpi-grid">
      <article><span>Definitions</span><strong>{items.length}</strong><small>Product-level schema fields</small></article>
      <article><span>Filterable</span><strong>{filterable}</strong><small>Available for catalog filtering</small></article>
      <article><span>Searchable</span><strong>{searchable}</strong><small>Indexed for discovery</small></article>
      <article><span>Namespaces</span><strong>{namespaces}</strong><small>Schema groups in use</small></article>
    </section>

    <section className="metafield-layout">
      <article className="catalog-panel">
        <div className="catalog-section-head"><div><span>DEFINITIONS</span><h2>Product schema</h2><p>Fields available to every product in the catalog.</p></div></div>
        <div className="metafield-list-pro">
          {items.map((item:any)=><div className="metafield-row-pro" key={item.id}>
            <span className="metafield-icon">#</span>
            <div className="metafield-primary"><b>{item.name}</b><code>{item.namespace}.{item.key}</code></div>
            <span className="metafield-type">{String(item.value_type).replaceAll("_"," ")}</span>
            <div className="metafield-flags">{item.filterable&&<span>Filterable</span>}{item.searchable&&<span>Searchable</span>}{!item.filterable&&!item.searchable&&<span className="muted">Internal</span>}</div>
          </div>)}
          {!items.length&&<div className="catalog-empty"><b>No metafields defined</b><span>Create the first schema field from the panel on the right.</span></div>}
        </div>
      </article>

      <aside className="schema-create-card">
        <div className="catalog-section-head compact"><div><span>NEW FIELD</span><h2>Create definition</h2><p>Add a reusable typed field to products.</p></div></div>
        <form action={createMetafieldDefinitionAction} className="schema-create-form">
          <div className="schema-pair">
            <label><span>Namespace</span><input name="namespace" defaultValue="jewelry"/></label>
            <label><span>Key</span><input name="key" required placeholder="stone_type"/></label>
          </div>
          <label><span>Name</span><input name="name" required placeholder="Stone type"/></label>
          <label><span>Value type</span><select name="valueType"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="date">Date</option><option value="url">URL</option><option value="single_select">Single select</option><option value="multi_select">Multi select</option><option value="json">JSON</option></select></label>
          <label className="schema-check"><input name="filterable" type="checkbox"/><span><b>Use as filter</b><small>Allow catalog/storefront filtering</small></span></label>
          <label className="schema-check"><input name="searchable" type="checkbox"/><span><b>Make searchable</b><small>Include values in search/discovery</small></span></label>
          <button className="primary-button wide-button">Create definition</button>
        </form>
      </aside>
    </section>
  </div>;
}
