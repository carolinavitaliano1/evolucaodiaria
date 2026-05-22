
DO $$
BEGIN
  PERFORM cron.unschedule('notify-upcoming-telehealth-every-5min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'notify-upcoming-telehealth-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uhhpnjyceobdcxqviouy.supabase.co/functions/v1/notify-upcoming-telehealth',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'bb9a65dd71b05d3669e53be615c7c8a42fc20cfc578027ba9c5c9d679ac58ade',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaHBuanljZW9iZGN4cXZpb3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTUyNDEsImV4cCI6MjA4MzU3MTI0MX0.8OxabFcAZ1ZHwzORsP2zGMl_JocPHidqHSkr_-WxD6E'
    ),
    body := '{}'::jsonb
  );
  $$
);
