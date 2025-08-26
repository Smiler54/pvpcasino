-- Fix existing active jackpot game with NULL timer that should have a timer running
-- This addresses the current game that has 2 players but no timer set

DO $$
DECLARE
    v_game_id UUID;
    v_player_count INTEGER;
BEGIN
    -- Find active games with NULL timer but have 2+ unique players
    FOR v_game_id IN 
        SELECT jg.id 
        FROM public.jackpot_games jg
        WHERE jg.status = 'active'
          AND jg.timer_end_at IS NULL
          AND (SELECT COUNT(DISTINCT user_id) FROM public.jackpot_tickets WHERE game_id = jg.id) >= 2
    LOOP
        -- Set timer to 60 seconds from now for games that should have a timer
        UPDATE public.jackpot_games 
        SET 
            timer_end_at = NOW() + INTERVAL '60 seconds',
            initial_timer_seconds = 60
        WHERE id = v_game_id;
        
        -- Log the timer fix for debugging
        INSERT INTO public.admin_audit_log (
            admin_user_id,
            target_user_id,
            action,
            details
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'jackpot_timer_fix_applied',
            json_build_object(
                'game_id', v_game_id,
                'timer_end_at', NOW() + INTERVAL '60 seconds',
                'reason', 'Fixed existing game with 2+ players but no timer'
            )
        );
    END LOOP;
END
$$;