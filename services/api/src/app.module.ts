import {Module} from "@nestjs/common";
import {ScheduleModule} from "@nestjs/schedule";
import {DatabaseModule} from "./database/database.module";
import {StorageModule} from "./storage/storage.module";
import {HealthController} from "./health/health.controller";
import {ProductsModule} from "./products/products.module";
import {StorefrontModule} from "./storefront/storefront.module";
import {MediaModule} from "./media/media.module";
import {JobsModule} from "./jobs/jobs.module";
import {OrdersModule} from "./orders/orders.module";
import {CustomersModule} from "./customers/customers.module";
import {DashboardModule} from "./dashboard/dashboard.module";
import {CheckoutModule} from "./checkout/checkout.module";
import {CollectionsModule} from "./collections/collections.module";
import {InventoryModule} from "./inventory/inventory.module";
import {SeoModule} from "./seo/seo.module";
import {RedirectsModule} from "./redirects/redirects.module";
import {EngagementModule} from "./engagement/engagement.module";
import {OperationsModule} from "./operations/operations.module";
import {CommerceModule} from "./commerce/commerce.module";
import {AuthModule} from "./auth/auth.module";
import {StorefrontAccountsModule} from "./storefront-accounts/storefront-accounts.module";
import {AffiliatesModule} from "./affiliates/affiliates.module";
import {BundlesModule} from "./bundles/bundles.module";

@Module({
  imports:[
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    MediaModule,
    ProductsModule,
    CollectionsModule,
    InventoryModule,
    SeoModule,
    RedirectsModule,
    EngagementModule,
    OperationsModule,
    CommerceModule,
    AuthModule,
    StorefrontModule,
    StorefrontAccountsModule,
    AffiliatesModule,
    BundlesModule,
    JobsModule,
    OrdersModule,
    CustomersModule,
    DashboardModule,
    CheckoutModule,
  ],
  controllers:[HealthController],
})
export class AppModule{}
