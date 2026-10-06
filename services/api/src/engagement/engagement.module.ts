import {Module} from "@nestjs/common";
import {AdminEngagementController,StorefrontEngagementController} from "./engagement.controller";
import {EngagementService} from "./engagement.service";

@Module({
  controllers:[StorefrontEngagementController,AdminEngagementController],
  providers:[EngagementService],
  exports:[EngagementService],
})
export class EngagementModule{}
