import {NextRequest,NextResponse} from "next/server";
import {ADMIN_SESSION_COOKIE,hasAdminPermission,verifyAdminSession} from "./lib/admin-session";

const permissions:Array<[RegExp,string]>=[
  [/^\/orders(?:\/|$)/,"orders.read"],
  [/^\/draft-orders(?:\/|$)/,"orders.write"],
  [/^\/returns(?:\/|$)/,"returns.read"],
  [/^\/payments(?:\/|$)/,"payments.read"],
  [/^\/customers(?:\/|$)/,"crm.read"],
  [/^\/products(?:\/|$)/,"catalog.read"],
  [/^\/collections(?:\/|$)/,"catalog.read"],
  [/^\/inventory(?:\/|$)/,"inventory.read"],
  [/^\/purchasing(?:\/|$)/,"purchasing.read"],
  [/^\/discounts(?:\/|$)/,"discounts.read"],
  [/^\/shipping(?:\/|$)/,"settings.read"],
  [/^\/analytics(?:\/|$)/,"analytics.read"],
  [/^\/audit(?:\/|$)/,"audit.read"],
  [/^\/notifications(?:\/|$)/,"notifications.read"],
  [/^\/team(?:\/|$)/,"team.manage"],
  [/^\/settings(?:\/|$)/,"settings.manage"],
];

export async function middleware(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path==="/login") return NextResponse.next();

  let session=null;
  try{
    session=await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  }catch{
    return new NextResponse("Admin session security is not configured.",{status:503,headers:{"Cache-Control":"no-store"}});
  }

  if(!session){
    const url=request.nextUrl.clone();
    url.pathname="/login";
    url.searchParams.set("next",path);
    return NextResponse.redirect(url);
  }

  const required=permissions.find(([pattern])=>pattern.test(path))?.[1];
  if(required&&!hasAdminPermission(session,required)){
    const url=request.nextUrl.clone();
    url.pathname="/";
    url.searchParams.set("access","denied");
    return NextResponse.redirect(url);
  }

  const response=NextResponse.next();
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  return response;
}

export const config={
  matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
