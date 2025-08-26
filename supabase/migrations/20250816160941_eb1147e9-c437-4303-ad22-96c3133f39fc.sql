-- Force complete the expired game and start fresh
DO $$
DECLARE
    v_expired_game_id UUID;
    v_new_game_id UUID;
BEGIN
    -- Get the expired active game
    SELECT id INTO v_expired_game_id
    FROM public.jackpot_games 
    WHERE status = 'active' 
      AND timer_end_at IS NOT NULL 
      AND timer_end_at < NOW()
    LIMIT 1;
    
    -- If we found an expired game, complete it
    IF v_expired_game_id IS NOT NULL THEN
        -- Mark as completed without winner (timer expired but no draw happened)
        UPDATE public.jackpot_games
        SET 
            status = 'completed',
            completed_at = NOW(),
            winner_name = 'Timer Expired - System Reset'
        WHERE id = v_expired_game_id;
        
        -- Create a new active game immediately
        INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
        VALUES (1.00, 0.00, 'active')
        RETURNING id INTO v_new_game_id;
        
        -- Log the reset
        INSERT INTO public.admin_audit_log (
            admin_user_id,
            target_user_id,
            action,
            details
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'jackpot_expired_reset',
            json_build_object(
                'old_game_id', v_expired_game_id,
                'new_game_id', v_new_game_id,
                'reason', 'Timer expired - forced reset to fix sync issues'
            )
        );
    END IF;
END
$$;