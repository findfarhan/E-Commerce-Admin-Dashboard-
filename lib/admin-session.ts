export const ADMIN_SESSION_COOKIE="jewelry_admin_session";
export type AdminSession={
  sub:string;
  email:string;
  displayName:string;
  role:string;
  permissions:string[];
  exp:number;
};

const encoder=new TextEncoder();

function bytesToBase64Url(bytes:Uint8Array){
  let binary="";
  for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function base64UrlToBytes(value:string){
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function jsonEncode(value:any){return bytesToBase64Url(encoder.encode(JSON.stringify(value)));}
function jsonDecode<T>(value:string):T{
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}
async function key(secret:string){
  return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export function adminSessionSecret(){
  const secret=process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_API_KEY||"";
  if(!secret) throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY is required.");
  return secret;
}
export async function signAdminSession(session:AdminSession,secret=adminSessionSecret()){
  const payload=jsonEncode(session);
  const signature=new Uint8Array(await crypto.subtle.sign("HMAC",await key(secret),encoder.encode(payload)));
  return payload+"."+bytesToBase64Url(signature);
}
export async function verifyAdminSession(token:string|undefined|null,secret=adminSessionSecret()):Promise<AdminSession|null>{
  if(!token) return null;
  try{
    const [payload,signature,...extra]=token.split(".");
    if(!payload||!signature||extra.length) return null;
    const valid=await crypto.subtle.verify("HMAC",await key(secret),base64UrlToBytes(signature),encoder.encode(payload));
    if(!valid) return null;
    const session=jsonDecode<AdminSession>(payload);
    if(!session?.sub||!session?.role||!Array.isArray(session.permissions)||Number(session.exp)<=Date.now()) return null;
    return session;
  }catch{return null;}
}
export function hasAdminPermission(session:AdminSession|null,permission:string){
  return Boolean(session&&(session.permissions.includes("*")||session.permissions.includes(permission)));
}
