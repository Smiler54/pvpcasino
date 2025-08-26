import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CoinflipGame {
  id: string;
  player1_id: string;
  player1_username: string;
  player1_choice: string | null;
  player2_id: string | null;
  player2_username: string | null;
  player2_choice: string | null;
  bet_amount: number;
  status: string;
  result: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  server_seed?: string;
  server_seed_hash?: string;
  client_seed?: string;
  hmac_result?: string;
}

export const useMultipleCoinflipGames = () => {
  const { user } = useAuth();
  const [openGames, setOpenGames] = useState<CoinflipGame[]>([]);
  const [myActiveGames, setMyActiveGames] = useState<CoinflipGame[]>([]);
  const [completedGames, setCompletedGames] = useState<CoinflipGame[]>([]);
  const [flippingGames, setFlippingGames] = useState<Set<string>>(new Set());

  const loadGames = async () => {
    try {
      // Load open games that user hasn't joined
      const { data: openGamesData, error: openError } = await supabase
        .from('coinflip_games')
        .select('*')
        .eq('status', 'waiting')
        .neq('player1_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (openError) throw openError;
      setOpenGames(openGamesData || []);

      // Load completed games (recent 20)
      const { data: completedGamesData, error: completedError } = await supabase
        .from('coinflip_games')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (completedError) throw completedError;
      setCompletedGames(completedGamesData || []);

      // Load user's active games (waiting or flipping)
      if (user) {
        const { data: myGamesData, error: myGamesError } = await supabase
          .from('coinflip_games')
          .select('*')
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .in('status', ['waiting', 'flipping'])
          .order('created_at', { ascending: false });

        if (myGamesError && myGamesError.code !== 'PGRST116') throw myGamesError;
        setMyActiveGames(myGamesData || []);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const setGameFlipping = (gameId: string, isFlipping: boolean) => {
    setFlippingGames(prev => {
      const newSet = new Set(prev);
      if (isFlipping) {
        newSet.add(gameId);
      } else {
        newSet.delete(gameId);
      }
      return newSet;
    });
  };

  const isGameFlipping = (gameId: string) => {
    return flippingGames.has(gameId);
  };

  useEffect(() => {
    if (user) {
      loadGames();

      // Set up real-time subscription with enhanced game flip detection
      const subscription = supabase
        .channel('coinflip-multiple-games')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'coinflip_games' },
          (payload) => {
            console.log('📡 Real-time coinflip update:', payload);
            
            // Auto-trigger coin flip when game status changes to 'flipping'
            if (payload.eventType === 'UPDATE' && 
                payload.new?.status === 'flipping' && 
                payload.old?.status === 'waiting') {
              console.log('🎯 Game status changed to flipping, triggering IMMEDIATE animation:', payload.new.id);
              
              // CRITICAL: Immediate synchronization for all users
              // Add small random delay (0-50ms) to prevent exact same timing conflicts
              const syncDelay = Math.floor(Math.random() * 50);
              setTimeout(() => {
                console.log('🎯 Dispatching synchronized startCoinFlip event for game:', payload.new.id);
                window.dispatchEvent(new CustomEvent('startCoinFlip', { 
                  detail: { 
                    gameId: payload.new.id,
                    timestamp: Date.now(),
                    result: payload.new.result // Use server-generated result for sync
                  } 
                }));
              }, syncDelay);
            }

            // Handle completed games
            if (payload.eventType === 'UPDATE' && 
                payload.new?.status === 'completed' && 
                payload.old?.status === 'flipping') {
              // Remove from flipping state
              setGameFlipping(payload.new.id, false);
            }

            loadGames();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  return {
    openGames,
    myActiveGames,
    completedGames,
    flippingGames,
    loadGames,
    setGameFlipping,
    isGameFlipping
  };
};