import "reflect-metadata";
import {NestFactory} from "@nestjs/core";
import {FastifyAdapter,NestFastifyApplication} from "@nestjs/platform-fastify";
import {AppModule} from "./app.module";

async function bootstrap(){
  const app=await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({bodyLimit:1_048_576}),
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
    allowedHeaders:["Content-Type","Authorization","X-Admin-Key"],
  });

  app.enableShutdownHooks();
  const port=Number(process.env.PORT||3001);
  await app.listen(port,"0.0.0.0");
}
bootstrap();
