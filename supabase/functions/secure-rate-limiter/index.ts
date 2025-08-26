import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// Enhanced rate limiting with IP and user tracking
class SecurityRateLimiter {
  private ipAttempts: Map<string, { count: number; lastAttempt: number; blocked: boolean }> = new Map();
  private userAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  
  constructor(
    private maxIPAttempts: number = 20,
    private maxUserAttempts: number = 10,
    private windowMs: number = 60000, // 1 minute
    private blockDurationMs: number = 300000 // 5 minutes
  ) {}
  
  checkIP(ip: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const record = this.ipAttempts.get(ip);
    
    if (!record) {
      this.ipAttempts.set(ip, { count: 1, lastAttempt: now, blocked: false });
      return { allowed: true };
    }
    
    // Check if IP is currently blocked
    if (record.blocked && (now - record.lastAttempt) < this.blockDurationMs) {
      return { allowed: false, reason: 'IP temporarily blocked due to suspicious activity' };
    }
    
    // Reset if block period has expired
    if (record.blocked && (now - record.lastAttempt) >= this.blockDurationMs) {
      record.blocked = false;
      record.count = 0;
    }
    
    // Reset count if window has passed
    if ((now - record.lastAttempt) >= this.windowMs) {
      record.count = 0;
    }
    
    record.count++;
    record.lastAttempt = now;
    
    if (record.count > this.maxIPAttempts) {
      record.blocked = true;
      return { allowed: false, reason: 'Too many requests from this IP' };
    }
    
    return { allowed: true };
  }
  
  checkUser(userId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const record = this.userAttempts.get(userId);
    
    if (!record) {
      this.userAttempts.set(userId, { count: 1, lastAttempt: now });
      return { allowed: true };
    }
    
    // Reset count if window has passed
    if ((now - record.lastAttempt) >= this.windowMs) {
      record.count = 0;
    }
    
    record.count++;
    record.lastAttempt = now;
    
    if (record.count > this.maxUserAttempts) {
      return { allowed: false, reason: 'User rate limit exceeded' };
    }
    
    return { allowed: true };
  }
}

const rateLimiter = new SecurityRateLimiter();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
                    
    // Check IP rate limit first
    const ipCheck = rateLimiter.checkIP(clientIP);
    if (!ipCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: ipCheck.reason,
        type: 'rate_limit_exceeded' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user-specific rate limit
    const userCheck = rateLimiter.checkUser(user.id);
    if (!userCheck.allowed) {
      // Log security event
      await supabase.rpc('log_security_event', {
        p_event_type: 'rate_limit_violation',
        p_user_id: user.id,
        p_details: {
          ip: clientIP,
          user_agent: req.headers.get('user-agent'),
          endpoint: req.url
        },
        p_severity: 'warning'
      });
      
      return new Response(JSON.stringify({ 
        error: userCheck.reason,
        type: 'user_rate_limit' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Rate limit check passed',
      userId: user.id,
      ip: clientIP
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in secure-rate-limiter function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});