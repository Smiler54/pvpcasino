-- Create helper function for pg_notify since it's not directly accessible
CREATE OR REPLACE FUNCTION public.notify_jackpot_event(
  p_channel TEXT,
  p_payload TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM pg_notify(p_channel, p_payload);
END;
$$;