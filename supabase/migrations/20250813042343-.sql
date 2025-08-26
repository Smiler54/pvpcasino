-- Add 10 USD to user Ddenbror using a valid transaction type
SELECT public.update_user_balance(
  (SELECT user_id FROM public.profiles WHERE username = 'Ddenbror'),
  10.00,
  'credit_purchase',
  'Manual admin credit: $10.00 added to Ddenbror account'
);