-- Remove coinflip game related tables and functions
DROP TABLE IF EXISTS game_matches CASCADE;
DROP TABLE IF EXISTS game_offers CASCADE;

-- Remove any RPC functions related to coinflip
DROP FUNCTION IF EXISTS get_match_verification(UUID);
DROP FUNCTION IF EXISTS get_user_matches(UUID);

-- Remove any triggers or other dependencies
-- Note: Only removing coinflip-specific functionality, keeping other casino features intact