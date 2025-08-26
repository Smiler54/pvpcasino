-- First check the constraint to see what transaction types are allowed
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'transactions_type_check';