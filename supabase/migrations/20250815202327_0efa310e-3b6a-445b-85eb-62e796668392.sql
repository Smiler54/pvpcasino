-- Fix security linter: set immutable search_path to public for SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.ensure_user_profile_for_coinflip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure a profile exists for player1 before inserting a coinflip game
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.player1_id) THEN
    INSERT INTO public.profiles (user_id, username, balance, created_at, updated_at)
    VALUES (
      NEW.player1_id,
      NEW.player1_username,
      1000.00,
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_before_coinflip_insert ON public.coinflip_games;
CREATE TRIGGER ensure_profile_before_coinflip_insert
BEFORE INSERT ON public.coinflip_games
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_profile_for_coinflip();

CREATE OR REPLACE FUNCTION public.ensure_player2_profile_for_coinflip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When player2 joins, ensure they have a profile as well
  IF NEW.player2_id IS NOT NULL AND (OLD.player2_id IS NULL OR OLD.player2_id <> NEW.player2_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.player2_id) THEN
      INSERT INTO public.profiles (user_id, username, balance, created_at, updated_at)
      VALUES (
        NEW.player2_id,
        COALESCE(NEW.player2_username, 'Player'),
        1000.00,
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_before_coinflip_update ON public.coinflip_games;
CREATE TRIGGER ensure_profile_before_coinflip_update
BEFORE UPDATE ON public.coinflip_games
FOR EACH ROW
EXECUTE FUNCTION public.ensure_player2_profile_for_coinflip();