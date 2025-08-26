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
    console.log('🎰 Jackpot realtime sync request received');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current active jackpot game with all details
    const { data: gameData, error: gameError } = await supabase
      .from('jackpot_games')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (gameError && gameError.code !== 'PGRST116') {
      console.error('❌ Error fetching game:', gameError);
      throw gameError;
    }

    let responseData;

    if (!gameData) {
      console.log('📭 No active game found');
      responseData = {
        success: true,
        hasActiveGame: false,
        game: null,
        players: [],
        totalTickets: 0,
        serverTime: new Date().toISOString()
      };
    } else {
      console.log('🎰 Active game found:', gameData.id);

      // Get players for the wheel
      const { data: playersData, error: playersError } = await supabase
        .rpc('get_jackpot_players_for_wheel', { p_game_id: gameData.id });

      if (playersError) {
        console.error('❌ Error fetching players:', playersError);
        throw playersError;
      }

      // Get total tickets
      const { data: aggregateData, error: aggregateError } = await supabase
        .rpc('get_jackpot_aggregate_data', { p_game_id: gameData.id });

      const totalTickets = aggregateError ? 0 : (aggregateData?.total_tickets || 0);

      console.log('⏰ Timer data:', {
        timer_end_at: gameData.timer_end_at,
        timer_start_at: gameData.timer_start_at,
        countdown_seconds: gameData.countdown_seconds,
        playersCount: playersData?.length || 0,
        totalTickets
      });

      responseData = {
        success: true,
        hasActiveGame: true,
        game: {
          ...gameData,
          playerCount: playersData?.length || 0
        },
        players: playersData || [],
        totalTickets,
        serverTime: new Date().toISOString()
      };
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Fatal error in jackpot-realtime-sync:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        serverTime: new Date().toISOString()
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