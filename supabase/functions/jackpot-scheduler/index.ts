import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    console.log('⏰ Jackpot scheduler running...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current active games
    const { data: games, error: gamesError } = await supabase
      .from('jackpot_games')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (gamesError) {
      console.error('❌ Error fetching games:', gamesError);
      throw gamesError;
    }

    const results = [];

    for (const game of games || []) {
      console.log(`🎰 Processing game ${game.id}`);
      
      // Check if timer needs to be started
      const { data: playerCount } = await supabase
        .rpc('get_jackpot_aggregate_data', { p_game_id: game.id });

      const uniquePlayers = playerCount?.unique_players || 0;

      // Start timer if conditions are met
      if (!game.timer_start_at && uniquePlayers >= 2) {
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 45000); // 45 seconds
        
        const { error: updateError } = await supabase
          .from('jackpot_games')
          .update({
            timer_start_at: startTime.toISOString(),
            timer_end_at: endTime.toISOString(),
            countdown_seconds: 45
          })
          .eq('id', game.id);

        if (!updateError) {
          console.log(`⏰ Timer started for game ${game.id}`);
          results.push(`Timer started for game ${game.id}`);
        }
      }

      // Check if timer expired
      if (game.timer_end_at) {
        const now = new Date();
        const endTime = new Date(game.timer_end_at);
        const expired = now >= endTime;

        if (expired && game.status === 'active') {
          console.log(`🕐 Timer expired for game ${game.id}, triggering draw...`);
          
          // Trigger draw by calling the draw function
          const { data: drawResult, error: drawError } = await supabase
            .rpc('draw_jackpot_winner', { p_game_id: game.id });

          if (drawError) {
            console.error(`❌ Draw failed for game ${game.id}:`, drawError);
            results.push(`Draw failed for game ${game.id}: ${drawError.message}`);
          } else if (drawResult?.success) {
            console.log(`🎉 Draw completed for game ${game.id}:`, drawResult.winner_name);
            results.push(`Draw completed for game ${game.id}: ${drawResult.winner_name} won $${drawResult.jackpot_amount}`);
          }
        }
      }
    }

    // Call the broadcaster to sync all clients
    try {
      const broadcasterResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/jackpot-realtime-broadcaster`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        }
      });

      if (broadcasterResponse.ok) {
        console.log('📡 Broadcaster called successfully');
        results.push('Broadcaster sync completed');
      } else {
        console.warn('⚠️ Broadcaster call failed:', await broadcasterResponse.text());
      }
    } catch (broadcasterError) {
      console.warn('⚠️ Broadcaster call error:', broadcasterError);
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      processed: games?.length || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Scheduler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});