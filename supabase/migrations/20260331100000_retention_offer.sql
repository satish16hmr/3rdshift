-- Add retention_offer_used column to profiles (cancellation flow)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retention_offer_used boolean DEFAULT false;
