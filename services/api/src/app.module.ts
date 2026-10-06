import {Module} from "@nestjs/common";
import {ScheduleModule} from "@nestjs/schedule";
import {DatabaseModule} from "./database/database.module";
import {StorageModule} from "./storage/storage.module";
import {HealthController} from "./health/health.controller";
import {ProductsModule} from "./products/products.module";
import {StorefrontModule} from "./storefront/storefront.module";
import {MediaModule} from "./media/media.module";
import {JobsModule} from "./jobs/jobs.module";

@Module({
  imports:[
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    MediaModule,
    ProductsModule,
    StorefrontModule,
    JobsModule,
  ],
  controllers:[HealthController],
})
export class AppModule{}
