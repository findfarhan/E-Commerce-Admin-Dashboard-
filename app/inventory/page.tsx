import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {createLocationAction} from "@/app/commerce/actions";

export default async function Inventory(){
  const response=await adminRequest<any>("/v1/admin/commerce/locations",0);
  const locations=response?.items||[];
  const onHand=locations.reduce((sum:number,l:any)=>sum+Number(l.on_hand||0),0);
  const reserved=locations.reduce((sum:number,l:any)=>sum+Number(l.reserved||0),0);
  const available=Math.max(0,onHand-reserved);

  return <div className="catalog-page">
    <PageHeader eyebrow="INVENTORY" title="Inventory" description="Track stock across fulfillment locations and maintain a clean operational view of availability."/>

    <section className="catalog-kpi-grid">
      <article><span>Locations</span><strong>{locations.length}</strong><small>Active stock nodes</small></article>
      <article><span>On hand</span><strong>{onHand.toLocaleString("en-PK")}</strong><small>Total physical units</small></article>
      <article><span>Reserved</span><strong>{reserved.toLocaleString("en-PK")}</strong><small>Allocated but not fulfilled</small></article>
      <article><span>Available</span><strong>{available.toLocaleString("en-PK")}</strong><small>Ready to sell</small></article>
    </section>

    <section className="inventory-layout-pro">
      <article className="catalog-panel">
        <div className="catalog-section-head"><div><span>STOCK LOCATIONS</span><h2>Fulfillment network</h2><p>Warehouses, stores and studios holding sellable inventory.</p></div></div>
        <div className="location-grid-pro">
          {locations.map((location:any)=>{
            const hand=Number(location.on_hand||0);
            const res=Number(location.reserved||0);
            const free=Math.max(0,hand-res);
            const reservePct=hand>0?Math.min(100,Math.round((res/hand)*100)):0;
            return <article className="location-card-pro" key={location.id}>
              <div className="location-card-head">
                <span className="location-icon">▣</span>
                <div><h3>{location.name}</h3><p>{location.code} · {String(location.location_type||"location").replaceAll("_"," ")}</p></div>
                {location.is_default?<span className="status-pill success">Default</span>:<span className="status-pill neutral">Active</span>}
              </div>
              <div className="location-metrics">
                <div><span>On hand</span><b>{hand.toLocaleString("en-PK")}</b></div>
                <div><span>Reserved</span><b>{res.toLocaleString("en-PK")}</b></div>
                <div><span>Available</span><b>{free.toLocaleString("en-PK")}</b></div>
              </div>
              <div className="location-reserve-bar"><i style={{width:reservePct+"%"}}/></div>
              <div className="location-card-foot"><span>{reservePct}% of stock reserved</span><span>{location.active===false?"Inactive":"Operational"}</span></div>
            </article>;
          })}
          {!locations.length&&<div className="catalog-empty card-empty"><b>No inventory locations</b><span>Create a warehouse, store or studio to start tracking stock by location.</span></div>}
        </div>
      </article>

      <aside className="schema-create-card">
        <div className="catalog-section-head compact"><div><span>NEW LOCATION</span><h2>Add stock location</h2><p>Create a warehouse, store or studio.</p></div></div>
        <form action={createLocationAction} className="schema-create-form">
          <label><span>Location name</span><input name="name" required placeholder="Lahore Warehouse"/></label>
          <div className="schema-pair"><label><span>Code</span><input name="code" required placeholder="LHR-WH"/></label><label><span>Type</span><select name="locationType"><option value="warehouse">Warehouse</option><option value="store">Store</option><option value="studio">Studio</option></select></label></div>
          <label><span>Street address</span><input name="address_line1" placeholder="Address"/></label>
          <div className="schema-pair"><label><span>City</span><input name="address_city" placeholder="Lahore"/></label><label><span>Region</span><input name="address_region" placeholder="Punjab"/></label></div>
          <label><span>Country</span><input name="address_country" defaultValue="Pakistan"/></label>
          <label className="schema-check"><input name="isDefault" type="checkbox"/><span><b>Default location</b><small>Use first for order fulfillment</small></span></label>
          <button className="primary-button wide-button">Create location</button>
        </form>
      </aside>
    </section>
  </div>;
}
