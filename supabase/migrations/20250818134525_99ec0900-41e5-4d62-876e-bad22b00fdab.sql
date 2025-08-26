-- Enable cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the jackpot countdown manager to run every 30 seconds
SELECT cron.schedule(
  'jackpot-countdown-manager',
  '*/30 * * * * *', -- every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://dvdydmknpgweohnwbpeg.supabase.co/functions/v1/jackpot-countdown-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZHlkbWtucGd3ZW9obndicGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMzMzMTUsImV4cCI6MjA3MDYwOTMxNX0.WN8NayX22TY2TUKiLe5ojOkqkrW61B6dOAV9oqEjI7w"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);