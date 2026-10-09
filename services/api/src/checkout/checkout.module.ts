import {Module} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {CheckoutController} from "./checkout.controller";
import {CheckoutService} from "./checkout.service";
import {CollectionsModule} from "../collections/collections.module";
import {BundlesModule} from "../bundles/bundles.module";
import {GiftPackagingModule} from "../gift-packaging/gift-packaging.module";

@Module({imports:[CollectionsModule,BundlesModule,GiftPackagingModule],controllers:[CheckoutController],providers:[CheckoutService,PublicRateLimitGuard],exports:[CheckoutService]})
export class CheckoutModule{}
