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
    console.log('🕐 Jackpot timer check triggered');
    
    // Get active game with 2+ unique players but no timer
    const { data: gameData, error: gameError } = await supabase
      .from('jackpot_games')
      .select('id, timer_start_at')
      .eq('status', 'active')
      .is('timer_start_at', null)
      .single();

    if (gameError || !gameData) {
      console.log('🚫 No active game without timer found');
      return new Response(
        JSON.stringify({ success: true, message: 'No action needed' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Count unique players in this game
    const { data: playersData, error: playersError } = await supabase
      .from('jackpot_tickets')
      .select('user_id')
      .eq('game_id', gameData.id);

    if (playersError || !playersData) {
      console.error('❌ Failed to fetch players:', playersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch players' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const uniquePlayers = new Set(playersData.map(p => p.user_id)).size;
    
    console.log(`👥 Game ${gameData.id} has ${uniquePlayers} unique players`);

    if (uniquePlayers >= 2) {
      console.log('🚀 Starting countdown timer for game:', gameData.id);
      
      // Start the countdown using the existing RPC function
      const { data: timerResult, error: timerError } = await supabase
        .rpc('start_jackpot_countdown', { 
          p_game_id: gameData.id, 
          p_countdown_seconds: 45 
        });

      if (timerError) {
        console.error('❌ Failed to start timer:', timerError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to start timer' }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('✅ Timer started successfully:', timerResult);

      // Send notification to all clients
      try {
        await supabase.rpc('notify_timer_start', { 
          p_game_id: gameData.id 
        });
        console.log('📡 Timer start notification sent');
      } catch (notifyError) {
        console.error('⚠️ Failed to send timer notification:', notifyError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          timer_started: true,
          game_id: gameData.id,
          player_count: uniquePlayers 
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      console.log(`⏳ Game ${gameData.id} needs more players (${uniquePlayers}/2)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          timer_started: false,
          message: 'Need at least 2 players',
          player_count: uniquePlayers
        }),
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('❌ Timer check failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});