import "reflect-metadata";
import {NestFactory} from "@nestjs/core";
import {FastifyAdapter,NestFastifyApplication} from "@nestjs/platform-fastify";
import {AppModule} from "./app.module";
import {CloudflareR2Storage} from "./storage/cloudflare-r2.storage";
import {runR2ImageSmoke} from "./storage/r2-image-smoke";

async function bootstrap(){
  const app=await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({bodyLimit:1_048_576,trustProxy:true}),
    {logger:["log","warn","error"]}
  );

  const origins=[
    ...(process.env.ADMIN_ALLOWED_ORIGINS??"").split(","),
    ...(process.env.STOREFRONT_ALLOWED_ORIGINS??"").split(","),
    "http://localhost:3000",
  ].map(v=>v.trim()).filter(Boolean);

  app.enableCors({
    origin:(origin,cb)=>{
      if(!origin||origins.includes(origin)) return cb(null,true);
      cb(new Error("Origin not allowed"),false);
    },
    methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders:["Content-Type","Authorization","X-Admin-Key","Idempotency-Key"],
  });

  const server=app.getHttpAdapter().getInstance();
  server.addHook("onSend",async (_request:any,reply:any,payload:any)=>{
    reply.header("X-Content-Type-Options","nosniff");
    reply.header("X-Frame-Options","DENY");
    reply.header("Referrer-Policy","strict-origin-when-cross-origin");
    reply.header("Permissions-Policy","camera=(), microphone=(), geolocation=()");
    return payload;
  });

  app.enableShutdownHooks();
  const port=Number(process.env.PORT||3001);
  await app.listen(port,"0.0.0.0");
  // One-time opt-in smoke test: no new HTTP endpoints or catalog writes.
  if(process.env.R2_IMAGE_SMOKE_TEST==="1"){
    void runR2ImageSmoke(app.get(CloudflareR2Storage));
  }
}
bootstrap();
