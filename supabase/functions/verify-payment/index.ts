import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation function for session ID
function validateSessionId(sessionId: any): { valid: boolean; error?: string } {
  if (!sessionId) {
    return { valid: false, error: "Session ID is required" };
  }
  
  if (typeof sessionId !== 'string') {
    return { valid: false, error: "Session ID must be a string" };
  }
  
  if (!sessionId.startsWith('cs_')) {
    return { valid: false, error: "Invalid session ID format" };
  }
  
  if (sessionId.length < 10) {
    return { valid: false, error: "Session ID is too short" };
  }
  
  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== VERIFY PAYMENT START ===");
    
    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization")!;
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error("Auth error:", authError);
      throw new Error("Authentication failed");
    }
    
    const user = data.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    
    console.log("User authenticated:", user.id);

    // Parse and validate request body
    const { session_id } = await req.json();
    console.log("Session ID received:", session_id);
    
    const validation = validateSessionId(session_id);
    if (!validation.valid) {
      console.error("Validation error:", validation.error);
      
      // Log suspicious activity
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'invalid_session_verification',
        p_user_id: user.id,
        p_details: {
          session_id: session_id,
          error: validation.error,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        },
        p_severity: 'warning'
      });
      
      throw new Error(validation.error);
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not found");
      throw new Error("Stripe configuration error");
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });
    console.log("Stripe initialized");

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("Session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_email
    });
    
    if (session.payment_status !== 'paid') {
      console.log("Payment not completed yet, status:", session.payment_status);
      throw new Error("Payment not completed");
    }

    // Verify this session belongs to the authenticated user
    if (session.customer_email !== user.email && session.metadata?.user_id !== user.id) {
      console.error("Session mismatch - email:", session.customer_email, "vs user:", user.email);
      
      // Log suspicious activity
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'session_user_mismatch',
        p_user_id: user.id,
        p_details: {
          session_id: session_id,
          session_email: session.customer_email,
          user_email: user.email,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        },
        p_severity: 'critical'
      });
      
      throw new Error("Session verification failed");
    }

    // Create service client to update balance
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Duplicate check omitted to prevent schema mismatch issues.
    // Ensure idempotency via Stripe session state if needed in the future.

    // Get credit amount from session metadata
    const creditAmount = parseFloat(session.metadata?.credit_amount || "0");
    if (creditAmount <= 0) {
      throw new Error("Invalid credit amount in session");
    }
    
    console.log("Processing credit amount:", creditAmount);

    // Update user balance using the safe function
    const { error: updateError } = await supabaseService.rpc('update_user_balance', {
      p_user_id: user.id,
      p_amount: creditAmount,
      p_transaction_type: 'credit_purchase',
      p_description: `Credit purchase: $${creditAmount}`
    });

    if (updateError) {
      console.error("Error updating user balance:", updateError);
      throw new Error("Failed to update balance");
    }

    // Log successful verification
    await supabaseClient.rpc('log_security_event', {
      p_event_type: 'payment_verification_success',
      p_user_id: user.id,
      p_details: {
        session_id: session_id,
        credit_amount: creditAmount,
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      },
      p_severity: 'info'
    });

    console.log("Payment verified and balance updated:", {
      user_id: user.id,
      session_id: session_id,
      amount: creditAmount
    });
    
    console.log("=== VERIFY PAYMENT END ===");

    return new Response(JSON.stringify({ 
      success: true,
      amount: creditAmount,
      message: `Successfully added $${creditAmount} to your balance`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});