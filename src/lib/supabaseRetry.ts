import { supabase } from '@/integrations/supabase/client';

// Minimal helper for handling expired JWT: refresh, then retry once.
export async function rpcWithAuthRetry<T = any>(fnName: string, params?: Record<string, any>) {
  // First attempt
  let { data, error } = await supabase.rpc(fnName as any, params as any);
  
  if (error && isAuthExpired(error)) {
    try {
      // Try refresh
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        // If refresh fails, sign out to clear bad token so public RLS can work
        await supabase.auth.signOut();
      }
    } catch {}
    // Retry once after refresh/signout
    const retry = await supabase.rpc(fnName as any, params as any);
    data = retry.data as any;
    error = retry.error as any;
  }
  return { data: data as T, error };
}

function isAuthExpired(err: any) {
  const msg = (err?.message || err?.error_description || '').toString().toLowerCase();
  return msg.includes('jwt expired') || msg.includes('invalid token') || msg.includes('invalid jwt') || msg.includes('invalid authentication');
}
