export const productionRecipeSourceTables=`
CREATE TABLE IF NOT EXISTS production_recipe_sources (
 organization_id text NOT NULL REFERENCES organizations(id),
 code text NOT NULL,
 source_row integer NOT NULL CHECK(source_row>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,code)
);
`;
