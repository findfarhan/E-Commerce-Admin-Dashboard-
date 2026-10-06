import {NextRequest,NextResponse} from "next/server";

function unauthorized(message="Authentication required"){
  return new NextResponse(message,{
    status:401,
    headers:{
      "WWW-Authenticate":'Basic realm="Jewelry Control", charset="UTF-8"',
      "Cache-Control":"no-store",
    },
  });
}

export function middleware(request:NextRequest){
  const username=process.env.ADMIN_UI_USERNAME;
  const password=process.env.ADMIN_UI_PASSWORD;

  if(!username||!password){
    if(process.env.NODE_ENV!=="production") return NextResponse.next();
    return new NextResponse("Admin UI authentication is not configured.",{status:503,headers:{"Cache-Control":"no-store"}});
  }

  const auth=request.headers.get("authorization");
  if(!auth?.startsWith("Basic ")) return unauthorized();

  try{
    const decoded=atob(auth.slice(6));
    const separator=decoded.indexOf(":");
    const suppliedUser=separator>=0?decoded.slice(0,separator):"";
    const suppliedPassword=separator>=0?decoded.slice(separator+1):"";
    if(suppliedUser!==username||suppliedPassword!==password) return unauthorized("Invalid credentials");
  }catch{
    return unauthorized("Invalid authorization header");
  }

  const response=NextResponse.next();
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}

export const config={
  matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
