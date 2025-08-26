-- Add RLS policies for public views and statistics tables

-- Enable RLS on jackpot_public_stats (it's a view but needs policies)
ALTER TABLE public.jackpot_public_stats ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for jackpot_public_stats - authenticated users can view public jackpot data
CREATE POLICY "Authenticated users can view public jackpot stats" 
ON public.jackpot_public_stats 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Enable RLS on public_profiles view
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for public_profiles - authenticated users can view public profile data
CREATE POLICY "Authenticated users can view public profiles" 
ON public.public_profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Enable RLS on public_profiles_secure view
ALTER TABLE public.public_profiles_secure ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for public_profiles_secure - authenticated users can view secure public profile data
CREATE POLICY "Authenticated users can view secure public profiles" 
ON public.public_profiles_secure 
FOR SELECT 
USING (auth.uid() IS NOT NULL);