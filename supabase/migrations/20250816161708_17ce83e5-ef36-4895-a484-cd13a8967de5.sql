-- Fix expired timer and create fresh game for testing
DO $$
DECLARE
    v_expired_game_id UUID;
    v_new_game_id UUID;
BEGIN
    -- Complete any expired active games
    UPDATE public.jackpot_games
    SET 
        status = 'completed',
        completed_at = NOW(),
        winner_name = 'Timer Expired - Debug Reset'
    WHERE status = 'active' 
      AND timer_end_at IS NOT NULL 
      AND timer_end_at < NOW();
    
    -- Create a fresh game for testing
    INSERT INTO public.jackpot_games (ticket_price, total_pool, status)
    VALUES (1.00, 0.00, 'active')
    RETURNING id INTO v_new_game_id;
    
    -- Log the debug reset
    INSERT INTO public.admin_audit_log (
        admin_user_id,
        target_user_id,
        action,
        details
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000000',
        'debug_timer_reset',
        json_build_object(
            'new_game_id', v_new_game_id,
            'reason', 'Fresh game for timer debugging'
        )
    );
END
$$;