import {Module} from "@nestjs/common";
import {PlatformController} from "./platform.controller";
import {PlatformService} from "./platform.service";
import {PricingEngineService} from "./pricing-engine.service";

@Module({
  controllers:[PlatformController],
  providers:[PlatformService,PricingEngineService],
  exports:[PlatformService,PricingEngineService],
})
export class PlatformModule{}
