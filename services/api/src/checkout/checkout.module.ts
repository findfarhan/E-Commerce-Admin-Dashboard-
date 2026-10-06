import {Module} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {PlatformModule} from "../platform/platform.module";
import {CheckoutController} from "./checkout.controller";
import {CheckoutService} from "./checkout.service";

@Module({
  imports:[PlatformModule],
  controllers:[CheckoutController],
  providers:[CheckoutService,PublicRateLimitGuard],
  exports:[CheckoutService],
})
export class CheckoutModule{}
