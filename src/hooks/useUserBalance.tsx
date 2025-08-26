import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useUserBalance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  // Enhanced query for user balance with better caching and error handling
  const { data: profile, refetch, isLoading } = useQuery({
    queryKey: ['user-balance', user?.id, updateCount],
    queryFn: async () => {
      if (!user?.id) return null;
      
      try {
        const { data, error } = await supabase.rpc('get_my_complete_profile');
        
        if (error) {
          console.error('Balance fetch error:', error);
          throw error;
        }
        
        return data?.[0] || null;
      } catch (error) {
        console.error('Profile query failed:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Reduced polling frequency 
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  // Enhanced force refresh balance function with debouncing
  const refreshBalance = useCallback(async () => {
    if (isUpdating) {
      console.log('Balance refresh already in progress, skipping...');
      return;
    }
    
    setIsUpdating(true);
    try {
      console.log('🔄 Force refreshing balance...');
      
      // Increment update count to force query refresh
      setUpdateCount(prev => prev + 1);
      
      await refetch();
      
      // Also invalidate related queries with more specific invalidation
      queryClient.invalidateQueries({ 
        queryKey: ['user-balance'], 
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['secure-profile'], 
        exact: false 
      });
      
      console.log('✅ Balance refresh completed');
    } catch (error) {
      console.error('❌ Error refreshing balance:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [refetch, queryClient, isUpdating]);

  // Debounced refresh function to prevent excessive calls
  const debouncedRefresh = useCallback(() => {
    const timeoutId = setTimeout(refreshBalance, 100);
    return () => clearTimeout(timeoutId);
  }, [refreshBalance]);

  // Enhanced real-time subscriptions with better error handling
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔗 Setting up enhanced balance real-time subscriptions for user:', user.id);

    // Listen for forced balance refresh events
    const handleForceRefresh = (event: Event) => {
      console.log('🚀 Force balance refresh event received');
      refreshBalance();
    };
    
    window.addEventListener('forceBalanceRefresh', handleForceRefresh);

    // Subscribe to user_profiles changes for this specific user
    const profileChannel = supabase
      .channel('user-balance-updates-enhanced')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles', // Fixed table name
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('👤 User profile updated via real-time:', payload);
        debouncedRefresh();
      })
      .subscribe((status) => {
        console.log('Profile channel status:', status);
      });

    // Subscribe to transactions for this user (balance affected by all transactions)
    const transactionChannel = supabase
      .channel('user-transactions-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('💰 Transaction created via real-time:', payload);
        debouncedRefresh();
      })
      .subscribe((status) => {
        console.log('Transaction channel status:', status);
      });

    // Subscribe to jackpot_tickets changes for this user
    const ticketsChannel = supabase
      .channel('user-tickets-updates-enhanced')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jackpot_tickets',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('🎰 Jackpot ticket transaction detected via real-time:', payload);
        debouncedRefresh();
      })
      .subscribe((status) => {
        console.log('Tickets channel status:', status);
      });

    // Subscribe to coinflip_games where user is involved with better filtering
    const coinflipChannel1 = supabase
      .channel('user-coinflip-player1-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'coinflip_games',
        filter: `player1_id=eq.${user.id}`
      }, (payload) => {
        console.log('🪙 Coinflip game updated (player1) via real-time:', payload);
        // Only refresh on completion or status changes that affect balance
        if (payload.new?.status === 'completed' || payload.new?.winner_id) {
          debouncedRefresh();
        }
      })
      .subscribe((status) => {
        console.log('Coinflip player1 channel status:', status);
      });

    const coinflipChannel2 = supabase
      .channel('user-coinflip-player2-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'coinflip_games',
        filter: `player2_id=eq.${user.id}`
      }, (payload) => {
        console.log('🪙 Coinflip game updated (player2) via real-time:', payload);
        // Only refresh on completion or status changes that affect balance
        if (payload.new?.status === 'completed' || payload.new?.winner_id) {
          debouncedRefresh();
        }
      })
      .subscribe((status) => {
        console.log('Coinflip player2 channel status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up enhanced balance real-time subscriptions');
      window.removeEventListener('forceBalanceRefresh', handleForceRefresh);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(transactionChannel);
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(coinflipChannel1);
      supabase.removeChannel(coinflipChannel2);
    };
  }, [user?.id, debouncedRefresh]);

  // Store debug info globally for testing
  useEffect(() => {
    (window as any).balanceDebugInfo = {
      user: user?.id,
      profile,
      isLoading,
      isUpdating,
      updateCount,
      timestamp: new Date().toISOString()
    };
  }, [user?.id, profile, isLoading, isUpdating, updateCount]);

  return {
    balance: profile?.balance || 0,
    username: profile?.username || 'Loading...',
    level: profile?.level || 1,
    experience: profile?.experience || 0,
    profile,
    isUpdating,
    isLoading,
    refreshBalance
  };
};