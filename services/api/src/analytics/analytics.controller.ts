import {Body,Controller,Get,Post,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {AnalyticsService} from "./analytics.service";
@Controller("v1/storefront/analytics")
@UseGuards(PublicRateLimitGuard)
export class PublicAnalyticsController{
 constructor(private readonly analytics:AnalyticsService){}
 @Post("events") event(@Body() body:any){return this.analytics.record(body);}
}
@Controller("v1/admin/conversion")
@UseGuards(AdminKeyGuard)
export class AdminConversionController{
 constructor(private readonly analytics:AnalyticsService){}
 @Get("overview") overview(){return this.analytics.overview();}
}
