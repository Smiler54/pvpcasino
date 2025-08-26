-- Fix function search path security warning
ALTER FUNCTION log_sensitive_access() SET search_path = 'public';

-- Also fix other functions that may have this issue
ALTER FUNCTION validate_chat_message() SET search_path = 'public';
ALTER FUNCTION validate_chat_message_enhanced() SET search_path = 'public';
ALTER FUNCTION validate_financial_transaction() SET search_path = 'public';
ALTER FUNCTION validate_balance_update_enhanced() SET search_path = 'public';
ALTER FUNCTION validate_withdrawal_request() SET search_path = 'public';
ALTER FUNCTION handle_new_user() SET search_path = 'public';
ALTER FUNCTION log_admin_privilege_escalation() SET search_path = 'public';