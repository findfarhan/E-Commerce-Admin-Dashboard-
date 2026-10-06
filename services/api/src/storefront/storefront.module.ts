import {Module} from "@nestjs/common";
import {CollectionsModule} from "../collections/collections.module";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {ProductsModule} from "../products/products.module";
import {RedirectsModule} from "../redirects/redirects.module";
import {SeoModule} from "../seo/seo.module";
import {StorefrontController} from "./storefront.controller";
import {StorefrontService} from "./storefront.service";

@Module({
  imports:[ProductsModule,CollectionsModule,SeoModule,RedirectsModule],
  controllers:[StorefrontController],
  providers:[StorefrontService,PublicRateLimitGuard],
})
export class StorefrontModule{}
