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
    console.log('🎰 Jackpot realtime manager called');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current active game
    const { data: gameData, error: gameError } = await supabase
      .from('jackpot_games')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (gameError && gameError.code !== 'PGRST116') {
      throw gameError;
    }

    if (!gameData) {
      return new Response(JSON.stringify({
        success: true,
        hasActiveGame: false,
        message: 'No active game'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get players and aggregate data
    const [playersResult, aggregateResult] = await Promise.all([
      supabase.rpc('get_jackpot_players_for_wheel', { p_game_id: gameData.id }),
      supabase.rpc('get_jackpot_aggregate_data', { p_game_id: gameData.id })
    ]);

    if (playersResult.error) {
      console.error('❌ Error fetching players:', playersResult.error);
      throw playersResult.error;
    }

    if (aggregateResult.error) {
      console.error('❌ Error fetching aggregate data:', aggregateResult.error);
      throw aggregateResult.error;
    }

    const players = playersResult.data || [];
    const aggregate = aggregateResult.data || {};
    const uniquePlayers = aggregate.unique_players || 0;
    const totalTickets = aggregate.total_tickets || 0;

    // Calculate timer state
    const now = new Date();
    let remainingSeconds = 0;
    let timerActive = false;

    if (gameData.timer_end_at) {
      const endTime = new Date(gameData.timer_end_at);
      const remainingMs = endTime.getTime() - now.getTime();
      remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      timerActive = remainingSeconds > 0;
    }

    // Broadcast current state to all clients
    const gameState = {
      gameId: gameData.id,
      totalPool: gameData.total_pool,
      ticketPrice: gameData.ticket_price,
      status: gameData.status,
      players: players,
      totalTickets: totalTickets,
      uniquePlayers: uniquePlayers,
      timer: {
        active: timerActive,
        remainingSeconds: remainingSeconds,
        maxCountdown: gameData.countdown_seconds || 45,
        timerEndAt: gameData.timer_end_at
      },
      serverTime: now.toISOString()
    };

    // Broadcast to all subscribers
    await supabase
      .channel('jackpot-game')
      .send({
        type: 'broadcast',
        event: 'game_state_sync',
        payload: gameState
      });

    console.log('📡 Game state broadcasted:', {
      gameId: gameData.id,
      players: uniquePlayers,
      tickets: totalTickets,
      timerActive,
      remainingSeconds
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Game state broadcasted',
      gameState
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Realtime manager error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});