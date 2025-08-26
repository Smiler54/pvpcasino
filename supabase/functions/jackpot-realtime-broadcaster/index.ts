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
    console.log('📡 Jackpot realtime broadcaster started');
    
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
        message: 'No active game to broadcast'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate current timer state
    const now = new Date();
    let remainingSeconds = 0;
    let timerActive = false;

    if (gameData.timer_end_at) {
      const endTime = new Date(gameData.timer_end_at);
      remainingSeconds = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));
      timerActive = true;
    }

    // Determine color state
    let colorState = 'normal';
    if (remainingSeconds <= 10 && remainingSeconds > 0) {
      colorState = 'critical';
    } else if (remainingSeconds <= 30) {
      colorState = 'warning';
    }

    // Calculate progress
    const progress = timerActive ? ((45 - remainingSeconds) / 45) * 100 : 0;

    // Get updated player data
    const { data: playersData } = await supabase
      .rpc('get_jackpot_players_for_wheel', { p_game_id: gameData.id });

    const { data: aggregateData } = await supabase
      .rpc('get_jackpot_aggregate_data', { p_game_id: gameData.id });

    // Broadcast timer state to all clients
    const timerPayload = {
      gameId: gameData.id,
      remainingSeconds,
      colorState,
      progress: Math.min(100, Math.max(0, progress)),
      shouldShowWarning: remainingSeconds <= 10 && remainingSeconds > 0,
      serverTime: now.toISOString()
    };

    // Broadcast player data for wheel updates
    const playerPayload = {
      gameId: gameData.id,
      players: playersData || [],
      totalTickets: aggregateData?.total_tickets || 0,
      totalPool: gameData.total_pool,
      serverTime: now.toISOString()
    };

    // Send broadcasts to the jackpot channel
    const channelName = `jackpot-realtime-${Date.now()}`;
    
    // Broadcast timer sync
    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: timerPayload
    });

    // Broadcast player sync
    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'player_sync',
      payload: playerPayload
    });

    console.log('📤 Broadcasted timer and player sync:', {
      timer: timerPayload,
      playerCount: playersData?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      broadcasted: {
        timer: timerPayload,
        players: playerPayload
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Broadcaster error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});