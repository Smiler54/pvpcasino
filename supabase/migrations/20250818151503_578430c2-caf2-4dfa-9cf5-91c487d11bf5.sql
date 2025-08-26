-- Add a trigger to notify clients when timer starts
CREATE OR REPLACE FUNCTION notify_timer_start()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger on jackpot_games table
DROP TRIGGER IF EXISTS trigger_notify_timer_start ON public.jackpot_games;
CREATE TRIGGER trigger_notify_timer_start
  AFTER UPDATE ON public.jackpot_games
  FOR EACH ROW
  EXECUTE FUNCTION notify_timer_start();