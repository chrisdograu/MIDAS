ALTER TABLE public.game_timeline_events
  ALTER COLUMN updated_at SET NOT NULL;
COMMENT ON COLUMN public.game_timeline_events.updated_at IS 'Database timestamp of the last update; existing events begin with their original created_at timestamp.';