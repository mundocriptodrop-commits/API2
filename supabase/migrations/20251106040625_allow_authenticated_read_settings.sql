/*
  # Allow authenticated users to read system settings

  ## Changes
  - Add policy to allow all authenticated users to read system_settings
  - This allows the WhatsApp API service to get the admin token

  ## Security
  - Only SELECT is allowed for all authenticated users
  - INSERT, UPDATE, DELETE remain restricted to admins
*/

-- Add policy to allow all authenticated users to read settings
CREATE POLICY "Authenticated users can read settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);