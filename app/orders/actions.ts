"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function updateOrderAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/orders/"+id,{
    method:"PATCH",
    body:JSON.stringify({
      status:String(formData.get("status")||""),
      paymentStatus:String(formData.get("paymentStatus")||""),
      fulfillmentStatus:String(formData.get("fulfillmentStatus")||""),
      trackingCarrier:String(formData.get("trackingCarrier")||"").trim(),
      trackingNumber:String(formData.get("trackingNumber")||"").trim(),
      trackingUrl:String(formData.get("trackingUrl")||"").trim(),
      notes:String(formData.get("notes")||"").trim()||null,
    }),
  });
  revalidatePath("/orders");
  revalidatePath("/orders/"+id);
}

export async function cancelOrderAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/orders/"+id+"/cancel",{
    method:"POST",
    body:JSON.stringify({reason:String(formData.get("reason")||"").trim()||"Canceled by admin"}),
  });
  revalidatePath("/orders");
  revalidatePath("/orders/"+id);
}


export async function returnOrderAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/orders/"+id+"/return",{
    method:"POST",
    body:JSON.stringify({reason:String(formData.get("reason")||"").trim()||"Returned by admin"}),
  });
  revalidatePath("/orders");
  revalidatePath("/orders/"+id);
}


export async function editOrderLinesAction(id:string,formData:FormData){
  const items:any[]=[];
  for(let i=0;i<12;i++){const variantId=String(formData.get("variantId_"+i)||"").trim();if(!variantId)continue;items.push({variantId,quantity:Number(formData.get("quantity_"+i)||1),...(String(formData.get("unitPrice_"+i)||"").trim()?{unitPrice:Number(formData.get("unitPrice_"+i))}:{})});}
  await adminMutation("/v1/admin/commerce/orders/"+id+"/edit",{method:"POST",body:JSON.stringify({items,discountAmount:Number(formData.get("discountAmount")||0),shippingAmount:Number(formData.get("shippingAmount")||0),taxAmount:Number(formData.get("taxAmount")||0),shippingMethod:String(formData.get("shippingMethod")||"manual"),shippingAddress:{line1:String(formData.get("line1")||""),line2:String(formData.get("line2")||""),city:String(formData.get("city")||""),region:String(formData.get("region")||""),postalCode:String(formData.get("postalCode")||""),country:String(formData.get("country")||"Pakistan")},notes:String(formData.get("notes")||"").trim()||null})});
  revalidatePath("/orders");revalidatePath("/orders/"+id);revalidatePath("/orders/"+id+"/edit");
}
export async function createReturnCaseAction(orderId:string,formData:FormData){
  const items:any[]=[];for(let i=0;i<20;i++){const orderItemId=String(formData.get("orderItemId_"+i)||"").trim();const quantity=Number(formData.get("returnQty_"+i)||0);if(!orderItemId||quantity<1)continue;items.push({orderItemId,quantity,disposition:String(formData.get("disposition_"+i)||"restock"),exchangeVariantId:String(formData.get("exchangeVariantId_"+i)||"").trim()||null,refundAmount:Number(formData.get("refundAmount_"+i)||0)});}
  await adminMutation("/v1/admin/commerce/returns",{method:"POST",body:JSON.stringify({orderId,returnType:String(formData.get("returnType")||"return"),reason:String(formData.get("reason")||"").trim()||null,refundAmount:Number(formData.get("refundAmount")||0),notes:String(formData.get("notes")||"").trim()||null,items})});
  revalidatePath("/returns");revalidatePath("/orders/"+orderId);
}
export async function completeReturnCaseAction(returnId:string){await adminMutation("/v1/admin/commerce/returns/"+returnId+"/complete",{method:"POST",body:"{}"});revalidatePath("/returns");revalidatePath("/orders");}
