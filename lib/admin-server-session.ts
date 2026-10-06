import "server-only";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ADMIN_SESSION_COOKIE,hasAdminPermission,verifyAdminSession,type AdminSession} from "./admin-session";

export async function currentAdminSession():Promise<AdminSession|null>{
  const jar=await cookies();
  return verifyAdminSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
}
export async function requireAdminSession(){
  const session=await currentAdminSession();
  if(!session) redirect("/login");
  return session;
}
export async function requireAdminPermission(permission:string){
  const session=await requireAdminSession();
  if(!hasAdminPermission(session,permission)) throw new Error("You do not have permission: "+permission);
  return session;
}
