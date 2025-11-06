/*
  # Fix WhatsApp Instances RLS Policies

  ## Overview
  Fixes RLS policies for whatsapp_instances to work with simplified profiles policies.

  ## Changes
  - Drop existing admin-checking policies
  - Keep only user-own-data policies
  - Simplifies security model to prevent recursion

  ## Security
  - Users can only access their own instances
  - Admin operations handled through application logic
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can view own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can insert all instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can insert own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can update all instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can update own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can delete all instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can delete own instances" ON whatsapp_instances;

-- Create new simplified policies
CREATE POLICY "Users can view own instances"
  ON whatsapp_instances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own instances"
  ON whatsapp_instances FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own instances"
  ON whatsapp_instances FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own instances"
  ON whatsapp_instances FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());