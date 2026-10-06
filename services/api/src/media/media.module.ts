import {Module} from "@nestjs/common";
import {MediaController} from "./media.controller";
import {MediaService} from "./media.service";
import {ImageDeliveryService} from "./image-delivery.service";

@Module({
  controllers:[MediaController],
  providers:[MediaService,ImageDeliveryService],
  exports:[MediaService,ImageDeliveryService],
})
export class MediaModule{}
