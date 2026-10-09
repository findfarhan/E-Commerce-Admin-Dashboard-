import {Module} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {StorefrontAccountsController} from "./storefront-accounts.controller";
import {StorefrontAccountsService} from "./storefront-accounts.service";

@Module({controllers:[StorefrontAccountsController],providers:[StorefrontAccountsService,PublicRateLimitGuard],exports:[StorefrontAccountsService]})
export class StorefrontAccountsModule{}
