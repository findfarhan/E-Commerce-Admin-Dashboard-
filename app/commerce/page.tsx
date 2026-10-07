import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";

const money=(value:number)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function Commerce(){
  const [overview,report]=await Promise.all([
    adminRequest<any>("/v1/admin/commerce/overview",0),
    adminRequest<any>("/v1/admin/commerce/report",0)
  ]);

  const modules=[
    {label:"Drafts / Quotes",value:Number(overview?.drafts||0),href:"/draft-orders",detail:"Quotes and draft orders awaiting action"},
    {label:"Discounts",value:Number(overview?.discounts||0),href:"/discounts",detail:"Active promotional rules and codes"},
    {label:"Locations",value:Number(overview?.locations||0),href:"/inventory",detail:"Inventory and fulfillment locations"},
    {label:"Open returns",value:Number(overview?.open_returns||0),href:"/returns",detail:"Return or exchange cases in progress"},
    {label:"Open purchase orders",value:Number(overview?.open_purchase_orders||0),href:"/purchasing",detail:"Inbound supplier purchase orders"},
    {label:"Notifications",value:Number(overview?.unread_notifications||0),href:"/audit",detail:"Unread operational notifications"},
  ];

  const financials=[
    {label:"Revenue",value:money(report?.revenue||0),detail:"Last 30 days"},
    {label:"Gross profit",value:money(report?.gross_profit||0),detail:"After recorded cost of goods"},
    {label:"Average order value",value:money(report?.aov||0),detail:"Average across completed orders"},
    {label:"Inventory value",value:money(report?.inventory_value||0),detail:"Current recorded inventory cost"},
  ];

  return <div className="commerce-page">
    <PageHeader
      eyebrow="ENTERPRISE COMMERCE"
      title="Commerce Operations"
      description="Control pricing, inventory, purchasing, returns, taxes, payments and operational workflows from one place."
    >
      <Link className="secondary-button" href="/draft-orders">Draft orders</Link>
      <Link className="primary-button" href="/orders/new">Create manual order</Link>
    </PageHeader>

    <section className="commerce-module-grid">
      {modules.map(module=><Link key={module.label} href={module.href} className="commerce-module-card">
        <div className="commerce-module-top">
          <span>{module.label}</span>
          <em>→</em>
        </div>
        <strong>{module.value.toLocaleString()}</strong>
        <p>{module.detail}</p>
      </Link>)}
    </section>

    <section className="commerce-financial-panel">
      <div className="commerce-section-head">
        <div><span>30 DAY OPERATIONS</span><h2>Financial control</h2><p>Core commerce performance based on recorded orders, cost and inventory data.</p></div>
        <Link href="/analytics">Open analytics →</Link>
      </div>
      <div className="commerce-financial-grid">
        {financials.map(item=><div className="commerce-financial-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>)}
      </div>
    </section>
  </div>;
}
