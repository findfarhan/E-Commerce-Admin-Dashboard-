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
