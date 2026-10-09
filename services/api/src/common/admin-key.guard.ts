import {CanActivate,ExecutionContext,Injectable,ServiceUnavailableException,UnauthorizedException,ForbiddenException} from "@nestjs/common";
import {createHmac,timingSafeEqual} from "node:crypto";

function requiredPermission(url:string){
  const path=String(url||"").split("?")[0];
  if(path.includes("/team")||path.includes("/settings")||path.includes("/audit")) return "admin";
  if(path.includes("/bundles")||path.includes("/products")||path.includes("/collections")||path.includes("/metafield")||path.includes("/media")) return "catalog";
  if(path.includes("/orders")||path.includes("/draft-orders")||path.includes("/returns")||path.includes("/payments")) return "orders";
  if(path.includes("/inventory")||path.includes("/purchase-orders")||path.includes("/suppliers")||path.includes("/locations")) return "inventory";
  if(path.includes("/customers")||path.includes("/inbox")||path.includes("/commissions")) return "crm";
  if(path.includes("/affiliates")) return "marketing";
  if(path.includes("/discount")||path.includes("/shipping")||path.includes("/tax")||path.includes("/seo")||path.includes("/channels")) return "marketing";
  if(path.includes("/analytics")||path.includes("/report")) return "analytics";
  return "dashboard";
}
function verifySession(token:string){
  const secret=process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_API_KEY;
  if(!secret) throw new ServiceUnavailableException("Admin authentication is not configured");
  try{
    const [body,sig]=String(token||"").split(".");
    if(!body||!sig) throw new Error("format");
    const expected=createHmac("sha256",secret).update(body).digest("base64url");
    const a=Buffer.from(sig),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b)) throw new Error("signature");
    const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
    if(!payload?.sub||!payload?.exp||Number(payload.exp)<Math.floor(Date.now()/1000)) throw new Error("expired");
    return payload;
  }catch{throw new UnauthorizedException("Invalid admin session");}
}
@Injectable()
export class AdminKeyGuard implements CanActivate{
  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    const configured=process.env.ADMIN_API_KEY;
    const supplied=request.headers["x-admin-key"];
    if(configured&&supplied===configured) return true;

    const authorization=String(request.headers["authorization"]||"");
    if(!authorization.toLowerCase().startsWith("bearer ")) throw new UnauthorizedException("Admin authentication required");
    const session=verifySession(authorization.slice(7).trim());
    const permissions:Array<string>=Array.isArray(session.permissions)?session.permissions:[];
    const needed=requiredPermission(request.url||request.raw?.url||"");
    const method=String(request.method||"GET").toUpperCase();
    if(permissions.includes("*")||(method==="GET"&&permissions.includes("read"))||permissions.includes(needed)){
      request.adminUser=session;
      return true;
    }
    throw new ForbiddenException("Missing permission: "+needed);
  }
}
