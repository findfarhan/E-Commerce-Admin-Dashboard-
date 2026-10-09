import {CanActivate,ExecutionContext,Injectable,HttpException,HttpStatus} from "@nestjs/common";

type Bucket={count:number;resetAt:number};

@Injectable()
export class PublicRateLimitGuard implements CanActivate{
  private readonly buckets=new Map<string,Bucket>();
  private readonly windowMs=60_000;
  private readonly defaultMax=Number(process.env.PUBLIC_RATE_LIMIT_PER_MINUTE||120);
  private calls=0;

  private maxForRoute(route:string){
    if(route.includes("account/login")) return 8;
    if(route.includes("account/register")) return 5;
    if(route.includes("account/claim-order")) return 12;
    if(route.includes("account/reviews")) return 30;
    if(route.includes("account")) return 40;
    if(route.includes("order-lookup")) return 12;
    if(route.includes("commissions")) return 8;
    if(route.includes("newsletter")) return 10;
    if(route.includes("checkout")) return 30;
    if(route.includes("search")) return 90;
    return this.defaultMax;
  }

  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    const forwarded=String(request.headers?.["x-forwarded-for"]||"").split(",")[0].trim();
    const ip=forwarded||request.ip||"unknown";
    const route=request.routeOptions?.url||String(request.url||"route").split("?")[0];
    const key=ip+":"+route;
    const now=Date.now();
    const current=this.buckets.get(key);

    this.calls+=1;
    if(this.calls%500===0){
      for(const [bucketKey,bucket] of this.buckets.entries()){
        if(bucket.resetAt<=now) this.buckets.delete(bucketKey);
      }
    }

    if(!current||current.resetAt<=now){
      this.buckets.set(key,{count:1,resetAt:now+this.windowMs});
      return true;
    }

    current.count+=1;
    if(current.count>this.maxForRoute(route)){
      throw new HttpException("Too many requests. Please try again shortly.",HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
