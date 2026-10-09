import {Module} from "@nestjs/common";
import {AnalyticsService} from "./analytics.service";
import {PublicAnalyticsController,AdminConversionController} from "./analytics.controller";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
@Module({providers:[AnalyticsService,PublicRateLimitGuard,AdminKeyGuard],controllers:[PublicAnalyticsController,AdminConversionController],exports:[AnalyticsService]})
export class AnalyticsModule{}
