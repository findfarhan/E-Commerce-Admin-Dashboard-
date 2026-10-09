import {Module} from "@nestjs/common";
import {RecoveryService} from "./recovery.service";
import {RecoveryPublicController,RecoveryAdminController,RecoveryCronController} from "./recovery.controller";
import {CheckoutModule} from "../checkout/checkout.module";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
@Module({
 imports:[CheckoutModule],
 providers:[RecoveryService,PublicRateLimitGuard,AdminKeyGuard],
 controllers:[RecoveryPublicController,RecoveryAdminController,RecoveryCronController],
 exports:[RecoveryService],
})
export class RecoveryModule{}
