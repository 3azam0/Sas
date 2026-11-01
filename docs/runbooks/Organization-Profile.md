# Organization profile

Fodo is the shared platform identity. Each tenant's display name and optional `organizations.profile` JSON hold its English name, business type, city/country, postal address, main/additional telephone, WhatsApp, public email, map/Facebook links and logo path. The authenticated bootstrap returns only that tenant's validated profile. Empty profiles remain supported for existing local organizations.

The sidebar shows the tenant name and logo. Clicking المؤسسة الحالية opens the contact/profile dialog, with direct contact/map links. The home page keeps its operational overview without a profile card. Public contact email is separate from the Auth login. Profiles do not create branches, alter stock, change costing or rotate the workspace generation. Initial setup is handled by authorized administration; membership and profile-editing screens remain deferred.

Store logos at a content-versioned `/branding/*.webp` or `.png` path in `apps/web/public/branding`. Both local and hosted service-worker manifests include these assets. Brand-image paths are restricted to same-origin assets; external contact links require HTTPS. Keep original high-resolution artwork outside the runtime bundle and use an optimized web copy.

The approved first-client public details are recorded in [wahat-awlad-saed.json](../clients/wahat-awlad-saed.json). Apply them only to the verified client's tenant. Do not seed them into unrelated organizations or replace Fodo's shared login, favicon or platform name. Provisioned authentication credentials remain private and unchanged.
