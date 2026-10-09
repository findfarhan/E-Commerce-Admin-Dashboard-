import {Body,Controller,Get,Headers,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {AffiliatesService} from "./affiliates.service";

function bearer(header?:string){
  const match=/^Bearer ([A-Za-z0-9_-]{25,200})$/i.exec(String(header||""));
  return match?.[1];
}
@Controller("v1/storefront/affiliate")
@UseGuards(PublicRateLimitGuard)
export class AffiliatePublicController{
  constructor(private readonly affiliates:AffiliatesService){}
  @Get("program") program(){return this.affiliates.program();}
  @Post("visit") visit(@Body() body:any){return this.affiliates.visit(body);}
  @Post("attach") attach(@Body() body:any){return this.affiliates.attach(body);}
}
@Controller("v1/storefront/account/affiliate")
@UseGuards(PublicRateLimitGuard)
export class AffiliateAccountController{
  constructor(private readonly affiliates:AffiliatesService){}
  @Get("dashboard") dashboard(@Headers("authorization") auth?:string){return this.affiliates.dashboard(bearer(auth));}
  @Post("apply") apply(@Headers("authorization") auth:string,@Body() body:any){return this.affiliates.apply(bearer(auth),body);}
  @Patch("payout-details") payoutDetails(@Headers("authorization") auth:string,@Body() body:any){return this.affiliates.payoutDetails(bearer(auth),body);}
}
@Controller("v1/admin/affiliates")
@UseGuards(AdminKeyGuard)
export class AffiliateAdminController{
  constructor(private readonly affiliates:AffiliatesService){}
  @Get() overview(){return this.affiliates.adminOverview();}
  @Patch("settings") settings(@Body() body:any){return this.affiliates.updateSettings(body);}
  @Patch(":id") affiliate(@Param("id") id:string,@Body() body:any){return this.affiliates.reviewAffiliate(id,body);}
  @Post("commissions/:id/approve") approve(@Param("id") id:string){return this.affiliates.approveCommission(id);}
  @Post("commissions/:id/reverse") reverse(@Param("id") id:string,@Body() body:any){return this.affiliates.reverseCommission(id,body);}
  @Post(":id/payouts") payout(@Param("id") id:string,@Body() body:any){return this.affiliates.recordPayout(id,body);}
  @Post("reconcile") reconcile(){return this.affiliates.reconcile();}
}
