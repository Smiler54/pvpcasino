import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for expired jackpot timers...");

    // Create service client with admin privileges
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Call the function to check and draw expired jackpots
    const { data, error } = await supabaseService.rpc('check_and_draw_expired_jackpots');

    if (error) {
      console.error("Error checking expired jackpots:", error);
      throw error;
    }

    console.log("Jackpot timer check result:", data);

    const result = data as any;
    const processedCount = result?.processed_games || 0;

    return new Response(
      JSON.stringify({
        success: true,
        processed_games: processedCount,
        results: result?.results || [],
        timestamp: new Date().toISOString(),
        message: processedCount > 0 ? 
          `Successfully processed ${processedCount} expired jackpot(s)` : 
          "No expired jackpots found"
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Fatal error in jackpot timer check:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});