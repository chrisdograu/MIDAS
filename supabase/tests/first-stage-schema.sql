-- Run as the database owner in a SQL session. Fixtures exist only in pg_temp;
-- no real accounts, matches, timeline events, or access policies are changed.
-- Any failed assertion aborts the transaction. ROLLBACK removes all fixtures.
BEGIN;

DO $test$
DECLARE
  fixture_id uuid;
  initial_created_at timestamptz;
  initial_updated_at timestamptz;
  saved_updated_at timestamptz;
  saved_note text;
  saved_proof_a text;
  saved_proof_b text;
BEGIN
  CREATE TEMP TABLE first_stage_match_fixture
    (LIKE public.tournament_matches INCLUDING DEFAULTS) ON COMMIT DROP;
  INSERT INTO pg_temp.first_stage_match_fixture (tournament_id)
    VALUES (gen_random_uuid()) RETURNING id, proof_a, proof_b
    INTO fixture_id, saved_proof_a, saved_proof_b;
  IF saved_proof_a IS NOT NULL OR saved_proof_b IS NOT NULL THEN
    RAISE EXCEPTION 'Match proofs must be optional and initially empty';
  END IF;

  UPDATE pg_temp.first_stage_match_fixture
    SET proof_a = 'https://example.org/player-a.png',
        proof_b = 'https://example.org/player-b.png'
    WHERE id = fixture_id;
  SELECT proof_a, proof_b INTO saved_proof_a, saved_proof_b
    FROM pg_temp.first_stage_match_fixture WHERE id = fixture_id;
  IF saved_proof_a IS DISTINCT FROM 'https://example.org/player-a.png'
     OR saved_proof_b IS DISTINCT FROM 'https://example.org/player-b.png' THEN
    RAISE EXCEPTION 'Each side must retain its own proof URL';
  END IF;

  CREATE TEMP TABLE first_stage_timeline_fixture
    (LIKE public.game_timeline_events INCLUDING DEFAULTS) ON COMMIT DROP;
  CREATE TRIGGER first_stage_fixture_updated_at
    BEFORE UPDATE ON pg_temp.first_stage_timeline_fixture
    FOR EACH ROW EXECUTE FUNCTION public.set_game_timeline_updated_at();
  INSERT INTO pg_temp.first_stage_timeline_fixture (user_id, product_id, kind)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'opinion')
    RETURNING id, created_at, updated_at
    INTO fixture_id, initial_created_at, initial_updated_at;
  IF initial_updated_at IS NULL OR initial_updated_at IS DISTINCT FROM initial_created_at THEN
    RAISE EXCEPTION 'A newly created event must not appear edited';
  END IF;

  UPDATE pg_temp.first_stage_timeline_fixture
    SET user_note = 'Verified note', updated_at = '2000-01-01T00:00:00Z'
    WHERE id = fixture_id;
  SELECT updated_at, user_note INTO saved_updated_at, saved_note
    FROM pg_temp.first_stage_timeline_fixture WHERE id = fixture_id;
  IF saved_updated_at IS DISTINCT FROM now() OR saved_note IS DISTINCT FROM 'Verified note' THEN
    RAISE EXCEPTION 'The trigger must stamp database time and retain the edited note';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.game_timeline_events'::regclass
      AND tgname = 'trg_game_timeline_updated_at' AND tgenabled = 'O'
      AND tgfoid = 'public.set_game_timeline_updated_at()'::regprocedure
      AND tgtype = 19
  ) THEN
    RAISE EXCEPTION 'The real timeline requires an enabled per-row BEFORE UPDATE trigger';
  END IF;

  IF has_function_privilege('anon', 'public.set_game_timeline_updated_at()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.set_game_timeline_updated_at()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.set_game_timeline_updated_at()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Application roles must not directly execute the trigger function';
  END IF;
END;
$test$;

ROLLBACK;