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
