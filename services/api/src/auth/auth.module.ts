import {Module} from "@nestjs/common";
import {DatabaseModule} from "../database/database.module";
import {AuthController} from "./auth.controller";
import {TeamController} from "./team.controller";
import {AuthService} from "./auth.service";
@Module({imports:[DatabaseModule],controllers:[AuthController,TeamController],providers:[AuthService],exports:[AuthService]})
export class AuthModule{}
