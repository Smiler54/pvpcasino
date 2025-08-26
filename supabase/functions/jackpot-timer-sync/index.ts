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
    console.log('🕐 Jackpot timer sync service started');
    
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
        serverTime: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get current player count and calculate dynamic timer
    const { data: playerData } = await supabase
      .rpc('get_jackpot_aggregate_data', { p_game_id: gameData.id });

    const uniquePlayers = playerData?.unique_players || 0;
    console.log(`👥 Unique players: ${uniquePlayers}`);

    // Calculate server-authoritative remaining time
    const now = new Date();
    const serverTime = now.toISOString();
    
    let remainingSeconds = 0;
    let timerActive = false;
    let shouldStartDraw = false;
    let maxCountdown = gameData.countdown_seconds || 45;

    // Check if timer is running
    if (gameData.timer_end_at) {
      const endTime = new Date(gameData.timer_end_at);
      const remainingMs = endTime.getTime() - now.getTime();
      remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      timerActive = true;
      
      console.log(`⏰ Timer check: End=${endTime.toISOString()}, Now=${now.toISOString()}, Remaining=${remainingSeconds}s`);
      
      // Check if timer expired
      if (remainingSeconds === 0 && gameData.status === 'active') {
        shouldStartDraw = true;
        console.log('⏰ Timer expired, triggering draw');
        
        try {
          const drawResult = await supabase.rpc('draw_jackpot_winner', { p_game_id: gameData.id });
          console.log('🎰 Auto-draw triggered:', drawResult);
          
          // Broadcast draw start to all clients
          await supabase
            .channel('jackpot-game')
            .send({
              type: 'broadcast',
              event: 'drawing_started',
              payload: { 
                gameId: gameData.id,
                drawResult: drawResult.data 
              }
            });
            
        } catch (drawError) {
          console.error('❌ Auto-draw failed:', drawError);
        }
      }
    }

    // Timer logic: Start when 2+ players, extend for additional players
    if (!gameData.timer_start_at && uniquePlayers >= 2) {
      // Calculate dynamic countdown: 45s base + 5s per extra player (max 75s)
      const extraPlayers = Math.max(0, uniquePlayers - 2);
      const extraTime = Math.min(extraPlayers * 5, 30); // max 30 extra seconds
      maxCountdown = 45 + extraTime;
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (maxCountdown * 1000));
      
      console.log(`⏰ Starting timer: ${uniquePlayers} players, ${maxCountdown}s countdown`);
      
      await supabase
        .from('jackpot_games')
        .update({
          timer_start_at: startTime.toISOString(),
          timer_end_at: endTime.toISOString(),
          countdown_seconds: maxCountdown
        })
        .eq('id', gameData.id);

      remainingSeconds = maxCountdown;
      timerActive = true;
      
      // Broadcast timer start to all clients
      await supabase
        .channel('jackpot-game')
        .send({
          type: 'broadcast',
          event: 'timer_started',
          payload: { 
            gameId: gameData.id,
            countdownSeconds: maxCountdown,
            timerEndAt: endTime.toISOString(),
            uniquePlayers
          }
        });
        
      console.log('⏰ Timer started and broadcasted');
    }
    
    // Handle timer extension for additional players
    else if (gameData.timer_start_at && timerActive && uniquePlayers > 2) {
      const extraPlayers = Math.max(0, uniquePlayers - 2);
      const newMaxCountdown = Math.min(45 + (extraPlayers * 5), 75);
      
      // Only extend if the new countdown is longer
      if (newMaxCountdown > maxCountdown) {
        const currentEndTime = new Date(gameData.timer_end_at);
        const extensionSeconds = newMaxCountdown - maxCountdown;
        const newEndTime = new Date(currentEndTime.getTime() + (extensionSeconds * 1000));
        
        console.log(`⏰ Extending timer by ${extensionSeconds}s for player ${uniquePlayers}`);
        
        await supabase
          .from('jackpot_games')
          .update({
            timer_end_at: newEndTime.toISOString(),
            countdown_seconds: newMaxCountdown
          })
          .eq('id', gameData.id);
          
        // Recalculate remaining time with extension
        const newRemainingMs = newEndTime.getTime() - now.getTime();
        remainingSeconds = Math.max(0, Math.ceil(newRemainingMs / 1000));
        maxCountdown = newMaxCountdown;
        
        // Broadcast timer extension
        await supabase
          .channel('jackpot-game')
          .send({
            type: 'broadcast',
            event: 'timer_extended',
            payload: { 
              gameId: gameData.id,
              newRemainingSeconds: remainingSeconds,
              newCountdownSeconds: newMaxCountdown,
              uniquePlayers
            }
          });
      }
    }

    // Determine color state based on remaining time
    let colorState = 'normal';
    if (remainingSeconds <= 10 && remainingSeconds > 0) {
      colorState = 'critical';
    } else if (remainingSeconds <= 30) {
      colorState = 'warning';
    }

    // Calculate progress (0-100)
    const progress = timerActive && maxCountdown > 0 ? 
      ((maxCountdown - remainingSeconds) / maxCountdown) * 100 : 0;

    const response = {
      success: true,
      hasActiveGame: true,
      gameId: gameData.id,
      serverTime,
      timer: {
        active: timerActive,
        remainingSeconds,
        maxCountdown,
        colorState,
        progress: Math.min(100, Math.max(0, progress)),
        shouldShowWarning: remainingSeconds <= 10 && remainingSeconds > 0
      },
      shouldStartDraw,
      playerCount: uniquePlayers,
      totalPool: gameData.total_pool
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Timer sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      serverTime: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});