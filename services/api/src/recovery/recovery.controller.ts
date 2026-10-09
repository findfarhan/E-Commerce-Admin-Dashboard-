import {Body,Controller,Get,Param,Post,UseGuards} from "@nestjs/common";
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
