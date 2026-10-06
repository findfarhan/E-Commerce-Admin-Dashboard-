import {Module} from "@nestjs/common";
import {DatabaseModule} from "../database/database.module";
import {AuthController} from "./auth.controller";
import {TeamController} from "./team.controller";
import {AuthService} from "./auth.service";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
@Module({imports:[DatabaseModule],controllers:[AuthController,TeamController],providers:[AuthService,PublicRateLimitGuard],exports:[AuthService]})
export class AuthModule{}
