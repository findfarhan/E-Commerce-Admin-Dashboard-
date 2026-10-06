export const renditionPresets=[
  {key:"admin_thumb",width:160,height:160,fit:"cover",formats:["webp"]},
  {key:"store_thumb",width:320,height:320,fit:"cover",formats:["webp","avif"]},
  {key:"card_mobile",width:640,height:800,fit:"cover",formats:["webp","avif"]},
  {key:"card_desktop",width:900,height:1125,fit:"cover",formats:["webp","avif"]},
  {key:"pdp_mobile",width:900,height:1125,fit:"cover",formats:["webp","avif"]},
  {key:"pdp_desktop",width:1200,height:1500,fit:"cover",formats:["webp","avif"]},
  {key:"zoom",width:2000,height:2500,fit:"inside",formats:["webp"]},
  {key:"hero_mobile",width:1080,height:1350,fit:"cover",formats:["webp","avif"]},
  {key:"hero_desktop",width:1920,height:1080,fit:"cover",formats:["webp","avif"]},
  {key:"social_og",width:1200,height:630,fit:"cover",formats:["webp"]},
] as const;
