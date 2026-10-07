import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {ProductCreateForm} from "@/components/product-create-form";

export default function NewProductPage(){
  return <div className="resource-create-page"><PageHeader eyebrow="PRODUCTS" title="Add product" description="Build product details, pricing, inventory, publishing and organization in a structured workflow."><Link className="secondary-button" href="/products">Back to products</Link></PageHeader><ProductCreateForm/></div>;
}
