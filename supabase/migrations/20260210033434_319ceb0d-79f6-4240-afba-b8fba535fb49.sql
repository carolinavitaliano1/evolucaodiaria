-- Add patient_id to tasks for patient-specific tasks
ALTER TABLE tasks ADD COLUMN patient_id uuid REFERENCES patients(id) ON DELETE CASCADE;