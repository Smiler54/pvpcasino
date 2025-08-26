-- Check for views with SECURITY DEFINER in the public schema
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public';