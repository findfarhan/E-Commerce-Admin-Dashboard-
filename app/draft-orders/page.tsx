import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {convertDraftAction,sendDraftQuoteAction} from "@/app/commerce/actions";

export default async function DraftOrders(){
  const drafts=await adminRequest<any>("/v1/admin/commerce/draft-orders",0);
  const items=drafts?.items||[];
  return <>
    <PageHeader eyebrow="ORDERS" title="Draft orders" description="Drafts can be reviewed, quoted, and converted into stock-deducting orders.">
      <Link className="primary-button" href="/orders/new">Create order</Link>
    </PageHeader>
    <section className="panel draft-pipeline-panel">
      <div className="panel-head"><div><span>DRAFT PIPELINE</span><h2>Saved drafts</h2></div></div>
      <div className="draft-pipeline-list">
        {items.map((draft:any)=><div className="draft-pipeline-row" key={draft.id}>
          <div className="draft-pipeline-main"><b>{draft.customer_name||draft.customer_email||draft.email||"No customer"}</b><span>{draft.item_count} item{Number(draft.item_count)===1?"":"s"} · Rs. {Number(draft.total||0).toLocaleString("en-PK")}</span></div>
          <span className={"status-pill "+(draft.status==="quote"?"info":"neutral")}>{draft.status}</span>
          <small>{draft.created_at?new Date(draft.created_at).toLocaleString("en-PK"):""}</small>
          {!draft.converted_order_id?<div className="draft-pipeline-actions"><form action={sendDraftQuoteAction.bind(null,draft.id)}><button className="secondary-button">Send quote</button></form><form action={convertDraftAction.bind(null,draft.id)}><button className="primary-button">Create order</button></form></div>:<span className="status-pill success">converted</span>}
        </div>)}
        {!items.length&&<div className="draft-empty large"><div>◇</div><b>No draft orders yet</b><span>Create an order and save it as draft to see it here.</span><Link className="primary-button" href="/orders/new">Create order</Link></div>}
      </div>
    </section>
  </>;
}