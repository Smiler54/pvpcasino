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
    // Create Supabase client for user authentication
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { username, amount } = await req.json()

    if (!username || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Username and positive amount required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client to bypass RLS
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find user by username
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('user_id, username, balance')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: `User '${username}' not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add credits using the update_user_balance function with proper transaction type
    const { error: updateError } = await supabaseService.rpc('update_user_balance', {
      p_user_id: profile.user_id,
      p_amount: amount,
      p_transaction_type: 'purchase', // Use existing valid transaction type
      p_description: `Admin credit added by ${user.email || user.id}: $${amount}`
    })

    if (updateError) {
      console.error('Error updating balance:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      return new Response(
        JSON.stringify({ error: `Failed to add credits: ${updateError.message || updateError}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get updated balance
    const { data: updatedProfile } = await supabaseService
      .from('profiles')
      .select('balance')
      .eq('user_id', profile.user_id)
      .single()

    console.log(`Admin ${user.email} added $${amount} to user ${username}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully added $${amount} to ${username}`,
        previous_balance: profile.balance,
        new_balance: updatedProfile?.balance || profile.balance + amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-add-credits:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})