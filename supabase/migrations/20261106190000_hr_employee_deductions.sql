SET LOCAL search_path=fodo,pg_catalog;

CREATE TABLE IF NOT EXISTS hr_employee_deductions(
 organization_id text NOT NULL,
 deduction_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 amount numeric(11,2) NOT NULL CHECK(amount>0),
 deducted_on date NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 2 AND 500),
 PRIMARY KEY(organization_id,deduction_id),
 FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id)
);
CREATE INDEX IF NOT EXISTS hr_employee_deduction_date ON hr_employee_deductions(organization_id,employee_id,deducted_on DESC);

ALTER TABLE hr_employee_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_deductions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hr_employee_deductions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON hr_employee_deductions TO fodo_api;
CREATE POLICY tenant_scope ON hr_employee_deductions TO fodo_api
 USING(organization_id=current_setting('fodo.tenant',true))
 WITH CHECK(organization_id=current_setting('fodo.tenant',true));
