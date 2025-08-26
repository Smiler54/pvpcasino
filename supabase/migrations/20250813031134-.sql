-- Add stripe_account_id to profiles table for bank withdrawals
ALTER TABLE public.profiles 
ADD COLUMN stripe_account_id TEXT;