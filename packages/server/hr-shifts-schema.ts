export const hrShiftTables=`
CREATE TABLE IF NOT EXISTS hr_shifts(organization_id text NOT NULL REFERENCES organizations(id),shift_id uuid NOT NULL,state jsonb NOT NULL,PRIMARY KEY(organization_id,shift_id));
CREATE TABLE IF NOT EXISTS hr_roster_events(organization_id text NOT NULL,employee_id uuid NOT NULL,business_date date NOT NULL,revision integer NOT NULL,state jsonb NOT NULL,actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,employee_id,business_date,revision),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id));
`;
