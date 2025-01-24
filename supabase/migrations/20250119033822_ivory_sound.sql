/*
  # Create saved plans table

  1. New Tables
    - `saved_plans`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, plan name)
      - `plan_data` (jsonb, stores the full itinerary data)
      - `created_at` (timestamp with timezone)
      - `destination` (text, for easy querying)
      - `start_date` (date, optional)
      - `end_date` (date, optional)

  2. Security
    - Enable RLS
    - Add policies for users to:
      - Insert their own plans
      - Read their own plans
      - Update their own plans
      - Delete their own plans
*/

-- Create the table
CREATE TABLE IF NOT EXISTS saved_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  plan_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  destination text NOT NULL,
  start_date date,
  end_date date,
  
  CONSTRAINT valid_date_range 
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Enable RLS
ALTER TABLE saved_plans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own plans"
  ON saved_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own plans"
  ON saved_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
  ON saved_plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
  ON saved_plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX saved_plans_user_id_idx ON saved_plans(user_id);
CREATE INDEX saved_plans_destination_idx ON saved_plans(destination);