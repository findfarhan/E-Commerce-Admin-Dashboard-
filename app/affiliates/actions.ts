"use server";

import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function affiliateProgramAction(form:FormData){
  await adminMutation("/v1/admin/affiliates/settings",{
    method:"PATCH",
    body:JSON.stringify({
      enabled:form.get("enabled")==="on",
      defaultRate:Number(form.get("defaultRate")||10),
      cookieDays:Number(form.get("cookieDays")||30),
      holdDays:Number(form.get("holdDays")||14),
      minPayout:Number(form.get("minPayout")||2000),
    }),
  });
  revalidatePath("/affiliates");
}
export async function reviewAffiliateAction(id:string,form:FormData){
  await adminMutation("/v1/admin/affiliates/"+encodeURIComponent(id),{
    method:"PATCH",
    body:JSON.stringify({status:String(form.get("status")||"pending"),rate:Number(form.get("rate")||0)}),
  });
  revalidatePath("/affiliates");
}
export async function approveAffiliateCommissionAction(id:string){
  await adminMutation("/v1/admin/affiliates/commissions/"+encodeURIComponent(id)+"/approve",{method:"POST",body:"{}"});
  revalidatePath("/affiliates");
}
export async function reverseAffiliateCommissionAction(id:string,form:FormData){
  await adminMutation("/v1/admin/affiliates/commissions/"+encodeURIComponent(id)+"/reverse",{
    method:"POST",body:JSON.stringify({reason:String(form.get("reason")||"").trim()}),
  });
  revalidatePath("/affiliates");
}
export async function recordAffiliatePayoutAction(id:string,form:FormData){
  const ids=form.getAll("commissionIds").map(x=>String(x));
  if(!ids.length)throw new Error("Choose approved affiliate commissions first.");
  if(form.get("transferConfirmed")!=="on")throw new Error("Confirm the transfer was actually sent outside the dashboard.");
  await adminMutation("/v1/admin/affiliates/"+encodeURIComponent(id)+"/payouts",{
    method:"POST",
    body:JSON.stringify({
      commissionIds:ids,transferReference:String(form.get("transferReference")||"").trim(),
      transferConfirmed:true,
    }),
  });
  revalidatePath("/affiliates");
}
export async function reconcileAffiliateCommissionsAction(){
  await adminMutation("/v1/admin/affiliates/reconcile",{method:"POST",body:"{}"});
  revalidatePath("/affiliates");
}
