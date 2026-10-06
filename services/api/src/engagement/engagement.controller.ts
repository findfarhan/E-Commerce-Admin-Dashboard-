import {Body,Controller,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {EngagementService} from "./engagement.service";

@Controller("v1/storefront")
@UseGuards(PublicRateLimitGuard)
export class StorefrontEngagementController{
  constructor(private readonly engagement:EngagementService){}

  @Post("newsletter")
  newsletter(@Body() body:any){return this.engagement.subscribe(body);}

  @Post("commissions")
  commission(@Body() body:any){return this.engagement.createCommission(body);}
}

@Controller("v1/admin/engagement")
@UseGuards(AdminKeyGuard)
export class AdminEngagementController{
  constructor(private readonly engagement:EngagementService){}

  @Get("commissions")
  commissions(){return this.engagement.listCommissions();}

  @Patch("commissions/:id")
  updateCommission(@Param("id") id:string,@Body() body:any){return this.engagement.updateCommission(id,body);}

  @Get("subscribers")
  subscribers(){return this.engagement.listSubscribers();}
}
