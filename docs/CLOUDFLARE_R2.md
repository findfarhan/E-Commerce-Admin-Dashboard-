# Cloudflare R2 media

## Upload flow

1. Admin requests a signed master-upload URL from Render.
2. Render authorizes the product/media action.
3. Browser uploads the master directly to R2.
4. Admin calls finalize with the uploaded object key and metadata.
5. Render records the master asset and queues rendition generation.
6. Renditions are stored in R2.
7. Storefront API returns public/custom-domain rendition URLs.

## Keys

masters/{store_id}/products/{product_id}/{media_id}/original.ext

renditions/{store_id}/products/{product_id}/{media_id}/{preset}.{format}

## Security

R2 access key and secret belong only in Render environment variables.

The master bucket/path can remain private. Public storefront delivery should expose only generated renditions through a controlled public/custom domain.

## Focal point

Store focal_x and focal_y as normalized values. All crops use the same focal point unless a rendition-specific override is explicitly added.
