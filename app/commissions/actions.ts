"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function updateCommissionStatusAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/engagement/commissions/"+encodeURIComponent(id),{
    method:"PATCH",
    body:JSON.stringify({status:String(formData.get("status")||"new")}),
  });
  revalidatePath("/commissions");
}
