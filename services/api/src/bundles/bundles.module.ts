import {Module} from "@nestjs/common";
import {ProductsModule} from "../products/products.module";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {BundlesService} from "./bundles.service";
import {AdminBundlesController,PublicBundlesController} from "./bundles.controller";
@Module({
  imports:[ProductsModule],
  providers:[BundlesService,AdminKeyGuard,PublicRateLimitGuard],
  controllers:[AdminBundlesController,PublicBundlesController],
  exports:[BundlesService],
})
export class BundlesModule{}
