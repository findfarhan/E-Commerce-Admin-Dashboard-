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
import {PlatformModule} from "./platform/platform.module";

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
    PlatformModule,
    StorefrontModule,
    JobsModule,
    OrdersModule,
    CustomersModule,
    DashboardModule,
    CheckoutModule,
  ],
  controllers:[HealthController],
})
export class AppModule{}
