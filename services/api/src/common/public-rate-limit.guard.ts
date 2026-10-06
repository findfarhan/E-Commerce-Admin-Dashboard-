import {CanActivate,ExecutionContext,Injectable,HttpException,HttpStatus} from "@nestjs/common";

type Bucket={count:number;resetAt:number};

@Injectable()
export class PublicRateLimitGuard implements CanActivate{
  private readonly buckets=new Map<string,Bucket>();
  private readonly windowMs=60_000;
  private readonly max=Number(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE||120);

  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    const forwarded=String(request.headers?.["x-forwarded-for"]||"").split(",")[0].trim();
    const ip=forwarded||request.ip||"unknown";
    const route=request.routeOptions?.url||String(request.url||"route").split("?")[0];
    const key=ip+":"+route;
    const now=Date.now();
    const current=this.buckets.get(key);
    if(!current||current.resetAt<=now){
      this.buckets.set(key,{count:1,resetAt:now+this.windowMs});
      return true;
    }
    current.count+=1;
    if(current.count>this.max) throw new HttpException("Too many requests. Please try again shortly.",HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
