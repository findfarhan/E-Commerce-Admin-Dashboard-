"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {adminMutation} from "@/lib/admin-server";

function text(formData:FormData,key:string){return String(formData.get(key)||"").trim();}
function num(formData:FormData,key:string,fallback=0){const value=Number(formData.get(key));return Number.isFinite(value)?value:fallback;}
function json<T=any>(formData:FormData,key:string,fallback:T):T{
  const raw=text(formData,key);
  if(!raw) return fallback;
  try{return JSON.parse(raw) as T;}catch{throw new Error(key+" contains invalid JSON");}
}
function csv(value:string){return value.split(",").map(v=>v.trim()).filter(Boolean);}

export async function createManualOrderAction(formData:FormData){
  const shipping={line1:text(formData,"line1"),line2:text(formData,"line2"),city:text(formData,"city"),region:text(formData,"region"),postalCode:text(formData,"postalCode"),country:text(formData,"country")||"Pakistan"};
  const result:any=await adminMutation("/v1/admin/manual-orders",{method:"POST",body:JSON.stringify({
    customerId:text(formData,"customerId")||undefined,
    customer:text(formData,"customerId")?undefined:{name:text(formData,"customerName"),email:text(formData,"customerEmail"),phone:text(formData,"customerPhone")},
    items:json(formData,"itemsJson",[]),
    shippingAddress:shipping,billingAddress:shipping,
    discountCode:text(formData,"discountCode")||undefined,
    shippingRateId:text(formData,"shippingRateId")||undefined,
    locationId:text(formData,"locationId")||undefined,
    paymentStatus:text(formData,"paymentStatus")||"pending",
    paymentMethod:text(formData,"paymentMethod")||"cod",
    paymentAmount:num(formData,"paymentAmount",0),
    priceOverrideReason:text(formData,"priceOverrideReason")||"Manual order",
    notes:text(formData,"notes")||undefined,
  })},"orders.write");
  revalidatePath("/orders");
  redirect("/orders/"+result.order.id);
}

export async function createDraftOrderAction(formData:FormData){
  const shipping={line1:text(formData,"line1"),line2:text(formData,"line2"),city:text(formData,"city"),region:text(formData,"region"),postalCode:text(formData,"postalCode"),country:text(formData,"country")||"Pakistan"};
  const result:any=await adminMutation("/v1/admin/draft-orders",{method:"POST",body:JSON.stringify({
    customerId:text(formData,"customerId")||undefined,
    customer:text(formData,"customerId")?undefined:{name:text(formData,"customerName"),email:text(formData,"customerEmail"),phone:text(formData,"customerPhone")},
    items:json(formData,"itemsJson",[]),
    shippingAddress:shipping,billingAddress:shipping,
    discountCode:text(formData,"discountCode")||undefined,
    shippingRateId:text(formData,"shippingRateId")||undefined,
    priceOverrideReason:text(formData,"priceOverrideReason")||undefined,
    notes:text(formData,"notes")||undefined,
    expiresAt:text(formData,"expiresAt")||undefined,
  })},"orders.write");
  revalidatePath("/draft-orders");
  redirect("/draft-orders/"+result.id);
}

export async function sendDraftOrderAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/draft-orders/"+id+"/send",{method:"POST",body:JSON.stringify({subject:text(formData,"subject")||undefined})},"orders.write");
  revalidatePath("/draft-orders");revalidatePath("/draft-orders/"+id);
}
export async function convertDraftOrderAction(id:string,formData:FormData){
  const result:any=await adminMutation("/v1/admin/draft-orders/"+id+"/convert",{method:"POST",body:JSON.stringify({
    locationId:text(formData,"locationId")||undefined,
    paymentStatus:text(formData,"paymentStatus")||"pending",
    paymentMethod:text(formData,"paymentMethod")||"cod",
    paymentProvider:text(formData,"paymentProvider")||"manual",
    paymentAmount:num(formData,"paymentAmount",0),
  })},"orders.write");
  revalidatePath("/draft-orders");revalidatePath("/orders");
  redirect("/orders/"+result.order.id);
}

export async function createDiscountAction(formData:FormData){
  await adminMutation("/v1/admin/discounts",{method:"POST",body:JSON.stringify({
    name:text(formData,"name"),code:text(formData,"code")||undefined,
    discountType:text(formData,"discountType")||"percentage",value:num(formData,"value"),
    minimumSubtotal:num(formData,"minimumSubtotal"),usageLimit:text(formData,"usageLimit")?num(formData,"usageLimit"):undefined,
    startsAt:text(formData,"startsAt")||undefined,endsAt:text(formData,"endsAt")||undefined,
    targetType:text(formData,"targetType")||"order",
    targetIds:csv(text(formData,"targetIds")),
    metadata:text(formData,"calculation")?{calculation:text(formData,"calculation"),max_discount:text(formData,"maxDiscount")?num(formData,"maxDiscount"):undefined}: {},
    active:true,
  })},"discounts.write");
  revalidatePath("/discounts");
}

export async function createLocationAction(formData:FormData){
  await adminMutation("/v1/admin/locations",{method:"POST",body:JSON.stringify({
    name:text(formData,"name"),code:text(formData,"code"),
    address:{line1:text(formData,"line1"),city:text(formData,"city"),region:text(formData,"region"),country:text(formData,"country")||"Pakistan"},
    isActive:true,isFulfillment:formData.get("isFulfillment")==="on",makeDefault:formData.get("makeDefault")==="on",
    priority:num(formData,"priority"),
  })},"inventory.write");
  revalidatePath("/inventory");
}
export async function adjustLocationInventoryAction(formData:FormData){
  const locationId=text(formData,"locationId"),variantId=text(formData,"variantId");
  await adminMutation("/v1/admin/locations/"+locationId+"/inventory/"+variantId+"/adjust",{method:"POST",body:JSON.stringify({delta:num(formData,"delta"),reason:text(formData,"reason")})},"inventory.write");
  revalidatePath("/inventory");revalidatePath("/products");
}
export async function createInventoryTransferAction(formData:FormData){
  await adminMutation("/v1/admin/inventory-transfers",{method:"POST",body:JSON.stringify({
    fromLocationId:text(formData,"fromLocationId"),toLocationId:text(formData,"toLocationId"),items:json(formData,"itemsJson",[]),notes:text(formData,"notes")||undefined,
  })},"inventory.write");
  revalidatePath("/inventory");
}

export async function createShippingZoneAction(formData:FormData){
  await adminMutation("/v1/admin/shipping/zones",{method:"POST",body:JSON.stringify({
    name:text(formData,"name"),countries:csv(text(formData,"countries")),regions:csv(text(formData,"regions")),cities:csv(text(formData,"cities")),priority:num(formData,"priority"),active:true,
  })},"settings.manage");
  revalidatePath("/shipping");
}
export async function createShippingRateAction(formData:FormData){
  const zoneId=text(formData,"zoneId");
  await adminMutation("/v1/admin/shipping/zones/"+zoneId+"/rates",{method:"POST",body:JSON.stringify({
    name:text(formData,"name"),rateType:text(formData,"rateType")||"flat",amount:num(formData,"amount"),
    minOrderValue:text(formData,"minOrderValue")?num(formData,"minOrderValue"):undefined,maxOrderValue:text(formData,"maxOrderValue")?num(formData,"maxOrderValue"):undefined,
    minWeightGrams:text(formData,"minWeightGrams")?num(formData,"minWeightGrams"):undefined,maxWeightGrams:text(formData,"maxWeightGrams")?num(formData,"maxWeightGrams"):undefined,
    carrier:text(formData,"carrier")||undefined,serviceCode:text(formData,"serviceCode")||undefined,active:true,priority:num(formData,"priority"),
  })},"settings.manage");
  revalidatePath("/shipping");
}
export async function createTaxRuleAction(formData:FormData){
  await adminMutation("/v1/admin/taxes",{method:"POST",body:JSON.stringify({
    name:text(formData,"name"),country:text(formData,"country")||undefined,region:text(formData,"region")||undefined,city:text(formData,"city")||undefined,
    rate:num(formData,"rate")/100,priority:num(formData,"priority"),productTypes:csv(text(formData,"productTypes")),active:true,
  })},"settings.manage");
  revalidatePath("/shipping");
}
export async function updateTaxModeAction(formData:FormData){
  await adminMutation("/v1/admin/taxes/mode",{method:"PATCH",body:JSON.stringify({pricesIncludeTax:formData.get("pricesIncludeTax")==="on"})},"settings.manage");
  revalidatePath("/shipping");
}

export async function createSupplierAction(formData:FormData){
  await adminMutation("/v1/admin/suppliers",{method:"POST",body:JSON.stringify({name:text(formData,"name"),email:text(formData,"email")||undefined,phone:text(formData,"phone")||undefined,notes:text(formData,"notes")||undefined,active:true})},"purchasing.write");
  revalidatePath("/purchasing");
}
export async function createPurchaseOrderAction(formData:FormData){
  const result:any=await adminMutation("/v1/admin/purchase-orders",{method:"POST",body:JSON.stringify({
    supplierId:text(formData,"supplierId")||undefined,locationId:text(formData,"locationId"),items:json(formData,"itemsJson",[]),notes:text(formData,"notes")||undefined,expectedAt:text(formData,"expectedAt")||undefined,
  })},"purchasing.write");
  revalidatePath("/purchasing");
  redirect("/purchasing/"+result.id);
}
export async function placePurchaseOrderAction(id:string){
  await adminMutation("/v1/admin/purchase-orders/"+id+"/order",{method:"POST",body:"{}"},"purchasing.write");
  revalidatePath("/purchasing");revalidatePath("/purchasing/"+id);
}
export async function receivePurchaseOrderAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/purchase-orders/"+id+"/receive",{method:"POST",body:JSON.stringify({items:json(formData,"itemsJson",undefined as any)})},"purchasing.write");
  revalidatePath("/purchasing");revalidatePath("/purchasing/"+id);revalidatePath("/inventory");
}

export async function recordPaymentAction(formData:FormData){
  await adminMutation("/v1/admin/payments",{method:"POST",body:JSON.stringify({
    orderId:text(formData,"orderId"),transactionType:text(formData,"transactionType")||"payment",provider:text(formData,"provider")||"manual",
    status:text(formData,"status")||"succeeded",amount:num(formData,"amount"),idempotencyKey:text(formData,"idempotencyKey")||undefined,
    externalId:text(formData,"externalId")||undefined,
  })},"payments.write");
  revalidatePath("/payments");revalidatePath("/orders");
}
export async function refundPaymentAction(formData:FormData){
  await adminMutation("/v1/admin/payments/refund",{method:"POST",body:JSON.stringify({
    orderId:text(formData,"orderId"),provider:text(formData,"provider")||"manual",status:"succeeded",amount:num(formData,"amount"),idempotencyKey:text(formData,"idempotencyKey"),
  })},"payments.write");
  revalidatePath("/payments");revalidatePath("/orders");
}

export async function createReturnAction(formData:FormData){
  await adminMutation("/v1/admin/returns",{method:"POST",body:JSON.stringify({
    orderId:text(formData,"orderId"),items:json(formData,"itemsJson",[]),reason:text(formData,"reason")||undefined,
    refundAmount:num(formData,"refundAmount"),notes:text(formData,"notes")||undefined,
  })},"returns.write");
  revalidatePath("/returns");
}
export async function completeReturnAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/returns/"+id+"/complete",{method:"POST",body:JSON.stringify({
    locationId:text(formData,"locationId"),refundAmount:num(formData,"refundAmount"),provider:text(formData,"provider")||"manual",
  })},"returns.write");
  revalidatePath("/returns");revalidatePath("/inventory");revalidatePath("/payments");
}

export async function markNotificationAction(id:string){
  await adminMutation("/v1/admin/notifications/"+id,{method:"PATCH",body:JSON.stringify({status:"read"})},"notifications.read");
  revalidatePath("/notifications");
}

export async function createRoleAction(formData:FormData){
  await adminMutation("/v1/admin/roles",{method:"POST",body:JSON.stringify({name:text(formData,"name"),slug:text(formData,"slug"),permissions:csv(text(formData,"permissions"))})},"team.manage");
  revalidatePath("/team");
}
export async function createAdminUserAction(formData:FormData){
  await adminMutation("/v1/admin/auth/users",{method:"POST",body:JSON.stringify({
    email:text(formData,"email"),displayName:text(formData,"displayName")||undefined,roleId:text(formData,"roleId"),password:text(formData,"password")||undefined,
  })},"team.manage");
  revalidatePath("/team");
}

export async function editEnterpriseOrderAction(id:string,formData:FormData){
  const shipping={line1:text(formData,"line1"),line2:text(formData,"line2"),city:text(formData,"city"),region:text(formData,"region"),postalCode:text(formData,"postalCode"),country:text(formData,"country")||"Pakistan"};
  await adminMutation("/v1/admin/order-editor/"+id,{method:"PATCH",body:JSON.stringify({
    items:json(formData,"itemsJson",[]),
    discountCode:text(formData,"discountCode")||null,
    shippingRateId:text(formData,"shippingRateId")||undefined,
    locationId:text(formData,"locationId")||undefined,
    shippingAddress:shipping,billingAddress:shipping,
    notes:text(formData,"notes")||null,
  })},"orders.write");
  revalidatePath("/orders");revalidatePath("/orders/"+id);revalidatePath("/inventory");revalidatePath("/analytics");
}
