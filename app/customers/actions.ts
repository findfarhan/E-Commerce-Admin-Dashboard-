"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function addCustomerNoteAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/customers/"+id+"/notes",{
    method:"POST",
    body:JSON.stringify({note:String(formData.get("note")||"").trim(),author:"admin"}),
  });
  revalidatePath("/customers/"+id);
}


export async function addCustomerAddressAction(customerId:string,formData:FormData){
  const {adminMutation}=await import("@/lib/admin-server");
  await adminMutation("/v1/admin/commerce/customers/"+customerId+"/addresses",{method:"POST",body:JSON.stringify({
    label:String(formData.get("label")||"").trim()||null,addressType:String(formData.get("addressType")||"shipping"),isDefault:formData.get("isDefault")==="on",
    name:String(formData.get("name")||"").trim()||null,phone:String(formData.get("phone")||"").trim()||null,line1:String(formData.get("line1")||"").trim(),
    line2:String(formData.get("line2")||"").trim()||null,city:String(formData.get("city")||"").trim(),region:String(formData.get("region")||"").trim()||null,
    postalCode:String(formData.get("postalCode")||"").trim()||null,country:String(formData.get("country")||"Pakistan").trim()
  })});revalidatePath("/customers/"+customerId);
}
export async function setCustomerTagsAction(customerId:string,formData:FormData){
  const {adminMutation}=await import("@/lib/admin-server");
  await adminMutation("/v1/admin/commerce/customers/"+customerId+"/tags",{method:"POST",body:JSON.stringify({tags:String(formData.get("tags")||"").split(",").map(x=>x.trim()).filter(Boolean)})});
  revalidatePath("/customers/"+customerId);
}
