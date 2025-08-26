-- Fix security warning: set search_path for function
CREATE OR REPLACE FUNCTION notify_timer_start()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify when timer_start_at changes from NULL to a value
  IF OLD.timer_start_at IS NULL AND NEW.timer_start_at IS NOT NULL THEN
    -- Use pg_notify to send real-time notification
    PERFORM pg_notify(
      'jackpot_timer_started',
      json_build_object(
        'game_id', NEW.id,
        'timer_start_at', NEW.timer_start_at,
        'timer_end_at', NEW.timer_end_at,
        'countdown_seconds', NEW.countdown_seconds
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;