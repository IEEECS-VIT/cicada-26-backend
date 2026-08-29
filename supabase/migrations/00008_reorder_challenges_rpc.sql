-- 00008: Atomic challenge (round) reordering
-- order_number is UNIQUE CHECK (order_number > 0), so naive sequential UPDATEs
-- collide with the unique constraint mid-reorder. This RPC renumbers in two
-- phases: 1) shift every challenge to a temporary positive offset
-- (1000000 + position), 2) write the final sequential order_number values.
-- The whole function runs inside one transaction, so it is atomic.
-- p_ordered_ids: challenge UUIDs in the NEW round order (array index = order).

CREATE OR REPLACE FUNCTION public.reorder_challenges(p_ordered_ids UUID[])
RETURNS TABLE (id UUID, order_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    i INT;
    n INT := array_length(p_ordered_ids, 1);
    total INT;
BEGIN
    IF n IS NULL OR n < 2 THEN
        RAISE EXCEPTION 'At least 2 challenge ids are required for reordering';
    END IF;

    IF (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) AS x) <> n THEN
        RAISE EXCEPTION 'Ordered list contains duplicate challenge ids';
    END IF;

    SELECT count(*) INTO total FROM public.challenges;
    IF total <> n THEN
        RAISE EXCEPTION 'Ordered list must contain exactly all % challenges (got %)', total, n;
    END IF;

    -- Phase 1: shift to temporary offsets so the UNIQUE constraint never collides
    FOR i IN 1..n LOOP
        UPDATE public.challenges
           SET order_number = 1000000 + i
         WHERE id = p_ordered_ids[i];
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Challenge % does not exist', p_ordered_ids[i];
        END IF;
    END LOOP;

    -- Phase 2: write final sequential order numbers
    FOR i IN 1..n LOOP
        UPDATE public.challenges
           SET order_number = i
         WHERE id = p_ordered_ids[i];
    END LOOP;

    RETURN QUERY
        SELECT c.id, c.order_number
          FROM public.challenges c
         ORDER BY c.order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_challenges(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_challenges(UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_challenges(UUID[]) TO service_role;