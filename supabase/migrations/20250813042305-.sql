-- Call the admin function to add 10 USD to user Ddenbror
SELECT public.update_user_balance(
  (SELECT user_id FROM public.profiles WHERE username = 'Ddenbror'),
  10.00,
  'admin_credit',
  'Manual admin credit: $10.00 added to Ddenbror account'
);