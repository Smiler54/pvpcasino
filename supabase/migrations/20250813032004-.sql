-- Create table to track claimed level rewards
CREATE TABLE public.level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0.10,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, level)
);

-- Enable Row Level Security
ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;

-- Create policies for level_rewards
CREATE POLICY "Users can view their own level rewards" ON public.level_rewards
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own level rewards" ON public.level_rewards
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create function to claim level rewards
CREATE OR REPLACE FUNCTION public.claim_level_rewards(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_profile RECORD;
  unclaimed_levels INTEGER[];
  level_num INTEGER;
  reward_per_level NUMERIC := 0.10;
  total_rewards NUMERIC := 0;
  claimed_count INTEGER := 0;
BEGIN
  -- Get user's current level and claimed rewards
  SELECT level, experience INTO user_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF user_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Find unclaimed levels (levels 2 and above that haven't been claimed)
  SELECT array_agg(level_num) INTO unclaimed_levels
  FROM generate_series(2, user_profile.level) AS level_num
  WHERE NOT EXISTS (
    SELECT 1 FROM public.level_rewards 
    WHERE user_id = p_user_id AND level = level_num
  );
  
  -- If no unclaimed rewards, return early
  IF unclaimed_levels IS NULL OR array_length(unclaimed_levels, 1) = 0 THEN
    RETURN json_build_object(
      'success', true, 
      'message', 'No unclaimed rewards available',
      'rewards_claimed', 0,
      'total_amount', 0
    );
  END IF;
  
  -- Claim rewards for each unclaimed level
  FOREACH level_num IN ARRAY unclaimed_levels
  LOOP
    -- Insert claimed reward record
    INSERT INTO public.level_rewards (user_id, level, reward_amount)
    VALUES (p_user_id, level_num, reward_per_level);
    
    claimed_count := claimed_count + 1;
    total_rewards := total_rewards + reward_per_level;
  END LOOP;
  
  -- Add rewards to user balance
  UPDATE public.profiles
  SET balance = balance + total_rewards
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    p_user_id, 
    'level_reward', 
    total_rewards, 
    'Level-up rewards claimed for ' || claimed_count || ' levels'
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed ' || claimed_count || ' level rewards',
    'rewards_claimed', claimed_count,
    'total_amount', total_rewards
  );
END;
$$;