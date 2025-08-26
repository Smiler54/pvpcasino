-- Fix the coinflip test by using valid transaction type
-- First let's see what transaction types are allowed and add coinflip types

-- Add coinflip transaction types to the existing constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add new constraint with coinflip transaction types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN (
  'credit_purchase', 
  'withdrawal_request', 
  'jackpot_tickets', 
  'jackpot_win', 
  'level_reward', 
  'admin_action', 
  'admin_bootstrap',
  'admin_privilege_grant',
  'coinflip_win',
  'coinflip_bet'
));