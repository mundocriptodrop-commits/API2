/*
  # Allow Public Access to Subscription Plans

  1. Changes
    - Add policy to allow anonymous (unauthenticated) users to view active subscription plans
    - This enables the landing page to display plans before users log in

  2. Security
    - Only active plans are visible to anonymous users
    - All other operations (insert, update, delete) remain restricted to admins
*/

-- Policy for anonymous users to read active plans
CREATE POLICY "Anonymous users can view active plans"
  ON subscription_plans
  FOR SELECT
  TO anon
  USING (is_active = true);
