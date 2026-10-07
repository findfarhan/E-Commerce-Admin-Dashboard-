import {NextRequest,NextResponse} from "next/server";

function unauthorized(message="Authentication required"){
  return new NextResponse(message,{status:401,headers:{"WWW-Authenticate":'Basic realm="Jewelry Control", charset="UTF-8"',"Cache-Control":"no-store"}});
}
function forbidden(){return new NextResponse("You do not have permission to access this area.",{status:403,headers:{"Cache-Control":"no-store"}});}
function requiredPermission(path:string){
  if(path.startsWith("/team")||path.startsWith("/settings")||path.startsWith("/audit")) return "admin";
  if(path.startsWith("/products")||path.startsWith("/collections")||path.startsWith("/metafields")||path.startsWith("/api/media")) return "catalog";
  if(path.startsWith("/orders")||path.startsWith("/draft-orders")||path.startsWith("/returns")) return "orders";
  if(path.startsWith("/inventory")||path.startsWith("/purchasing")) return "inventory";
  if(path.startsWith("/customers")||path.startsWith("/inbox")||path.startsWith("/commissions")) return "crm";
  if(path.startsWith("/discounts")||path.startsWith("/shipping-tax")||path.startsWith("/seo")||path.startsWith("/channels")) return "marketing";
  if(path.startsWith("/analytics")) return "analytics";
  return "dashboard";
}
function authorized(permissions:string[],permission:string,method:string){
  if(permissions.includes("*")) return true;
  if(method==="GET"&&permissions.includes("read")) return true;
  return permissions.includes(permission);
}
function secureHeaders(response:NextResponse){
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  return response;
}

export async function middleware(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path==="/login"||path.startsWith("/login/")||path==="/setup"||path.startsWith("/setup/")) return secureHeaders(NextResponse.next());

  const token=request.cookies.get("jc_session")?.value;
  if(token){
    try{
      const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");
      const verification=await fetch(apiBase+"/v1/admin/auth/session",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      if(verification.ok){
        const result=await verification.json();
        const session=result.user||{};
        const permission=requiredPermission(path);
        if(!authorized(session.permissions||[],permission,request.method)) return forbidden();
        const headers=new Headers(request.headers);
        headers.set("x-admin-user-id",String(session.sub||""));
        headers.set("x-admin-user-email",String(session.email||""));
        return secureHeaders(NextResponse.next({request:{headers}}));
      }
    }catch{}
  }

  const username=process.env.ADMIN_UI_USERNAME;
  const password=process.env.ADMIN_UI_PASSWORD;
  if(!username||!password){
    if(process.env.NODE_ENV!=="production") return secureHeaders(NextResponse.next());
    return new NextResponse("Admin UI authentication is not configured.",{status:503,headers:{"Cache-Control":"no-store"}});
  }
  const auth=request.headers.get("authorization");
  if(!auth?.startsWith("Basic ")) return unauthorized();
  try{
    const decoded=atob(auth.slice(6));const separator=decoded.indexOf(":");
    const suppliedUser=separator>=0?decoded.slice(0,separator):"";const suppliedPassword=separator>=0?decoded.slice(separator+1):"";
    if(suppliedUser!==username||suppliedPassword!==password) return unauthorized("Invalid credentials");
  }catch{return unauthorized("Invalid authorization header");}
  return secureHeaders(NextResponse.next());
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]};
