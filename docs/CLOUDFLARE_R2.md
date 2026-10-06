# Cloudflare media architecture

Cloudflare is the active media provider for the Jewelry Store phase.

## Current provider boundary

The backend does not let products depend directly on Cloudflare-specific URLs.

```
MediaService
  -> ObjectStorage interface
     -> CloudflareR2Storage
```

A future provider can implement the same `ObjectStorage` interface without changing products, variants, orders or storefront contracts.

## Upload flow

1. Admin asks Render for a master-image upload URL.
2. NestJS authorizes the product/media action.
3. NestJS signs one R2 PUT URL.
4. Browser uploads the original image directly to R2.
5. Admin finalizes the media record.
6. Storefront receives optimized image URLs.

R2 presigned uploads are used so Render Free does not proxy large image files.

## Image delivery modes

### Preferred: Cloudflare Image Resizing

When `CLOUDFLARE_IMAGE_RESIZING_BASE_URL` is configured, the system stores only the master in R2 and generates optimized URLs dynamically.

Example pattern:

```
https://media.example.com/cdn-cgi/image/width=900,height=1125,fit=cover,quality=82,format=auto,gravity=0.5x0.45/<source>
```

The focal point saved on `product_media` becomes Cloudflare `gravity=XxY`.

This avoids generating and storing many physical copies per master image.

### Fallback: pre-generated renditions

If Cloudflare Image Resizing is not enabled yet, the existing Render worker + Sharp path remains available.

It generates WebP/AVIF renditions into R2 using the same presets.

This fallback means the store can launch with R2 first and enable dynamic transformations later without changing product/media data.

## Object keys

```
masters/{store_id}/products/{product_id}/{media_id}/original.ext
renditions/{store_id}/products/{product_id}/{media_id}/{preset}.{format}
```

The second path is used only by the fallback physical-rendition mode.

## Presets

- admin_thumb
- store_thumb
- card_mobile
- card_desktop
- pdp_mobile
- pdp_desktop
- zoom
- hero_mobile
- hero_desktop
- social_og

## Security

Never expose these values to Vercel/browser code:

- CLOUDFLARE_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

They remain in Render environment variables only.

The browser receives only short-lived signed upload URLs and public delivery URLs.

## Future migration

If Cloudinary, S3 or another provider is needed later:

1. add a new `ObjectStorage` implementation
2. change `MEDIA_STORAGE_PROVIDER`
3. migrate object data separately if desired

Commerce records stay provider-neutral.
