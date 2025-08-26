import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { gameId, userId, action } = await req.json()

    console.log(`🎯 Coinflip Sync Broadcaster: ${action} for game ${gameId} by user ${userId}`)

    if (action === 'JOIN_GAME') {
      // When a player joins, immediately start the flip with server-controlled timing
      const timestamp = Date.now()
      
      // Get the current game data
      const { data: game, error: gameError } = await supabaseClient
        .from('coinflip_games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (gameError || !game) {
        throw new Error('Game not found')
      }

      // Generate provably fair result if not exists
      let gameResult = game.result
      if (!gameResult) {
        const { data: fairData, error: fairError } = await supabaseClient
          .rpc('generate_coinflip_provably_fair', { p_game_id: gameId })

        if (fairError) {
          console.error('Failed to generate provably fair data:', fairError)
          throw fairError
        }

        gameResult = fairData.result
        console.log(`✅ Generated provably fair result: ${gameResult}`)
      }

      // Broadcast synchronized start event to all clients
      const syncPayload = {
        type: 'COINFLIP_START_SYNC',
        gameId,
        result: gameResult,
        timestamp,
        duration: 3800, // Exact 3.8 second duration
        serverTime: new Date().toISOString()
      }

      // Use Supabase Realtime to broadcast to all connected clients
      await supabaseClient
        .channel('coinflip_sync')
        .send({
          type: 'broadcast',
          event: 'coinflip_animation_start',
          payload: syncPayload
        })

      console.log(`📡 Broadcasted sync start event for game ${gameId}:`, syncPayload)

      // Schedule automatic completion after exactly 3.8 seconds
      setTimeout(async () => {
        try {
          // Get final game state
          const { data: finalGame } = await supabaseClient
            .from('coinflip_games')
            .select('*')
            .eq('id', gameId)
            .single()

          if (finalGame && finalGame.status === 'flipping') {
            // Determine winner
            let winnerId: string
            if (gameResult === finalGame.player1_choice) {
              winnerId = finalGame.player1_id
            } else {
              winnerId = finalGame.player2_id!
            }

            // Complete the game
            await supabaseClient
              .from('coinflip_games')
              .update({
                status: 'completed',
                winner_id: winnerId,
                completed_at: new Date().toISOString()
              })
              .eq('id', gameId)
              .eq('status', 'flipping') // Only update if still flipping

            // Award winnings to the winner
            const betAmount = finalGame.bet_amount
            const winnings = betAmount * 2

            await supabaseClient.rpc('update_user_balance', {
              p_user_id: winnerId,
              p_amount: winnings,
              p_transaction_type: 'coinflip_win',
              p_description: `Won coinflip: $${winnings}`
            })

            // Broadcast completion event
            await supabaseClient
              .channel('coinflip_sync')
              .send({
                type: 'broadcast',
                event: 'coinflip_animation_complete',
                payload: {
                  type: 'COINFLIP_COMPLETE_SYNC',
                  gameId,
                  winnerId,
                  result: gameResult,
                  winnings,
                  timestamp: Date.now()
                }
              })

            console.log(`✅ Completed game ${gameId}, winner: ${winnerId}`)
          }
        } catch (error) {
          console.error(`❌ Error completing game ${gameId}:`, error)
        }
      }, 3800) // Exactly 3.8 seconds

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sync broadcast initiated',
          gameId,
          result: gameResult,
          timestamp
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('❌ Coinflip Sync Broadcaster Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})