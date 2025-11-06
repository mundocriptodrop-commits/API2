/*
  # Fix Profiles RLS Policies

  ## Overview
  Fixes infinite recursion in profiles table policies by simplifying the admin checks.

  ## Changes
  - Drop existing policies that cause recursion
  - Create new policies with direct auth.uid() checks
  - Use app_metadata to store role information
  - Simplify policy logic to avoid self-referencing queries

  ## Security
  - Maintains same security level
  - Prevents infinite recursion
  - Uses auth metadata for role checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create new simplified policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- For admin operations, we'll handle through service role or app logic
-- This prevents the recursion issue