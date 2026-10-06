import {Module} from "@nestjs/common";
import {MediaModule} from "../media/media.module";
import {ProductsController} from "./products.controller";
import {ProductsService} from "./products.service";

@Module({
  imports:[MediaModule],
  controllers:[ProductsController],
  providers:[ProductsService],
  exports:[ProductsService],
})
export class ProductsModule{}
