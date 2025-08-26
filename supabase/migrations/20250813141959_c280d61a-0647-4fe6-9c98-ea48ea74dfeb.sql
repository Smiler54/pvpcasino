-- Drop and recreate views with proper security settings to fix the SECURITY DEFINER view issue
-- The linter might be detecting implicit SECURITY DEFINER behavior

-- Drop existing views
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.jackpot_public_stats;

-- Recreate public_profiles view with explicit SECURITY INVOKER (default)
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS SELECT 
    user_id,
    username,
    level,
    experience,
    created_at,
    updated_at
FROM public.profiles;

-- Enable RLS on the underlying table to ensure proper access control
-- (This should already be enabled, but ensuring it here)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate jackpot_public_stats view with explicit SECURITY INVOKER (default)
CREATE VIEW public.jackpot_public_stats
WITH (security_invoker = true)
AS SELECT 
    id,
    ticket_price,
    total_pool,
    status,
    timer_end_at,
    created_at,
    CASE
        WHEN status = 'completed' THEN 'Game Completed'
        ELSE NULL
    END AS game_status
FROM public.jackpot_games
WHERE status IN ('active', 'completed');

-- Create RLS policy for jackpot_public_stats access through the view
-- Since this is public data, allow authenticated users to read
CREATE POLICY "Anyone can view public jackpot stats" 
ON public.jackpot_games 
FOR SELECT 
USING (
    auth.uid() IS NOT NULL 
    AND status IN ('active', 'completed')
);

-- Create RLS policy for public_profiles access through the view  
-- Since this is public profile data, allow authenticated users to read
CREATE POLICY "Anyone can view public profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Grant appropriate permissions
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.jackpot_public_stats TO authenticated;