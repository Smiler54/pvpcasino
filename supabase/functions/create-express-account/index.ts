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
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create service client to update profile
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user already has a Stripe Express account
    const { data: profile } = await supabaseService
      .from("profiles")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.stripe_account_id) {
      // Create account link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${req.headers.get("origin")}/profile`,
        return_url: `${req.headers.get("origin")}/profile?setup=complete`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({ 
        url: accountLink.url,
        account_id: profile.stripe_account_id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create new Stripe Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "SE",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    // Update user profile with Stripe account ID
    await supabaseService
      .from("profiles")
      .update({ stripe_account_id: account.id })
      .eq("user_id", user.id);

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get("origin")}/profile`,
      return_url: `${req.headers.get("origin")}/profile?setup=complete`,
      type: "account_onboarding",
    });

    console.log("Created Stripe Express account:", account.id, "for user:", user.id);

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: account.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating Express account:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});