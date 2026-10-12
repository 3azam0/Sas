# FooDo brand identity

Approved name spelling requested by the user on 11 October 2026: **FooDo** — uppercase F and D, lowercase o. Use this capitalization in visible product text, browser titles, installed-app names and exported marketing materials.

The user accepted this logo on 12 October 2026. Use the assets below as the current platform identity. The generation record documents the artwork; it is not a trademark clearance or an editable vector master.

The logo combines a fused F/D monogram with a bowl detail and a geometric FooDo wordmark. The reference palette is burnt orange `#D94B20` and deep navy `#172A40`. Both supplied assets are transparent RGBA PNGs created with the built-in image-generation tool.

| Asset | File | Dimensions |
|---|---|---|
| Horizontal logo | `apps/web/public/branding/foodo-logo-v1.png` | 2172 × 724 |
| Compact mark | `apps/web/public/branding/foodo-icon-v1.png` | 1254 × 1254 |

`Brand.tsx` shares the logo between the workspace and sign-in/welcome screens. `brand.css` preserves its aspect ratio and transparent clear space. The compact mark appears during loading, in the browser favicon and in the installed-app manifest. Both assets are included by the local and hosted offline asset builders. Use a new versioned filename for future revisions because hosted branding files use immutable caching.

Tenant branding is separate: واحة أولاد سعد keeps its existing restaurant logo/profile. Technical service names, cookies, databases, environment variables, saved local addresses, recovery formats and historical records retain their existing identifiers for compatibility. This is a visual product rebrand, with no data migration.

## Generation record

Mode: built-in image generation. No CLI/API fallback was used. Original generated files were retained and copied into the repository; alpha transparency was verified. These are raster assets, not editable vector masters.

### Horizontal logo prompt

Use case: logo-brand. Create a distinctive premium brand identity logo for FooDo, a professional restaurant operations, inventory and cost-control SaaS used in Egypt and Arab countries. Deliver ONE finished horizontal logo, isolated on a genuinely transparent background, with a compact original monogram on the left and the exact wordmark FooDo on the right. Text verbatim: "FooDo" (F uppercase, o lowercase, o lowercase, D uppercase, o lowercase); crisp flawless spelling, bespoke geometric sans lettering, confident medium-heavy weight, carefully balanced kerning, polished small-size legibility. The mark should be an original fused F/D construction with softly rounded geometric corners and a subtle plate-shaped negative-space counter; thoughtful, restrained, memorable, not generic restaurant clipart. Use the existing app palette: deep midnight navy #172A40 for the wordmark, rich burnt orange #D94B20 for the monogram, with negative space transparent. Flat vector-style geometry, clean hard edges, elegant proportions. Mark and wordmark on one baseline, one single logo only. Wide approximately 3:1 composition, tightly framed with modest clear space, designed to sit in a white app sidebar. No tagline, no extra letters or text, no chef hat, no utensils, no flames, no mascot, no stock swooshes, no circle badge, no mockup, no stationery, no 3D, no gradients, no shadow, no border, no watermark. It should feel like a thoughtfully designed premium software brand, not a food delivery logo.

### Compact mark prompt

Use case: logo-brand. Edit the supplied FooDo logo into its compact app icon. Keep exactly the same orange fused F/D monogram with the small bowl shape inside, its silhouette, proportions, rounded corners and negative space. Remove the entire FooDo wordmark and all other content. Return only that single monogram, centered on a square genuinely transparent canvas with approximately 12% clear space on every side. Clean premium flat logo artwork: solid rich burnt orange #D94B20, sharp smooth edges, fully transparent negative spaces. Remove stray speckles around the mark and flatten any shading. No text, no tile or background, no gradients, no shadows, no mockup, no additional symbols. This must be recognizable as precisely the same brand mark from the supplied horizontal logo.
