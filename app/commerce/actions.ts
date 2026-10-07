"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {adminMutation} from "@/lib/admin-server";

function lines(formData:FormData){
  const out:any[]=[];
  for(let i=0;i<8;i++){
    const variantId=String(formData.get("variantId_"+i)||"").trim();
    if(!variantId) continue;
    const quantity=Number(formData.get("quantity_"+i)||1);
    const raw=String(formData.get("unitPrice_"+i)||"").trim();
    out.push({variantId,quantity,...(raw?{unitPrice:Number(raw)}:{})});
  }
  return out;
}
function address(formData:FormData,prefix:string){
  return {line1:String(formData.get(prefix+"line1")||"").trim(),line2:String(formData.get(prefix+"line2")||"").trim(),city:String(formData.get(prefix+"city")||"").trim(),region:String(formData.get(prefix+"region")||"").trim(),postalCode:String(formData.get(prefix+"postalCode")||"").trim(),country:String(formData.get(prefix+"country")||"Pakistan").trim()};
}
export async function createManualOrderAction(formData:FormData){
  const result:any=await adminMutation("/v1/admin/commerce/orders",{method:"POST",body:JSON.stringify({
    customer:{name:String(formData.get("customerName")||"").trim(),email:String(formData.get("customerEmail")||"").trim(),phone:String(formData.get("customerPhone")||"").trim()},
    items:lines(formData),shippingAddress:address(formData,"shipping_"),billingAddress:address(formData,"shipping_"),
    discountCode:String(formData.get("discountCode")||"").trim()||null,shippingAmount:Number(formData.get("shippingAmount")||0),
    ...(String(formData.get("taxAmount")||"").trim()?{taxAmount:Number(formData.get("taxAmount"))}:{}),
    shippingMethod:String(formData.get("shippingMethod")||"manual"),paymentMethod:String(formData.get("paymentMethod")||"cod"),paymentStatus:String(formData.get("paymentStatus")||"pending"),
    paidAmount:Number(formData.get("paidAmount")||0),locationId:String(formData.get("locationId")||"").trim()||null,notes:String(formData.get("notes")||"").trim()||null
  })});
  revalidatePath("/orders");redirect("/orders/"+result.id);
}
export async function createDraftOrderAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/draft-orders",{method:"POST",body:JSON.stringify({
    status:String(formData.get("status")||"draft"),email:String(formData.get("email")||"").trim()||null,phone:String(formData.get("phone")||"").trim()||null,
    items:lines(formData),shippingAddress:address(formData,"shipping_"),billingAddress:address(formData,"shipping_"),
    discountAmount:Number(formData.get("discountAmount")||0),shippingAmount:Number(formData.get("shippingAmount")||0),
    ...(String(formData.get("taxAmount")||"").trim()?{taxAmount:Number(formData.get("taxAmount"))}:{}),
    notes:String(formData.get("notes")||"").trim()||null,quoteExpiresAt:String(formData.get("quoteExpiresAt")||"").trim()||null
  })});revalidatePath("/draft-orders");
}
export async function convertDraftAction(id:string){
  const order:any=await adminMutation("/v1/admin/commerce/draft-orders/"+id+"/convert",{method:"POST",body:JSON.stringify({paymentMethod:"cod",paymentStatus:"pending"})});
  revalidatePath("/draft-orders");revalidatePath("/orders");redirect("/orders/"+order.id);
}
export async function createLocationAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/locations",{method:"POST",body:JSON.stringify({name:String(formData.get("name")||"").trim(),code:String(formData.get("code")||"").trim(),locationType:String(formData.get("locationType")||"warehouse"),isDefault:formData.get("isDefault")==="on",address:address(formData,"address_")})});revalidatePath("/inventory");
}
export async function createDiscountAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/discounts",{method:"POST",body:JSON.stringify({code:String(formData.get("code")||"").trim(),name:String(formData.get("name")||"").trim()||null,kind:String(formData.get("kind")||"percentage"),value:Number(formData.get("value")||0),appliesTo:String(formData.get("appliesTo")||"order"),minimumOrder:String(formData.get("minimumOrder")||"").trim()?Number(formData.get("minimumOrder")):null,usageLimit:String(formData.get("usageLimit")||"").trim()?Number(formData.get("usageLimit")):null,startsAt:String(formData.get("startsAt")||"").trim()||null,endsAt:String(formData.get("endsAt")||"").trim()||null,automatic:formData.get("automatic")==="on",active:true})});revalidatePath("/discounts");
}
export async function createShippingZoneAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/shipping/zones",{method:"POST",body:JSON.stringify({name:String(formData.get("name")||"").trim(),countries:String(formData.get("countries")||"Pakistan").split(",").map(x=>x.trim()).filter(Boolean),regions:String(formData.get("regions")||"").split(",").map(x=>x.trim()).filter(Boolean),cities:String(formData.get("cities")||"").split(",").map(x=>x.trim()).filter(Boolean),rates:[{name:String(formData.get("rateName")||"Standard"),rateType:String(formData.get("rateType")||"flat"),amount:Number(formData.get("amount")||0),minimumOrder:String(formData.get("minimumOrder")||"").trim()?Number(formData.get("minimumOrder")):null,courier:String(formData.get("courier")||"").trim()||null}]})});revalidatePath("/shipping-tax");
}
export async function createTaxRuleAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/taxes",{method:"POST",body:JSON.stringify({name:String(formData.get("name")||"").trim(),country:String(formData.get("country")||"Pakistan").trim(),region:String(formData.get("region")||"").trim()||null,rate:Number(formData.get("ratePercent")||0)/100,inclusive:formData.get("inclusive")==="on",priority:Number(formData.get("priority")||0),active:true})});revalidatePath("/shipping-tax");
}
export async function createSupplierAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/suppliers",{method:"POST",body:JSON.stringify({name:String(formData.get("name")||"").trim(),email:String(formData.get("email")||"").trim()||null,phone:String(formData.get("phone")||"").trim()||null,notes:String(formData.get("notes")||"").trim()||null})});revalidatePath("/purchasing");
}
export async function createPurchaseOrderAction(formData:FormData){
  const items:any[]=[];for(let i=0;i<8;i++){const variantId=String(formData.get("variantId_"+i)||"").trim();if(!variantId)continue;items.push({variantId,quantity:Number(formData.get("quantity_"+i)||1),unitCost:Number(formData.get("unitCost_"+i)||0)});}
  await adminMutation("/v1/admin/commerce/purchase-orders",{method:"POST",body:JSON.stringify({supplierId:String(formData.get("supplierId")||"").trim()||null,locationId:String(formData.get("locationId")||"").trim()||null,expectedAt:String(formData.get("expectedAt")||"").trim()||null,notes:String(formData.get("notes")||"").trim()||null,items})});revalidatePath("/purchasing");
}
export async function receivePurchaseOrderAction(id:string){await adminMutation("/v1/admin/commerce/purchase-orders/"+id+"/receive",{method:"POST",body:"{}"});revalidatePath("/purchasing");revalidatePath("/products");}
export async function createMetafieldDefinitionAction(formData:FormData){
  await adminMutation("/v1/admin/commerce/metafield-definitions",{method:"POST",body:JSON.stringify({resourceType:"product",namespace:String(formData.get("namespace")||"custom"),key:String(formData.get("key")||"").trim(),name:String(formData.get("name")||"").trim(),valueType:String(formData.get("valueType")||"text"),filterable:formData.get("filterable")==="on",searchable:formData.get("searchable")==="on"})});revalidatePath("/metafields");
}
