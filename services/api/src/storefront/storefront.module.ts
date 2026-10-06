import {Module} from "@nestjs/common";
import {ProductsModule} from "../products/products.module";
import {StorefrontController} from "./storefront.controller";
import {StorefrontService} from "./storefront.service";

@Module({imports:[ProductsModule],controllers:[StorefrontController],providers:[StorefrontService]})
export class StorefrontModule{}
