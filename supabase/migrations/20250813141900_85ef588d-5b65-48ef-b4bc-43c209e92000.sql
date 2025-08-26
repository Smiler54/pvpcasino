-- Check for views with SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%';

-- Also check the specific views we know exist
\d+ public.jackpot_public_stats;
\d+ public.public_profiles;