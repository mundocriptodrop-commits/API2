/*
  # Update System Settings RLS Policies

  ## Overview
  Updates RLS policies to allow authenticated users to read system settings.
  This is necessary because clients need to read the WhatsApp admin token to create instances.

  ## Changes
  - Drop existing "Admins can view settings" policy
  - Create new "Authenticated users can view settings" policy
  - Keep admin-only policies for insert, update, delete

  ## Security Notes
  - Reading settings is safe for authenticated users
  - Only admins can modify settings
  - The WhatsApp admin token needs to be accessible to clients to create instances
*/

-- Drop existing restrictive read policy
DROP POLICY IF EXISTS "Admins can view settings" ON system_settings;

-- Create new policy allowing all authenticated users to read settings
CREATE POLICY "Authenticated users can view settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);