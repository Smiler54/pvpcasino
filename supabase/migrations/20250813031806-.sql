-- Add experience and level tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN experience INTEGER NOT NULL DEFAULT 0,
ADD COLUMN level INTEGER NOT NULL DEFAULT 1;

-- Create function to calculate level from experience
CREATE OR REPLACE FUNCTION public.calculate_level(exp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  current_level INTEGER := 1;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
BEGIN
  -- Level 1 = 0 exp, Level 2 = 50 exp, Level 3 = 125 exp (50+75), Level 4 = 225 exp (50+75+100), etc.
  WHILE exp >= required_exp LOOP
    IF current_level = 1 THEN
      required_exp := required_exp + level_increment; -- Level 2 requires 50 exp
    ELSE
      required_exp := required_exp + (level_increment + (current_level - 2) * 25); -- Each level adds 25 more exp requirement
    END IF;
    
    IF exp >= required_exp THEN
      current_level := current_level + 1;
    END IF;
  END LOOP;
  
  RETURN current_level;
END;
$$;

-- Create function to get experience required for next level
CREATE OR REPLACE FUNCTION public.exp_for_next_level(current_exp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  current_level INTEGER;
  required_exp INTEGER := 0;
  level_increment INTEGER := 50;
  i INTEGER := 1;
BEGIN
  current_level := public.calculate_level(current_exp);
  
  -- Calculate total exp needed for next level
  WHILE i <= current_level LOOP
    IF i = 1 THEN
      -- Level 1 to 2 requires 50 exp
      required_exp := required_exp + level_increment;
    ELSE
      -- Each subsequent level requires 25 more exp than the previous increment
      required_exp := required_exp + (level_increment + (i - 2) * 25);
    END IF;
    i := i + 1;
  END LOOP;
  
  RETURN required_exp;
END;
$$;

-- Update the existing update_user_balance function to also award experience for spending
CREATE OR REPLACE FUNCTION public.update_user_balance(p_user_id uuid, p_amount numeric, p_transaction_type text, p_description text DEFAULT NULL::text, p_stripe_session_id text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  exp_gained INTEGER := 0;
  new_experience INTEGER;
  new_level INTEGER;
BEGIN
  -- Calculate experience gained for spending (negative amounts)
  IF p_amount < 0 THEN
    exp_gained := ABS(p_amount)::INTEGER; -- 1 exp per dollar spent
  END IF;
  
  -- Insert transaction record
  INSERT INTO public.transactions (user_id, type, amount, description, stripe_session_id)
  VALUES (p_user_id, p_transaction_type, p_amount, p_description, p_stripe_session_id);
  
  -- Update user balance and experience
  UPDATE public.profiles 
  SET 
    balance = balance + p_amount,
    experience = experience + exp_gained
  WHERE user_id = p_user_id
  RETURNING experience INTO new_experience;
  
  -- Calculate and update new level
  new_level := public.calculate_level(new_experience);
  
  UPDATE public.profiles 
  SET level = new_level
  WHERE user_id = p_user_id;
END;
$$;

-- Create trigger to automatically update level when experience changes
CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.level := public.calculate_level(NEW.experience);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_level_on_exp_change
  BEFORE UPDATE OF experience ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_level();