-- Create function to ensure user profile exists before creating coinflip game
CREATE OR REPLACE FUNCTION ensure_user_profile_for_coinflip()
RETURNS trigger AS $$
BEGIN
  -- Check if profile exists for the player1_id
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = NEW.player1_id) THEN
    -- Create a basic profile for the user
    INSERT INTO profiles (user_id, username, balance, created_at, updated_at)
    VALUES (
      NEW.player1_id,
      NEW.player1_username,
      1000.00, -- Default starting balance
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure profile exists before coinflip game creation
DROP TRIGGER IF EXISTS ensure_profile_before_coinflip_insert ON coinflip_games;
CREATE TRIGGER ensure_profile_before_coinflip_insert
  BEFORE INSERT ON coinflip_games
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile_for_coinflip();

-- Also create a trigger for when player2 joins
CREATE OR REPLACE FUNCTION ensure_player2_profile_for_coinflip()
RETURNS trigger AS $$
BEGIN
  -- Check if profile exists for player2_id when it's being set
  IF NEW.player2_id IS NOT NULL AND OLD.player2_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = NEW.player2_id) THEN
      -- Create a basic profile for player2
      INSERT INTO profiles (user_id, username, balance, created_at, updated_at)
      VALUES (
        NEW.player2_id,
        NEW.player2_username,
        1000.00, -- Default starting balance
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for player2 joining
DROP TRIGGER IF EXISTS ensure_profile_before_coinflip_update ON coinflip_games;
CREATE TRIGGER ensure_profile_before_coinflip_update
  BEFORE UPDATE ON coinflip_games
  FOR EACH ROW
  EXECUTE FUNCTION ensure_player2_profile_for_coinflip();