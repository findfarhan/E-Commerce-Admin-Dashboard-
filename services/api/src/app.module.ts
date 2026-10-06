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

@Module({
  imports:[
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    MediaModule,
    ProductsModule,
    StorefrontModule,
    JobsModule,
    OrdersModule,
    CustomersModule,
    DashboardModule,
  ],
  controllers:[HealthController],
})
export class AppModule{}
