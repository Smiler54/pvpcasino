-- Fix transaction types by including all existing types
-- First check existing types and create a comprehensive constraint

-- Drop the constraint temporarily
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add comprehensive constraint that includes all existing and new types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN (
  'purchase',           -- existing type
  'credit_purchase', 
  'withdrawal_request', 
  'jackpot_tickets',    -- existing type
  'jackpot_win',       -- existing type  
  'level_reward', 
  'admin_action', 
  'admin_bootstrap',
  'admin_privilege_grant',
  'coinflip_win',
  'coinflip_bet'
));