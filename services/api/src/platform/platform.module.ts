import {Module} from "@nestjs/common";
import {CatalogPlatformService} from "./catalog-platform.service";
import {CrmPlatformService} from "./crm-platform.service";
import {FulfillmentPlatformService} from "./fulfillment-platform.service";
import {GovernanceService} from "./governance.service";
import {OrdersPlatformService} from "./orders-platform.service";
import {PlatformController} from "./platform.controller";
import {PricingEngineService} from "./pricing-engine.service";
import {ProcurementPlatformService} from "./procurement-platform.service";
import {StoreContextService} from "./store-context.service";

@Module({
  controllers:[PlatformController],
  providers:[
    StoreContextService,
    GovernanceService,
    PricingEngineService,
    CatalogPlatformService,
    OrdersPlatformService,
    FulfillmentPlatformService,
    CrmPlatformService,
    ProcurementPlatformService,
  ],
  exports:[StoreContextService,GovernanceService,PricingEngineService,OrdersPlatformService,FulfillmentPlatformService],
})
export class PlatformModule{}
