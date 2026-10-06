import {Module} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {CheckoutController} from "./checkout.controller";
import {CheckoutService} from "./checkout.service";

@Module({controllers:[CheckoutController],providers:[CheckoutService,PublicRateLimitGuard],exports:[CheckoutService]})
export class CheckoutModule{}
