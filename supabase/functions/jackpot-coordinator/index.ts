import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎰 Jackpot coordinator triggered');
    
    // Get the current active game
    const { data: activeGame, error: gameError } = await supabase
      .from('jackpot_games')
      .select('*')
      .eq('status', 'active')
      .single();

    if (gameError || !activeGame) {
      console.log('🚫 No active game found');
      return new Response(
        JSON.stringify({ success: false, message: 'No active game' }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`🎮 Processing game: ${activeGame.id}`);

    // Count unique players in the current game
    const { data: playersData, error: playersError } = await supabase
      .from('jackpot_tickets')
      .select('user_id')
      .eq('game_id', activeGame.id);

    if (playersError) {
      console.error('❌ Failed to fetch players:', playersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch players' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const uniquePlayers = new Set(playersData?.map(p => p.user_id) || []).size;
    console.log(`👥 Game ${activeGame.id} has ${uniquePlayers} unique players`);

    // SERVER-SIDE LOGIC: Start countdown only when 2+ players and no timer yet
    if (uniquePlayers >= 2 && !activeGame.timer_start_at) {
      console.log('🚀 STARTING COUNTDOWN - Server-side decision');
      
      const countdownSeconds = 45;
      const timerStartAt = new Date();
      const timerEndAt = new Date(timerStartAt.getTime() + (countdownSeconds * 1000));

      // Update game with timer information
      const { error: updateError } = await supabase
        .from('jackpot_games')
        .update({
          timer_start_at: timerStartAt.toISOString(),
          timer_end_at: timerEndAt.toISOString(),
          countdown_seconds: countdownSeconds
        })
        .eq('id', activeGame.id)
        .eq('timer_start_at', null); // Only update if timer hasn't started yet

      if (updateError) {
        console.error('❌ Failed to start timer:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to start timer' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // BROADCAST START COUNTDOWN EVENT to all clients
      const startCountdownEvent = {
        type: 'countdown_started',
        game_id: activeGame.id,
        timer_start_at: timerStartAt.toISOString(),
        timer_end_at: timerEndAt.toISOString(),
        countdown_seconds: countdownSeconds,
        player_count: uniquePlayers,
        timestamp: Date.now()
      };

      // Send via pg_notify for real-time broadcast
      await supabase.rpc('notify_jackpot_event', {
        p_channel: 'jackpot_countdown_events',
        p_payload: JSON.stringify(startCountdownEvent)
      });

      console.log('📡 COUNTDOWN STARTED - Broadcasted to all clients:', startCountdownEvent);

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'countdown_started',
          game_id: activeGame.id,
          timer_end_at: timerEndAt.toISOString(),
          player_count: uniquePlayers
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Check if countdown should end and trigger drawing
    if (activeGame.timer_end_at && new Date() >= new Date(activeGame.timer_end_at)) {
      console.log('🎯 COUNTDOWN ENDED - Starting drawing');

      // BROADCAST START DRAWING EVENT to all clients
      const startDrawingEvent = {
        type: 'drawing_started',
        game_id: activeGame.id,
        trigger_time: new Date().toISOString(),
        timestamp: Date.now()
      };

      // Send via pg_notify for real-time broadcast
      await supabase.rpc('notify_jackpot_event', {
        p_channel: 'jackpot_countdown_events',
        p_payload: JSON.stringify(startDrawingEvent)
      });

      console.log('🎬 DRAWING STARTED - Broadcasted to all clients:', startDrawingEvent);

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'drawing_started',
          game_id: activeGame.id
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Return current status
    const remainingTime = activeGame.timer_end_at 
      ? Math.max(0, Math.ceil((new Date(activeGame.timer_end_at).getTime() - Date.now()) / 1000))
      : 0;

    return new Response(
      JSON.stringify({ 
        success: true,
        action: 'status_check',
        game_id: activeGame.id,
        player_count: uniquePlayers,
        timer_active: !!activeGame.timer_start_at,
        remaining_seconds: remainingTime
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('❌ Jackpot coordinator error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});