"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function updateStoreSettingsAction(formData:FormData){
  await adminMutation("/v1/admin/operations/settings",{
    method:"PATCH",
    body:JSON.stringify({
      name:String(formData.get("name")||"").trim(),
      currency:String(formData.get("currency")||"").trim(),
      timezone:String(formData.get("timezone")||"").trim(),
    }),
  });
  revalidatePath("/settings");
  revalidatePath("/");
}
