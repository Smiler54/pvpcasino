import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    console.log('🕐 Jackpot countdown manager called');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active games with expired timers
    const { data: expiredGames, error: expiredError } = await supabase
      .from('jackpot_games')
      .select('*')
      .eq('status', 'active')
      .not('timer_end_at', 'is', null)
      .lt('timer_end_at', new Date().toISOString());

    if (expiredError) {
      console.error('❌ Error fetching expired games:', expiredError);
      throw expiredError;
    }

    const results = [];

    // Process each expired game
    for (const game of expiredGames || []) {
      console.log(`⏰ Processing expired game: ${game.id}`);
      
      // Check if this game has any tickets
      const { data: ticketCount, error: ticketError } = await supabase
        .from('jackpot_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);

      if (ticketError) {
        console.error('❌ Error checking tickets:', ticketError);
        continue;
      }

      if (!ticketCount || ticketCount === 0) {
        console.log(`📭 No tickets found for game ${game.id}, skipping drawing`);
        
        // Reset timer to give more time for players to join
        const { error: resetError } = await supabase
          .from('jackpot_games')
          .update({
            timer_start_at: null,
            timer_end_at: null
          })
          .eq('id', game.id);

        if (resetError) {
          console.error('❌ Error resetting timer:', resetError);
        } else {
          console.log(`🔄 Timer reset for game ${game.id}`);
        }
        continue;
      }

      console.log(`🎰 Drawing winner for game ${game.id}`);
      
      // Call the draw winner function
      const { data: drawResult, error: drawError } = await supabase
        .rpc('draw_jackpot_winner', { p_game_id: game.id });

      if (drawError) {
        console.error('❌ Error drawing winner:', drawError);
        results.push({
          game_id: game.id,
          success: false,
          error: drawError.message
        });
      } else {
        console.log(`🎉 Winner drawn for game ${game.id}:`, drawResult);
        results.push({
          game_id: game.id,
          success: true,
          winner: drawResult.winner_name,
          jackpot_amount: drawResult.jackpot_amount,
          new_game_id: drawResult.new_game_id
        });
      }
    }

    // Also check for active games that should have their countdowns started
    const { data: gamesNeedingTimer, error: timerError } = await supabase
      .from('jackpot_games')
      .select('id')
      .eq('status', 'active')
      .is('timer_start_at', null);

    if (!timerError && gamesNeedingTimer) {
      for (const game of gamesNeedingTimer) {
        // Check player count for this game
        const { data: playerCount, error: playerError } = await supabase
          .from('jackpot_tickets')
          .select('user_id', { count: 'exact', head: true })
          .eq('game_id', game.id);

        if (!playerError && playerCount && playerCount >= 2) {
          console.log(`⏱️ Starting countdown for game ${game.id} with ${playerCount} players`);
          
          const { error: startError } = await supabase
            .rpc('start_jackpot_countdown', { 
              p_game_id: game.id, 
              p_countdown_seconds: 45 
            });

          if (startError) {
            console.error('❌ Error starting countdown:', startError);
          } else {
            console.log(`✅ Countdown started for game ${game.id}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_games: results.length,
        results,
        server_time: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in countdown manager:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        server_time: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});