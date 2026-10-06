"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function addCustomerNoteAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/customers/"+id+"/notes",{
    method:"POST",
    body:JSON.stringify({note:String(formData.get("note")||"").trim(),author:"admin"}),
  },"crm.write");
  revalidatePath("/customers/"+id);
}

export async function addCustomerAddressAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/customers/"+id+"/addresses",{method:"POST",body:JSON.stringify({
    addressType:String(formData.get("addressType")||"shipping"),
    label:String(formData.get("label")||"").trim()||null,
    recipientName:String(formData.get("recipientName")||"").trim()||null,
    phone:String(formData.get("phone")||"").trim()||null,
    line1:String(formData.get("line1")||"").trim(),
    line2:String(formData.get("line2")||"").trim()||null,
    city:String(formData.get("city")||"").trim(),
    region:String(formData.get("region")||"").trim()||null,
    postalCode:String(formData.get("postalCode")||"").trim()||null,
    country:String(formData.get("country")||"Pakistan").trim(),
    isDefaultShipping:formData.get("isDefaultShipping")==="on",
    isDefaultBilling:formData.get("isDefaultBilling")==="on",
  })},"crm.write");
  revalidatePath("/customers/"+id);
}
export async function setCustomerTagsAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/customers/"+id+"/tags",{method:"PUT",body:JSON.stringify({
    tags:String(formData.get("tags")||"").split(",").map(v=>v.trim()).filter(Boolean),
  })},"crm.write");
  revalidatePath("/customers/"+id);
}
export async function deleteCustomerAddressAction(id:string,addressId:string){
  await adminMutation("/v1/admin/customers/"+id+"/addresses/"+addressId,{method:"DELETE"},"crm.write");
  revalidatePath("/customers/"+id);
}
