import {CanActivate,ExecutionContext,Injectable,ServiceUnavailableException,UnauthorizedException} from "@nestjs/common";

@Injectable()
export class AdminKeyGuard implements CanActivate{
  canActivate(context:ExecutionContext){
    const configured=process.env.ADMIN_API_KEY;
    if(!configured) throw new ServiceUnavailableException("ADMIN_API_KEY is not configured");
    const request=context.switchToHttp().getRequest();
    const supplied=request.headers["x-admin-key"];
    if(supplied!==configured) throw new UnauthorizedException("Invalid admin key");
    return true;
  }
}
