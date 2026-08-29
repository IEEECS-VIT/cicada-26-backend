-- 00011: Rounds — grouping metadata over the global challenge order
-- ------------------------------------------------------------------
-- Rounds group challenges for narrative structure. Progression stays
-- strictly sequential on challenges.order_number (global order preserved);
-- a round is "entered" when its first challenge becomes unlocked.
--
-- Data migration:
--   * creates a default 'Round 1' and backfills ALL existing challenges into it
--   * seeds Round 1's story_fragment from the first challenge that had one
--     (only one fragment can survive — others must be re-added via the rounds API)
--   * drops challenges.story_fragment (fragments now live on rounds only)

-- 1) Rounds table
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL UNIQUE CHECK (order_number > 0),
    story_fragment JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_order ON public.rounds (order_number ASC);

DROP TRIGGER IF EXISTS set_rounds_updated_at ON public.rounds;
CREATE TRIGGER set_rounds_updated_at
BEFORE UPDATE ON public.rounds
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- 2) Add challenges.round_id (nullable for now; backfilled below, then NOT NULL)
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS round_id UUID;

CREATE INDEX IF NOT EXISTS idx_challenges_round_id ON public.challenges (round_id);

-- 3) Backfill: create the default round and put every challenge into it
INSERT INTO public.rounds (name, order_number, story_fragment, is_active)
VALUES ('Round 1', 1, '{}'::jsonb, true)
ON CONFLICT (order_number) DO NOTHING;

UPDATE public.challenges c
SET round_id = r.id
FROM public.rounds r
WHERE r.order_number = 1 AND c.round_id IS NULL;

-- 4) Seed Round 1's fragment from the first challenge that carried one
UPDATE public.rounds r
SET story_fragment = c.story_fragment
FROM (
    SELECT story_fragment
    FROM public.challenges
    WHERE story_fragment IS NOT NULL AND story_fragment <> '{}'::jsonb
    ORDER BY order_number ASC
    LIMIT 1
) c
WHERE r.order_number = 1;

-- 5) FK + NOT NULL. ON DELETE SET NULL + NOT NULL means a round that still
--    has challenges can never be deleted at the DB level (the API also
--    blocks it with a friendlier error).
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_round_id_fkey;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_round_id_fkey
  FOREIGN KEY (round_id) REFERENCES public.rounds(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.challenges ALTER COLUMN round_id SET NOT NULL;

-- 6) Drop the per-challenge fragment column
ALTER TABLE public.challenges DROP COLUMN IF EXISTS story_fragment;

-- 7) RLS: service role + admins (email lookup, same pattern as 00010).
--    Participants never read rounds directly — the backend API masks
--    fragments per team, so no participant SELECT policy is granted.
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on rounds" ON public.rounds;
CREATE POLICY "Allow service role full access on rounds"
ON public.rounds FOR ALL
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins have full access to rounds" ON public.rounds;
CREATE POLICY "Admins have full access to rounds"
ON public.rounds FOR ALL
USING ((SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD'))
WITH CHECK ((SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD'));

-- 8) Atomic round reordering (mirrors 00008 reorder_challenges, with the
--    authenticated-execute grant removed: SECURITY DEFINER + authenticated
--    execute would let any logged-in user reorder).
CREATE OR REPLACE FUNCTION public.reorder_rounds(p_ordered_ids UUID[])
RETURNS TABLE (id UUID, order_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    i INT;
    n INT := array_length(p_ordered_ids, 1);
    total INT;
BEGIN
    IF n IS NULL OR n < 2 THEN
        RAISE EXCEPTION 'At least 2 round ids are required for reordering';
    END IF;

    IF (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) AS x) <> n THEN
        RAISE EXCEPTION 'Ordered list contains duplicate round ids';
    END IF;

    SELECT count(*) INTO total FROM public.rounds;
    IF total <> n THEN
        RAISE EXCEPTION 'Ordered list must contain exactly all % rounds (got %)', total, n;
    END IF;

    -- Phase 1: shift to temporary offsets so the UNIQUE constraint never collides
    FOR i IN 1..n LOOP
        UPDATE public.rounds
           SET order_number = 1000000 + i
         WHERE id = p_ordered_ids[i];
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Round % does not exist', p_ordered_ids[i];
        END IF;
    END LOOP;

    -- Phase 2: write final sequential order numbers
    FOR i IN 1..n LOOP
        UPDATE public.rounds
           SET order_number = i
         WHERE id = p_ordered_ids[i];
    END LOOP;

    RETURN QUERY
        SELECT r.id, r.order_number
          FROM public.rounds r
         ORDER BY r.order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_rounds(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_rounds(UUID[]) TO service_role;