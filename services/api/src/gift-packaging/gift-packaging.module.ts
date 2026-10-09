import {Module} from "@nestjs/common";
import {GiftPackagingService} from "./gift-packaging.service";
import {AdminGiftPackagingController,PublicGiftPackagingController} from "./gift-packaging.controller";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
@Module({
 providers:[GiftPackagingService,AdminKeyGuard,PublicRateLimitGuard],
 controllers:[AdminGiftPackagingController,PublicGiftPackagingController],
 exports:[GiftPackagingService],
})
export class GiftPackagingModule{}
