import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {GiftPackagingEditor} from "@/components/gift-packaging-editor";
import "./gift-packaging.css";
export default async function PackagingSettings(){
 let result:{ready:boolean;items:any[]}|null=null;
 try{result=await adminRequest<{ready:boolean;items:any[]}>("/v1/admin/gift-packaging");}catch{}
 return <main className="gift-admin-page">
  <PageHeader eyebrow="CATALOG / GIFT EXPERIENCE" title="Gift Packaging"
   description="Configure ready-to-ship jewelry presentation as real stock-controlled packaging SKUs, with transparent checkout charges.">
   <Link href="/orders" className="secondary-button">View orders ↗</Link>
  </PageHeader>
  {!result?.ready?<section className="panel gift-admin-empty">
   <h2>Packaging configuration awaits database setup</h2>
   <p>Install versioned migration 025 on an approved database before creating packaging SKUs. Ordinary jewelry checkout remains available without this feature.</p>
   <Link href="/products" className="secondary-button">Back to products</Link>
  </section>:
  <GiftPackagingEditor items={result.items||[]}/>}
 </main>;
}
