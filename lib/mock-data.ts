import type {
  Automation,
  Conversation,
  Customer,
  Order,
  Product,
  ProductMediaSet,
  ProductOption,
  ProductVariant,
  Store,
  SeoDocument,
  SalesChannel,
  ChannelListing,
} from "./types";

export const store: Store = {
  id:"store_jewelry",
  name:"Jewelry Store",
  domain:"jewelry-store-lime.vercel.app",
  platform:"custom",
  status:"healthy",
  currency:"PKR",
  timezone:"Asia/Karachi",
  ordersToday:38,
  revenueToday:842000,
  customers:2841,
  syncLagSeconds:4,
  lastSyncAt:"11:08"
};

export const orders: Order[] = [
  {id:"o1",storeId:store.id,number:"#JS-2048",customer:"Ayesha Khan",email:"ayesha@example.com",total:78000,status:"paid",paymentStatus:"paid",items:1,createdAt:"10:54"},
  {id:"o2",storeId:store.id,number:"#JS-2047",customer:"Mariam Ali",email:"mariam@example.com",total:124000,status:"fulfilled",paymentStatus:"paid",items:2,createdAt:"10:31"},
  {id:"o3",storeId:store.id,number:"#JS-2046",customer:"Zara Ahmed",email:"zara@example.com",total:96000,status:"paid",paymentStatus:"paid",items:1,createdAt:"09:21"},
  {id:"o4",storeId:store.id,number:"#JS-2045",customer:"Hiba Raza",email:"hiba@example.com",total:46000,status:"pending",paymentStatus:"pending",items:1,createdAt:"08:58"},
  {id:"o5",storeId:store.id,number:"#JS-2044",customer:"Sana Malik",email:"sana@example.com",total:156000,status:"fulfilled",paymentStatus:"paid",items:3,createdAt:"08:33"},
  {id:"o6",storeId:store.id,number:"#JS-2043",customer:"Noor Fatima",email:"noor@example.com",total:54000,status:"refunded",paymentStatus:"refunded",items:1,createdAt:"07:49"},
];

export const customers: Customer[] = [
  {id:"c1",storeId:store.id,name:"Ayesha Khan",email:"ayesha@example.com",segment:"vip",orders:9,lifetimeValue:682000,lastOrderAt:"Today"},
  {id:"c2",storeId:store.id,name:"Mariam Ali",email:"mariam@example.com",segment:"returning",orders:4,lifetimeValue:312000,lastOrderAt:"Today"},
  {id:"c3",storeId:store.id,name:"Zara Ahmed",email:"zara@example.com",segment:"returning",orders:3,lifetimeValue:244000,lastOrderAt:"Today"},
  {id:"c4",storeId:store.id,name:"Hiba Raza",email:"hiba@example.com",segment:"new",orders:1,lifetimeValue:46000,lastOrderAt:"Today"},
  {id:"c5",storeId:store.id,name:"Sana Malik",email:"sana@example.com",segment:"vip",orders:11,lifetimeValue:924000,lastOrderAt:"Today"},
  {id:"c6",storeId:store.id,name:"Noor Fatima",email:"noor@example.com",segment:"at_risk",orders:3,lifetimeValue:202000,lastOrderAt:"52 days ago"},
];

export const products: Product[] = [
  {id:"p1",storeId:store.id,sku:"JS-CEL",name:"Celestia Ring",inventory:126,price:78000,status:"active",sales30d:81,variantCount:30,mediaSetCount:6},
  {id:"p2",storeId:store.id,sku:"JS-NOO",name:"Noor Earrings",inventory:42,price:46000,status:"active",sales30d:63,variantCount:6,mediaSetCount:3},
  {id:"p3",storeId:store.id,sku:"JS-AUR",name:"Aurelia Pendant",inventory:24,price:54000,status:"active",sales30d:47,variantCount:6,mediaSetCount:3},
  {id:"p4",storeId:store.id,sku:"JS-SAH",name:"Sahar Ring",inventory:18,price:88000,status:"active",sales30d:34,variantCount:20,mediaSetCount:4},
  {id:"p5",storeId:store.id,sku:"JS-NOV",name:"Nova Band",inventory:31,price:62000,status:"active",sales30d:31,variantCount:15,mediaSetCount:3},
  {id:"p6",storeId:store.id,sku:"JS-LUM",name:"Luma Hoops",inventory:36,price:39000,status:"active",sales30d:28,variantCount:6,mediaSetCount:3},
  {id:"p7",storeId:store.id,sku:"JS-SOL",name:"Solace Chain",inventory:27,price:58000,status:"active",sales30d:24,variantCount:9,mediaSetCount:3},
  {id:"p8",storeId:store.id,sku:"JS-VEL",name:"Vela Gem Ring",inventory:11,price:96000,status:"active",sales30d:19,variantCount:20,mediaSetCount:4},
];

const celestiaOptions: ProductOption[] = [
  {
    id:"opt-metal",
    name:"Metal",
    isVisual:true,
    values:[
      {id:"metal-yellow",value:"Yellow Gold",swatchColor:"#D8B56A"},
      {id:"metal-white",value:"White Gold",swatchColor:"#D8DCE3"},
      {id:"metal-rose",value:"Rose Gold",swatchColor:"#D9A093"},
    ]
  },
  {
    id:"opt-stone",
    name:"Stone",
    isVisual:true,
    values:[
      {id:"stone-diamond",value:"Diamond",swatchColor:"#EAF7FF"},
      {id:"stone-emerald",value:"Emerald",swatchColor:"#14885F"},
    ]
  },
  {
    id:"opt-size",
    name:"Size",
    isVisual:false,
    values:["5","6","7","8","9"].map(value=>({id:`size-${value}`,value}))
  }
];

const mediaImages = {
  yellowDiamond:[
    "https://images.pexels.com/photos/1457801/pexels-photo-1457801.jpeg?auto=compress&cs=tinysrgb&w=900",
    "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?auto=compress&cs=tinysrgb&w=900",
    "https://images.pexels.com/photos/106677/pexels-photo-106677.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
  whiteDiamond:[
    "https://images.pexels.com/photos/691046/pexels-photo-691046.jpeg?auto=compress&cs=tinysrgb&w=900",
    "https://images.pexels.com/photos/2735981/pexels-photo-2735981.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
  roseDiamond:[
    "https://images.pexels.com/photos/1721937/pexels-photo-1721937.jpeg?auto=compress&cs=tinysrgb&w=900",
    "https://images.pexels.com/photos/12026053/pexels-photo-12026053.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
  yellowEmerald:[
    "https://images.pexels.com/photos/9428799/pexels-photo-9428799.jpeg?auto=compress&cs=tinysrgb&w=900",
    "https://images.pexels.com/photos/9428808/pexels-photo-9428808.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
  whiteEmerald:[
    "https://images.pexels.com/photos/9428810/pexels-photo-9428810.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
  roseEmerald:[
    "https://images.pexels.com/photos/9428798/pexels-photo-9428798.jpeg?auto=compress&cs=tinysrgb&w=900",
  ],
};

const celestiaMediaSets: ProductMediaSet[] = [
  {id:"ms-yd",productId:"p1",name:"Yellow Gold + Diamond",matchOptions:{Metal:"Yellow Gold",Stone:"Diamond"},imageUrls:mediaImages.yellowDiamond,isDefault:true},
  {id:"ms-wd",productId:"p1",name:"White Gold + Diamond",matchOptions:{Metal:"White Gold",Stone:"Diamond"},imageUrls:mediaImages.whiteDiamond},
  {id:"ms-rd",productId:"p1",name:"Rose Gold + Diamond",matchOptions:{Metal:"Rose Gold",Stone:"Diamond"},imageUrls:mediaImages.roseDiamond},
  {id:"ms-ye",productId:"p1",name:"Yellow Gold + Emerald",matchOptions:{Metal:"Yellow Gold",Stone:"Emerald"},imageUrls:mediaImages.yellowEmerald},
  {id:"ms-we",productId:"p1",name:"White Gold + Emerald",matchOptions:{Metal:"White Gold",Stone:"Emerald"},imageUrls:mediaImages.whiteEmerald},
  {id:"ms-re",productId:"p1",name:"Rose Gold + Emerald",matchOptions:{Metal:"Rose Gold",Stone:"Emerald"},imageUrls:mediaImages.roseEmerald},
];

const mediaSetFor = (metal:string,stone:string) => {
  const shortMetal = metal.startsWith("Yellow") ? "y" : metal.startsWith("White") ? "w" : "r";
  const shortStone = stone === "Diamond" ? "d" : "e";
  return `ms-${shortMetal}${shortStone}`;
};

const metalCode = (metal:string) => metal.startsWith("Yellow") ? "YG" : metal.startsWith("White") ? "WG" : "RG";
const stoneCode = (stone:string) => stone === "Diamond" ? "DIA" : "EMR";

const celestiaVariants: ProductVariant[] = celestiaOptions[0].values.flatMap(metal =>
  celestiaOptions[1].values.flatMap(stone =>
    celestiaOptions[2].values.map((size,index)=>({
      id:`var-${metal.id}-${stone.id}-${size.value}`,
      productId:"p1",
      sku:`CEL-${metalCode(metal.value)}-${stoneCode(stone.value)}-${size.value}`,
      title:`${metal.value} / ${stone.value} / Size ${size.value}`,
      price: stone.value === "Emerald" ? 92000 : 78000,
      inventory: Math.max(0,8-index-(stone.value === "Emerald" ? 2 : 0)),
      selectedOptions:{Metal:metal.value,Stone:stone.value,Size:size.value},
      status:"active" as const,
    }))
  )
);

export const productOptionsByProduct: Record<string,ProductOption[]> = { p1: celestiaOptions };
export const productVariantsByProduct: Record<string,ProductVariant[]> = { p1: celestiaVariants };
export const productMediaSetsByProduct: Record<string,ProductMediaSet[]> = { p1: celestiaMediaSets };

export const conversations: Conversation[] = [
  {id:"m1",storeId:store.id,customer:"Ayesha Khan",channel:"website",subject:"Ring sizing before checkout",preview:"I normally wear size 7 but this band looks slightly wider...",unread:true,priority:"high",updatedAt:"2m"},
  {id:"m2",storeId:store.id,customer:"Mariam Ali",channel:"instagram",subject:"Custom metal request",preview:"Can the Celestia Ring be made in white gold instead?",unread:true,priority:"normal",updatedAt:"7m"},
  {id:"m3",storeId:store.id,customer:"Zara Ahmed",channel:"whatsapp",subject:"Gift packaging",preview:"I want this delivered as an anniversary gift. Can I add a private note?",unread:false,priority:"normal",updatedAt:"18m"},
  {id:"m4",storeId:store.id,customer:"Sana Malik",channel:"email",subject:"Private fitting follow-up",preview:"I compared both rings and would like help deciding between the two.",unread:true,priority:"high",updatedAt:"24m"},
];

export const automations: Automation[] = [
  {id:"a1",storeId:store.id,name:"High-value order alert",trigger:"Order > Rs. 100,000",action:"Create priority task + notify owner",status:"active",runs30d:46,successRate:100},
  {id:"a2",storeId:store.id,name:"Low-stock warning",trigger:"Inventory <= 3",action:"Create restock task",status:"active",runs30d:12,successRate:100},
  {id:"a3",storeId:store.id,name:"VIP customer tag",trigger:"LTV > Rs. 500,000",action:"Add VIP segment",status:"active",runs30d:9,successRate:100},
  {id:"a4",storeId:store.id,name:"Cart follow-up",trigger:"Checkout abandoned",action:"Queue follow-up message",status:"draft",runs30d:0,successRate:0},
  {id:"a5",storeId:store.id,name:"Refund attention",trigger:"Refund created",action:"Create owner review task",status:"active",runs30d:6,successRate:100},
  {id:"a6",storeId:store.id,name:"Private fitting request",trigger:"Fitting requested",action:"Create inbox priority conversation",status:"active",runs30d:14,successRate:100},
];

export const recentEvents = [
  {icon:"order",title:"Order #JS-2048 paid",text:"Ayesha Khan · Celestia Ring · Rs. 78,000",time:"2m"},
  {icon:"message",title:"Sizing question received",text:"Website inbox · Ayesha Khan",time:"4m"},
  {icon:"product",title:"Inventory changed",text:"Vela Gem Ring · 12 → 11",time:"11m"},
  {icon:"customer",title:"Customer moved to VIP",text:"Sana Malik · LTV Rs. 924,000",time:"26m"},
  {icon:"automation",title:"Low-stock automation ran",text:"Noor Earrings · restock task created",time:"42m"},
];

export const pipeline = [
  {label:"New",value:148,color:"#8b7cff"},
  {label:"Returning",value:92,color:"#61d7ff"},
  {label:"VIP",value:38,color:"#56d49b"},
  {label:"At risk",value:26,color:"#f0b45d"},
  {label:"Dormant",value:18,color:"#ff7a91"},
];

export const storefrontHealth = [
  {label:"Vercel storefront",value:"Healthy",detail:"200 · 184ms",tone:"success"},
  {label:"Render API",value:"Healthy",detail:"200 · 241ms",tone:"success"},
  {label:"Postgres",value:"Healthy",detail:"12 connections",tone:"success"},
  {label:"Webhook queue",value:"3 pending",detail:"oldest 18s",tone:"info"},
];

export const seoDocument: SeoDocument = {
  id:"seo-p1",storeId:store.id,resourceType:"product",resourceId:"p1",locale:"en-PK",
  title:"Celestia Ring | Jewelry Store",metaDescription:"Discover the Celestia Ring in gold and gemstone combinations with private fitting, insured delivery and lifetime care.",canonicalPath:"/product/celestia-ring",index:true,follow:true,socialImageUrl:null,schemaType:"Product",score:92,updatedAt:"Today"
};

export const salesChannels: SalesChannel[] = [
  {id:"ch-web",storeId:store.id,key:"online_store",name:"Online Store",type:"storefront",status:"connected",externalAccount:"jewelry-store-lime.vercel.app",catalogCount:8,lastSyncAt:"Live",capabilities:["catalog","orders","seo","content","checkout"]},
  {id:"ch-google",storeId:store.id,key:"google_merchant",name:"Google Merchant",type:"feed",status:"connected",externalAccount:"Merchant Center",catalogCount:8,lastSyncAt:"8m ago",capabilities:["catalog","variants","price","availability","images","taxonomy"]},
  {id:"ch-meta",storeId:store.id,key:"meta_catalog",name:"Meta Catalog",type:"social",status:"connected",externalAccount:"Meta Commerce",catalogCount:8,lastSyncAt:"12m ago",capabilities:["catalog","variants","price","availability","images"]},
  {id:"ch-instagram",storeId:store.id,key:"instagram",name:"Instagram",type:"social",status:"connected",externalAccount:"@jewelrystore",catalogCount:8,lastSyncAt:"12m ago",capabilities:["catalog","product_tags","messages"]},
  {id:"ch-whatsapp",storeId:store.id,key:"whatsapp",name:"WhatsApp",type:"messaging",status:"connected",externalAccount:"Business",catalogCount:8,lastSyncAt:"19m ago",capabilities:["catalog","messages","deep_links"]},
  {id:"ch-email",storeId:store.id,key:"email",name:"Email",type:"messaging",status:"connected",externalAccount:"CRM audience",catalogCount:8,lastSyncAt:"Live",capabilities:["segments","product_blocks","automations"]},
];

export const channelListings: ChannelListing[] = products.flatMap((product,index)=>
  salesChannels.slice(0,5).map(channel=>({
    id:`listing-${channel.id}-${product.id}`,storeId:store.id,channelId:channel.id,productId:product.id,
    status:(index===7 && channel.key==="google_merchant" ? "pending" : "published") as ChannelListing["status"],
    externalId:`${channel.key}-${product.sku.toLowerCase()}`,
    titleOverride:channel.key==="google_merchant" ? `${product.name} | ${product.sku}` : null,
    descriptionOverride:null,categoryExternalId:channel.key==="google_merchant" ? "188" : null,priceOverride:null,
    mediaSetId:product.id==="p1" ? "ms-yd" : null,
    syncStatus:(index===7 && channel.key==="google_merchant" ? "pending" : "synced") as ChannelListing["syncStatus"],lastSyncAt:channel.lastSyncAt,error:null,
  }))
);

export const channelSummary = [
  {label:"Published products",value:"8 / 8",detail:"Online Store"},
  {label:"Feed issues",value:"0",detail:"Website channel"},
  {label:"Unmapped variants",value:"0",detail:"Canonical catalog"},
  {label:"External channels",value:"4",detail:"Ready to connect"},
];

export const seoPillars = [
  {key:"core",name:"On-page SEO",description:"Titles, descriptions, headings, content intent and internal linking.",status:"healthy",score:94,primaryMetric:"18/18 indexable resources",nextAction:"Improve 2 product titles"},
  {key:"technical",name:"Technical SEO",description:"Crawlability, canonical rules, sitemap, mobile quality and performance signals.",status:"healthy",score:92,primaryMetric:"0 canonical conflicts",nextAction:"Run performance audit after image migration"},
  {key:"off_page",name:"Off-page authority",description:"Earned backlinks, brand mentions, digital PR and citation tracking.",status:"attention",score:61,primaryMetric:"7 verified mentions",nextAction:"Qualify 6 relevant editorial prospects"},
  {key:"geo_ai",name:"GEO / AI search",description:"Citation-ready answers, structured facts, source clarity and question coverage for generative search.",status:"attention",score:78,primaryMetric:"14/22 priority questions covered",nextAction:"Publish gemstone sourcing explainer"},
  {key:"entity",name:"Brand entity",description:"Consistent business facts, profiles, identifiers and authoritative references.",status:"attention",score:76,primaryMetric:"9/12 facts verified",nextAction:"Verify official social profiles"},
  {key:"ecommerce",name:"E-commerce SEO",description:"Product/variant schema, category intent, reviews, feeds and faceted-index controls.",status:"healthy",score:93,primaryMetric:"8/8 products feed-ready",nextAction:"Add review schema after reviews launch"},
  {key:"local",name:"Local SEO",description:"Business profile, NAP consistency, local landing pages and local citations when applicable.",status:"not_configured",score:null,primaryMetric:"No physical location configured",nextAction:"Enable only if the store serves a public location"},
  {key:"visual",name:"Visual search",description:"Alt text, focal crops, semantic media metadata and image discovery readiness.",status:"healthy",score:90,primaryMetric:"96% media metadata coverage",nextAction:"Add descriptive captions to 4 editorial images"},
  {key:"video",name:"Video SEO",description:"Video metadata, transcripts, captions, thumbnails and channel publishing fields.",status:"future",score:null,primaryMetric:"No video library yet",nextAction:"Activate when product videos are uploaded"},
  {key:"voice",name:"Voice / conversational",description:"Natural-language question targets and concise answer resources.",status:"attention",score:72,primaryMetric:"8/12 query clusters covered",nextAction:"Add sizing and gifting Q&A blocks"},
  {key:"aso",name:"App Store Optimization",description:"Store listing metadata, screenshots, localization and release notes for future mobile apps.",status:"future",score:null,primaryMetric:"No app channel connected",nextAction:"Keep dormant until mobile app phase"},
  {key:"community",name:"Community presence",description:"Track authentic Reddit, Quora and forum mentions without synthetic engagement.",status:"attention",score:58,primaryMetric:"3 relevant organic discussions",nextAction:"Prepare expert-answer briefs for real questions"},
] as const;

export const seoWorkItems = [
  {id:"seo-task-1",pillar:"geo_ai",title:"Answer: how to choose ring metal for daily wear",reason:"High-value commercial question with weak first-party coverage.",priority:"high",status:"open",resource:"Journal brief",owner:"Content"},
  {id:"seo-task-2",pillar:"visual",title:"Improve alt text on four collection hero assets",reason:"Current alt text describes the layout but not the jewelry/material clearly enough.",priority:"medium",status:"in_progress",resource:"Collection media",owner:"Catalog"},
  {id:"seo-task-3",pillar:"off_page",title:"Review six editorial backlink prospects",reason:"Relevant design/jewelry publications mention adjacent topics but not the brand.",priority:"medium",status:"open",resource:"Authority queue",owner:"Growth"},
  {id:"seo-task-4",pillar:"voice",title:"Add concise sizing Q&A answer block",reason:"Conversational sizing questions appear across inbox and search-intent research.",priority:"medium",status:"open",resource:"Sizing guide",owner:"Content"},
  {id:"seo-task-5",pillar:"ecommerce",title:"Validate variant identifier completeness",reason:"Merchant feeds perform better operationally when SKU/GTIN/MPN policies are explicit.",priority:"high",status:"done",resource:"Catalog",owner:"Catalog"},
] as const;

export const entityFacts = [
  {id:"entity-1",field:"Brand name",value:"JEWELRY STORE",source:"website",verified:true},
  {id:"entity-2",field:"Primary category",value:"Jewelry",source:"website",verified:true},
  {id:"entity-3",field:"Canonical domain",value:"jewelry-store-lime.vercel.app",source:"website",verified:true},
  {id:"entity-4",field:"Primary market",value:"Pakistan + worldwide online",source:"website",verified:false},
  {id:"entity-5",field:"Official social profiles",value:"Awaiting verified URLs",source:"social",verified:false},
] as const;

export const authorityMentions = [
  {id:"mention-1",source:"Design publication",type:"brand_mention",url:null,status:"prospect",quality:"high",discoveredAt:"Today"},
  {id:"mention-2",source:"Independent style blog",type:"backlink",url:"https://example.com/editorial",status:"verified",quality:"medium",discoveredAt:"2d ago"},
  {id:"mention-3",source:"Reddit jewelry discussion",type:"community",url:"https://reddit.com/",status:"needs_review",quality:"medium",discoveredAt:"4d ago"},
  {id:"mention-4",source:"Customer review profile",type:"review",url:null,status:"verified",quality:"high",discoveredAt:"5d ago"},
] as const;

export const mediaSeoItems = [
  {id:"media-seo-1",resource:"Celestia Ring / primary",mediaType:"image",altText:"Celestia diamond ring in 18K gold on a dark reflective surface",caption:"Celestia Ring — 18K gold and diamond",transcriptStatus:"not_applicable",score:98},
  {id:"media-seo-2",resource:"Gemstone collection hero",mediaType:"image",altText:"Blue gemstone ring editorial",caption:null,transcriptStatus:"not_applicable",score:82},
  {id:"media-seo-3",resource:"Future product film",mediaType:"video",altText:null,caption:null,transcriptStatus:"missing",score:35},
] as const;

export const voiceQueryTargets = [
  {id:"voice-1",query:"Which gold is best for an everyday ring?",intent:"commercial",answerResource:"/journal/gold-for-everyday-wear",covered:true},
  {id:"voice-2",query:"How do I know my ring size at home?",intent:"support",answerResource:"/guides/ring-sizing",covered:false},
  {id:"voice-3",query:"What jewelry should I gift for an anniversary?",intent:"commercial",answerResource:"/collections/gifts",covered:true},
  {id:"voice-4",query:"Where can I get a custom ring made?",intent:"local",answerResource:"/custom",covered:false},
] as const;
