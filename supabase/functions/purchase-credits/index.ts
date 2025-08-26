import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for security logging
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

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

    // Parse request body
    const { amount } = await req.json();
    
    // Enhanced validation with security logging
    if (!amount || typeof amount !== 'number') {
      // Log suspicious activity
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'invalid_credit_purchase',
        p_user_id: user?.id || null,
        p_details: {
          ip: clientIP,
          amount: amount,
          error: 'Invalid amount type or missing'
        },
        p_severity: 'warning'
      });
      throw new Error("Invalid amount provided");
    }

    if (amount < 10 || amount > 5000) {
      // Log potential fraud attempt
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'suspicious_credit_purchase',
        p_user_id: user.id,
        p_details: {
          ip: clientIP,
          amount: amount,
          error: 'Amount outside allowed range'
        },
        p_severity: amount > 10000 ? 'critical' : 'warning'
      });
      throw new Error("Amount must be between $10 and $5,000");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey || stripeKey === "") {
      console.error("STRIPE_SECRET_KEY environment variable is not set");
      throw new Error("Payment processing is not configured. Please contact support.");
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });
    console.log("Stripe initialized successfully");

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create a one-time payment session for purchasing credits
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: "Casino Credits",
              description: `Purchase $${amount} in gaming credits`
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        user_id: user.id,
        credit_amount: amount.toString(),
      },
    });

    // Log successful payment session creation
    await supabaseClient.rpc('log_security_event', {
      p_event_type: 'payment_session_created',
      p_user_id: user.id,
      p_details: {
        ip: clientIP,
        session_id: session.id,
        amount: amount
      },
      p_severity: 'info'
    });

    console.log("Created Stripe session:", session.id, "for user:", user.id, "amount:", amount);

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});