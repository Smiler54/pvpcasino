-- Remove timer-related fields from jackpot_games table
ALTER TABLE public.jackpot_games 
DROP COLUMN IF EXISTS timer_end_at,
DROP COLUMN IF EXISTS initial_timer_seconds,
DROP COLUMN IF EXISTS timer_extension_seconds,
DROP COLUMN IF EXISTS max_additional_seconds;