-- Check the actual view creation statements to see if SECURITY DEFINER is used
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    pg_get_viewdef(c.oid) as view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v' 
AND n.nspname = 'public'
AND c.relname IN ('public_profiles', 'jackpot_public_stats');

-- Also check for any functions that might be SECURITY DEFINER
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND security_type = 'DEFINER';