import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Parse request body
    const { amount } = await req.json();
    
    // Validate amount
    if (!amount || amount < 10 || amount > 10000) {
      throw new Error("Amount must be between $10 and $10,000");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create service client to update balance
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user profile with balance and Stripe account
    const { data: profile, error: profileError } = await supabaseService
      .from("profiles")
      .select("balance, stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    if (!profile.stripe_account_id) {
      throw new Error("Bank account not set up. Please complete bank account setup first.");
    }

    if (profile.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Check if Stripe account is ready for payouts
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    if (!account.payouts_enabled) {
      throw new Error("Bank account verification incomplete. Please complete account setup.");
    }

    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      destination: profile.stripe_account_id,
      description: `Withdrawal of $${amount}`,
    });

    // Record withdrawal and deduct from user balance
    const { error: insertError } = await supabaseService
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        withdrawal_method: 'bank_transfer',
        status: 'completed',
        stripe_transfer_id: transfer.id,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting withdrawal record:', insertError);
      throw new Error('Failed to record withdrawal');
    }

    const { error: updateError } = await supabaseService.rpc('update_user_balance', {
      p_user_id: user.id,
      p_amount: -amount,
      p_transaction_type: 'bank_withdrawal',
      p_description: `Bank withdrawal: $${amount}`
    });

    if (updateError) {
      console.error("Error updating user balance:", updateError);
      throw new Error("Failed to process withdrawal");
    }

    console.log("Processed payout:", transfer.id, "for user:", user.id, "amount:", amount);

    return new Response(JSON.stringify({ 
      success: true,
      transfer_id: transfer.id,
      amount: amount,
      message: `Successfully transferred $${amount} to your bank account`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing payout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});