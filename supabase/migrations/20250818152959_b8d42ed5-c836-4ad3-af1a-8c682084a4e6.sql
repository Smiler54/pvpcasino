-- Enable cryptographic functions required by provably-fair features
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure realtime UPDATE payloads include OLD row data
ALTER TABLE public.jackpot_games REPLICA IDENTITY FULL;

-- Ensure jackpot_games is part of the realtime publication (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'jackpot_games'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.jackpot_games;
    END IF;
  END IF;
END
$$;

-- Create trigger to notify clients when the timer starts (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'jackpot_timer_start_notify'
  ) THEN
    CREATE TRIGGER jackpot_timer_start_notify
    AFTER UPDATE ON public.jackpot_games
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_timer_start();
  END IF;
END
$$;