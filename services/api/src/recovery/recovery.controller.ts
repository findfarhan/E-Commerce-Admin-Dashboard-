import {Body,Controller,Get,Headers,Param,Post,ServiceUnavailableException,UnauthorizedException,UseGuards} from "@nestjs/common";
import {timingSafeEqual} from "node:crypto";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {RecoveryService} from "./recovery.service";

@Controller("v1/storefront/recovery")
@UseGuards(PublicRateLimitGuard)
export class RecoveryPublicController{
 constructor(private readonly recovery:RecoveryService){}
 @Post(":id/redeem") redeem(@Param("id") id:string,@Body() body:any){return this.recovery.redeem(id,String(body?.token||""));}
 @Post(":id/unsubscribe") unsubscribe(@Param("id") id:string,@Body() body:any){return this.recovery.unsubscribe(id,String(body?.token||""));}
}

@Controller("v1/admin/recovery")
@UseGuards(AdminKeyGuard)
export class RecoveryAdminController{
 constructor(private readonly recovery:RecoveryService){}
 @Get("overview") dashboard(){return this.recovery.dashboard();}
}

@Controller("v1/internal/recovery")
export class RecoveryCronController{
 constructor(private readonly recovery:RecoveryService){}
 @Post("tick")
 async tick(@Headers("x-recovery-cron-secret") key:string|undefined){
  const secret=process.env.RECOVERY_CRON_SECRET||"";
  if(secret.length<32)throw new ServiceUnavailableException("External scheduler is not configured");
  const a=Buffer.from(String(key||"")),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new UnauthorizedException("Invalid scheduler credentials");
  await this.recovery.runRecovery();
  return {ok:true};
 }
}
