-- Create a new test offer for real-time animation testing
INSERT INTO game_offers (
  id,
  user_id,
  maker_name,
  amount,
  side,
  status
) VALUES (
  gen_random_uuid(),
  '3d4ef21b-8e70-4d55-8798-cc0c71b902cc',
  'Ddenbror',
  15,
  'tails',
  'open'
);