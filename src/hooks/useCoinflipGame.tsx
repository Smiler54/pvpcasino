import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useToast } from '@/hooks/use-toast';

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
}

export const useCoinflipGame = () => {
  const { user } = useAuth();
  const { username } = useUserBalance();
  const { toast } = useToast();
  
  const [currentGame, setCurrentGame] = useState<CoinflipGame | null>(null);
  const [availableGames, setAvailableGames] = useState<CoinflipGame[]>([]);
  const [gameHistory, setGameHistory] = useState<CoinflipGame[]>([]);
  const [loading, setLoading] = useState(false);

  // Load games function
  const loadGames = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load open games
      const { data: openGames, error: openError } = await supabase
        .from('coinflip_games')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (openError) throw openError;
      setAvailableGames(openGames || []);

      // Load user's current active game
      const { data: myGame, error: myGameError } = await supabase
        .from('coinflip_games')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .in('status', ['waiting', 'flipping'])
        .single();

      if (myGameError && myGameError.code !== 'PGRST116') throw myGameError;
      setCurrentGame(myGame || null);

      // Load game history
      const { data: history, error: historyError } = await supabase
        .from('coinflip_games')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;
      setGameHistory(history || []);

    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new game
  const createGame = async (choice: 'heads' | 'tails', betAmount: number) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('coinflip_games')
        .insert({
          player1_id: user.id,
          player1_username: username || 'Player',
          player1_choice: choice,
          bet_amount: betAmount,
          status: 'waiting'
        })
        .select()
        .single();

      if (error) throw error;

      await loadGames();
      return { success: true, game: data };
    } catch (error) {
      console.error('Error creating game:', error);
      return { success: false, error: 'Failed to create game' };
    }
  };

  // Join existing game (choice is automatically opposite)
  const joinGame = async (gameId: string) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      // Ensure user has a profile first
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, balance')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it with default balance
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            username: username || user.email?.split('@')[0] || 'Player',
            balance: 1000.00
          });

        if (createError) {
          console.error('Error creating profile:', createError);
          return { success: false, error: 'Failed to create user profile' };
        }
        
        // Use default balance for the check
        profile = { user_id: user.id, balance: 1000.00 };
      } else if (profileError) {
        console.error('Error checking profile:', profileError);
        return { success: false, error: 'Failed to verify user profile' };
      }

      // Get the existing game to determine opposing choice and bet amount
      const { data: gameData, error: getError } = await supabase
        .from('coinflip_games')
        .select('player1_choice, bet_amount')
        .eq('id', gameId)
        .single();

      if (getError) throw getError;

      // Check if user has enough balance
      const currentProfile = profile || { user_id: user.id, balance: 1000.00 };
      if (currentProfile.balance < gameData.bet_amount) {
        return { success: false, error: 'Insufficient balance to join this game' };
      }

      // Force opposing choice
      const opposingChoice = gameData.player1_choice === 'heads' ? 'tails' : 'heads';

      const { error } = await supabase
        .from('coinflip_games')
        .update({
          player2_id: user.id,
          player2_username: username || 'Player',
          player2_choice: opposingChoice,
          status: 'flipping'
        })
        .eq('id', gameId);

      if (error) throw error;

      await loadGames();
      return { success: true };
    } catch (error) {
      console.error('Error joining game:', error);
      return { success: false, error: 'Failed to join game' };
    }
  };

  // Flip coin (trigger provably fair result)
  const flipCoin = async (gameId: string) => {
    try {
      const result = await supabase.rpc('generate_coinflip_provably_fair', {
        p_game_id: gameId
      });

      if (result.error) throw result.error;

      await loadGames();
      return { success: true, result: result.data };
    } catch (error) {
      console.error('Error flipping coin:', error);
      return { success: false, error: 'Failed to flip coin' };
    }
  };

  // Cancel game
  const cancelGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('coinflip_games')
        .update({ status: 'cancelled' })
        .eq('id', gameId);

      if (error) throw error;

      await loadGames();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling game:', error);
      return { success: false, error: 'Failed to cancel game' };
    }
  };

  // Refresh games
  const refreshGames = () => {
    loadGames();
  };

  // Load games on component mount and user change
  useEffect(() => {
    if (user) {
      loadGames();
    }
  }, [user]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('coinflip-games-hook')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'coinflip_games' },
        () => {
          loadGames();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return {
    currentGame,
    availableGames,
    gameHistory,
    loading,
    createGame,
    joinGame,
    flipCoin,
    cancelGame,
    refreshGames
  };
};