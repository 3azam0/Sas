export const hrTables=`
CREATE TABLE IF NOT EXISTS hr_job_titles(
 organization_id text NOT NULL REFERENCES organizations(id),job_id uuid NOT NULL,name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 PRIMARY KEY(organization_id,job_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_job_title_name ON hr_job_titles(organization_id,lower(btrim(name)));
CREATE TABLE IF NOT EXISTS hr_devices(
 organization_id text NOT NULL REFERENCES organizations(id),device_id uuid NOT NULL,name text NOT NULL,
 token_hash text NOT NULL UNIQUE,active boolean NOT NULL DEFAULT true,revision integer NOT NULL DEFAULT 1,
 last_seen_at timestamptz,PRIMARY KEY(organization_id,device_id)
);
CREATE TABLE IF NOT EXISTS hr_employees(
 organization_id text NOT NULL,employee_id uuid NOT NULL,device_id uuid NOT NULL,badge text NOT NULL,
 name text NOT NULL,device_name text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',department text NOT NULL DEFAULT '',
 job_title text NOT NULL DEFAULT '',hire_date date,active boolean NOT NULL DEFAULT true,notes text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(organization_id,employee_id),UNIQUE(organization_id,device_id,badge),
 FOREIGN KEY(organization_id,device_id) REFERENCES hr_devices(organization_id,device_id)
);
CREATE TABLE IF NOT EXISTS hr_salaries(
 organization_id text NOT NULL,employee_id uuid NOT NULL,state jsonb NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(organization_id,employee_id),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id)
);
CREATE TABLE IF NOT EXISTS hr_advances(
 organization_id text NOT NULL,advance_id uuid NOT NULL,employee_id uuid NOT NULL,state jsonb NOT NULL,
 PRIMARY KEY(organization_id,advance_id),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id)
);
CREATE INDEX IF NOT EXISTS hr_advance_employee ON hr_advances(organization_id,employee_id);
CREATE TABLE IF NOT EXISTS hr_advance_repayments(
 organization_id text NOT NULL,repayment_id uuid NOT NULL,advance_id uuid NOT NULL,state jsonb NOT NULL,
 PRIMARY KEY(organization_id,repayment_id),FOREIGN KEY(organization_id,advance_id) REFERENCES hr_advances(organization_id,advance_id)
);
CREATE INDEX IF NOT EXISTS hr_repayment_advance ON hr_advance_repayments(organization_id,advance_id);
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
CREATE TABLE IF NOT EXISTS hr_punches(
 organization_id text NOT NULL,device_id uuid NOT NULL,event_key text NOT NULL,badge text NOT NULL,
 local_time timestamp NOT NULL,verify_mode integer NOT NULL,in_out_mode integer NOT NULL,work_code integer NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,device_id,event_key),
 FOREIGN KEY(organization_id,device_id) REFERENCES hr_devices(organization_id,device_id)
);
CREATE INDEX IF NOT EXISTS hr_punches_date ON hr_punches(organization_id,local_time,device_id,event_key);
CREATE TABLE IF NOT EXISTS hr_daily_corrections(
 organization_id text NOT NULL,device_id uuid NOT NULL,badge text NOT NULL,attendance_day date NOT NULL,
 entry_event_key text,exit_event_key text,skipped_event_key text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 2 AND 500),recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,device_id,badge,attendance_day),
 FOREIGN KEY(organization_id,device_id,badge) REFERENCES hr_employees(organization_id,device_id,badge),
 FOREIGN KEY(organization_id,device_id,entry_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 FOREIGN KEY(organization_id,device_id,exit_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 FOREIGN KEY(organization_id,device_id,skipped_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 CONSTRAINT hr_daily_corrections_distinct_events CHECK(entry_event_key IS DISTINCT FROM exit_event_key
  AND (skipped_event_key IS NULL OR (skipped_event_key IS DISTINCT FROM entry_event_key AND skipped_event_key IS DISTINCT FROM exit_event_key)))
);
CREATE TABLE IF NOT EXISTS hr_upload_receipts(
 organization_id text NOT NULL,device_id uuid NOT NULL,batch_id uuid NOT NULL,payload_hash text NOT NULL,
 result jsonb NOT NULL,PRIMARY KEY(organization_id,device_id,batch_id),
 FOREIGN KEY(organization_id,device_id) REFERENCES hr_devices(organization_id,device_id)
);
`;
