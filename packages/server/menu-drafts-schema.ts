export const menuDraftTables=`
CREATE TABLE IF NOT EXISTS menu_catalog_drafts (
 organization_id text NOT NULL,
 kitchen_id text NOT NULL,
 source text NOT NULL,
 code text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,source,code),
 FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);
`;
