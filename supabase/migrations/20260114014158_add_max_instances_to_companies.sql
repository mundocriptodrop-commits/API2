/*
  # Add max_instances to companies table

  1. Changes
    - Add `max_instances` column to `companies` table with default value of 1

  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'max_instances'
  ) THEN
    ALTER TABLE companies ADD COLUMN max_instances integer NOT NULL DEFAULT 1;
  END IF;
END $$;