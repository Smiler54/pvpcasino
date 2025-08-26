import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserBalance } from "@/hooks/useUserBalance";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AnimatedSpinningWheel } from "@/components/AnimatedSpinningWheel";
import { JackpotPlayersList } from "@/components/JackpotPlayersList";
import { WinnerAnnouncement } from "@/components/WinnerAnnouncement";
import { JackpotLiveChat } from "@/components/JackpotLiveChat";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Trophy, Ticket, Clock, Users } from "lucide-react";
import { addColorsToPlayers } from '@/lib/playerColors';
import { GameErrorHandler } from '@/lib/gameErrorHandler';
import { rpcWithAuthRetry } from '@/lib/supabaseRetry';
import { getSocket } from '@/lib/socket';
interface JackpotGameData {
  id: string;
  ticket_price: number;
  total_pool: number;
  status: string;
  timer_end_at?: string | null;
  countdown_seconds?: number;
  winner_name?: string;
  jackpot_amount?: number;
}

interface JackpotTicket {
  id: string;
  username: string;
  tickets_bought: number;
  amount_paid: number;
}

interface JackpotPlayer {
  username: string;
  tickets_bought: number;
  total_value: number;
  percentage: number;
  color: string; // Color is required for consistency
}

export const JackpotGame = () => {
  const [ticketsToBuy, setTicketsToBuy] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [gameData, setGameData] = useState<JackpotGameData | null>(null);
  const [tickets, setTickets] = useState<JackpotTicket[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [userTickets, setUserTickets] = useState(0);
  const [players, setPlayers] = useState<JackpotPlayer[]>([]);
  const [showWinnerAnnouncement, setShowWinnerAnnouncement] = useState(false);
  const [lastWinner, setLastWinner] = useState<{name: string, amount: number} | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [drawingInProgress, setDrawingInProgress] = useState(false);
  const { user } = useAuth();
  const { username } = useUserBalance();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) { setIsAdmin(false); return; }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();
        setIsAdmin(!error && !!data);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdminRole();
  }, [user]);

  const fetchGameData = async (retryCount = 0) => {
    if (isFetching) {
      console.log('🚫 Skipping fetch - already in progress');
      return;
    }

    try {
      setIsFetching(true);
      setLoadingError(null);
      
      console.log('🔄 Fetching jackpot game data...');
      
      // Get active jackpot game
      const { data: gameStats, error: gameError } = await rpcWithAuthRetry<any[]>('get_public_jackpot_stats');

      if (gameError) {
        console.error('❌ Game stats error:', gameError);
        // Retry once for network errors
        if (retryCount < 1 && gameError.message?.includes('Failed to fetch')) {
          setIsFetching(false);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchGameData(retryCount + 1);
        }
        throw gameError;
      }

      if (!gameStats || gameStats.length === 0) {
        console.log('📭 No active game found');
        // No active game found, reset state
        setGameData(null);
        setTotalTickets(0);
        setUserTickets(0);
        setTickets([]);
        setPlayers([]);
        setIsDataLoading(false);
        setIsFetching(false);
        return;
      }

      const gameData = gameStats[0];
      console.log('🎰 Game data fetched:', gameData);
      
      // CRITICAL: Force component re-render by updating state
      setGameData(prevData => {
        if (JSON.stringify(prevData) !== JSON.stringify(gameData)) {
          console.log('🔄 Game data changed, forcing update');
          return gameData;
        }
        return gameData;
      });

      // Get aggregate data with error handling
      try {
        const aggregateResult = await rpcWithAuthRetry('get_jackpot_aggregate_data', { p_game_id: gameData.id });
        
        if (aggregateResult.error) {
          setTotalTickets(0);
        } else {
          const aggregate = aggregateResult.data as any;
          setTotalTickets(aggregate.total_tickets || 0);
        }
      } catch (error) {
        setTotalTickets(0);
      }

      // Small delay between API calls to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get player data for the wheel
      try {
        const playersResult = await rpcWithAuthRetry('get_jackpot_players_for_wheel', { p_game_id: gameData.id });
        
        if (playersResult.error) {
          console.error('❌ Players fetch error:', playersResult.error);
          setPlayers([]);
        } else {
          const playersData = playersResult.data as JackpotPlayer[];
          console.log('👥 Players data fetched:', playersData?.length || 0, 'players');
          
          // Add consistent colors to players with enhanced error handling
          try {
            const playersWithColors = addColorsToPlayers(playersData || []);
            
            // CRITICAL: Force re-render with new player data
            setPlayers(prevPlayers => {
              if (JSON.stringify(prevPlayers) !== JSON.stringify(playersWithColors)) {
                console.log('🎨 Players changed, updating wheel slices');
                return playersWithColors;
              }
              return playersWithColors;
            });
          } catch (colorError) {
            console.error('🎨 Color assignment error:', colorError);
            // Fallback: set players without colors
            const fallbackPlayers = (playersData || []).map((player, index) => ({
              ...player,
              color: `hsl(${(index * 137.5) % 360}, 70%, 50%)` // Fallback color generation
            }));
            setPlayers(fallbackPlayers);
          }
        }
      } catch (error) {
        console.error('❌ Players fetch exception:', error);
        setPlayers([]);
      }

      // Another small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get user's own tickets only (secure)
      let userTicketCount = 0;
      if (user) {
        try {
          const { data: userTicketsData, error: userTicketsError } = await rpcWithAuthRetry<any[]>('get_user_jackpot_tickets_secure', { p_game_id: gameData.id });

          if (!userTicketsError && userTicketsData) {
            userTicketCount = userTicketsData.reduce((sum: number, ticket: any) => sum + ticket.tickets_bought, 0);
          }
        } catch (error) {
          // Silent error handling for user tickets
        }
      }
      setUserTickets(userTicketCount);

      // Clear the exposed tickets list for security
      setTickets([]);
      setIsDataLoading(false);

    } catch (error: any) {
      console.error('Error fetching game data:', error);
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('jwt expired') || msg.includes('invalid jwt') || msg.includes('invalid token')) {
        setLoadingError('Session expired. Please sign in again.');
      } else {
        setLoadingError(error.message || 'Failed to load jackpot data');
      }
      setIsDataLoading(false);
    } finally {
      setIsFetching(false);
    }
  };

  const buyTickets = async () => {
    if (!user || !gameData) {
      toast({
        title: "Authentication Required",
        description: "Please log in to buy tickets",
        variant: "destructive"
      });
      return;
    }

    if (ticketsToBuy < 1 || ticketsToBuy > 100) {
      toast({
        title: "Invalid Amount",
        description: "You can buy 1-100 tickets at a time",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    // Optimistic UI update - disable button immediately to prevent double clicks
    const ticketInput = document.getElementById('tickets') as HTMLInputElement;
    if (ticketInput) ticketInput.disabled = true;

    try {
      const { data, error } = await rpcWithAuthRetry('buy_jackpot_tickets', {
        p_game_id: gameData.id,
        p_user_id: user.id,
        p_username: user.user_metadata?.username || 'Anonymous',
        p_tickets: ticketsToBuy,
        p_ticket_price: gameData.ticket_price
      });

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast({
          title: "Tickets Purchased!",
          description: `Bought ${result.tickets_bought} tickets for $${result.amount_paid}.`,
        });
        
        // Refresh game data and force balance update immediately  
        console.log('Ticket purchase successful, refreshing data...');
        
        // Force immediate balance refresh
        const balanceRefreshEvent = new CustomEvent('forceBalanceRefresh');
        window.dispatchEvent(balanceRefreshEvent);
        
        // CRITICAL: Multiple immediate refreshes for cross-browser compatibility
        console.log('Ticket purchase successful, triggering immediate refresh...');
        fetchGameData(); // Immediate refresh
        setTimeout(() => fetchGameData(), 100); // Fast follow-up for PC browsers
        setTimeout(() => fetchGameData(), 300); // Final sync for stubborn browsers
        setTicketsToBuy(1);
      } else {
        toast({
          title: "Purchase Failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Purchase Error",
        description: error.message || "Failed to buy tickets",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      // Re-enable input field
      const ticketInput = document.getElementById('tickets') as HTMLInputElement;
      if (ticketInput) ticketInput.disabled = false;
    }
  };

  const drawWinner = async () => {
    // Check if game data exists and is still active
    if (!gameData || gameData.status !== 'active' || totalTickets === 0) {
      console.log('Cannot draw winner: game not active or no tickets');
      return; // Don't show error toast, just silently return
    }

    // Prevent multiple drawing attempts
    if (drawingInProgress || isDrawing) {
      console.log('Drawing already in progress, skipping...');
      return;
    }

    setDrawingInProgress(true);
    setIsDrawing(true);
    
    console.log('🎰 DEBUG: Starting draw process for game:', gameData.id);
    console.log('🎰 DEBUG: Current players:', players.length);
    console.log('🎰 DEBUG: Total tickets:', totalTickets);

    try {
      // Generate provably fair data first
      const fairDataResult = await rpcWithAuthRetry('generate_jackpot_provably_fair', {
        p_game_id: gameData.id
      });

      if (fairDataResult.error) {
        console.error('❌ DEBUG: Failed to generate provably fair data:', fairDataResult.error);
      } else {
        console.log('✅ DEBUG: Provably fair data generated:', fairDataResult.data);
      }

      console.log('🎰 DEBUG: Calling draw_jackpot_winner...');
      const { data, error } = await rpcWithAuthRetry('draw_jackpot_winner', {
        p_game_id: gameData.id
      });

      if (error) {
        console.error('❌ DEBUG: Draw winner RPC error:', error);
        throw error;
      }

      console.log('🎰 DEBUG: Draw winner result:', data);
      const result = data as any;
      
      if (result.success) {
        console.log('🎉 DEBUG: Winner drawn successfully:', result.winner_name, 'Amount:', result.jackpot_amount);
        // Set winner for animation - CRITICAL: This triggers the wheel spin
        setLastWinner({
          name: result.winner_name,
          amount: result.jackpot_amount
        });
        console.log('🎰 DEBUG: Animation state updated with winner, isDrawing:', true);
        
        // Force immediate re-render for animation trigger
        setTimeout(() => {
          console.log('🎰 DEBUG: Forcing animation trigger after winner set');
        }, 50);
      } else {
        console.error('❌ DEBUG: Draw failed:', result.error);
        setIsDrawing(false);
        setDrawingInProgress(false);
        // Only show error toast if it's not about the game being already completed
        if (!result.error?.includes('already completed') && !result.error?.includes('not active')) {
          toast({
            title: "Draw Failed",
            description: result.error,
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('💥 DEBUG: Exception in draw process:', error);
      setIsDrawing(false);
      setDrawingInProgress(false);
      // Only show error toast if it's not about the game being already completed
      if (!error.message?.includes('already completed') && !error.message?.includes('not active')) {
        toast({
          title: "Draw Error",
          description: error.message || "Failed to draw winner",
          variant: "destructive"
        });
      }
    }
  };

  // Admin-only: Restart the active jackpot game by completing current and creating a fresh one
  const restartActiveGame = async () => {
    if (!isAdmin || !gameData) return;
    try {
      setRestartLoading(true);
      // Complete current game (no winner payout)
      const { error: updateErr } = await supabase
        .from('jackpot_games')
        .update({ status: 'completed', winner_name: 'Restarted by admin', completed_at: new Date().toISOString() })
        .eq('id', gameData.id);
      if (updateErr) throw updateErr;

      // Create a new fresh active game with same ticket price
      const { error: insertErr } = await supabase
        .from('jackpot_games')
        .insert({ ticket_price: gameData.ticket_price, total_pool: 0, status: 'active' });
      if (insertErr) throw insertErr;

      toast({ title: 'Jackpot restarted', description: 'A new game has been created.' });
      // Refresh UI
      setLastWinner(null);
      setPlayers([]);
      await fetchGameData();
    } catch (e: any) {
      toast({ title: 'Restart failed', description: e.message || 'Could not restart jackpot', variant: 'destructive' });
    } finally {
      setRestartLoading(false);
    }
  };

  const handleDrawComplete = async () => {
    console.log('🎰 Draw animation completed, cleaning up...');
    setIsDrawing(false);
    setDrawingInProgress(false);
    
    // Show winner announcement if user won (extended display time)
    if (lastWinner && username && lastWinner.name.toLowerCase() === username.toLowerCase()) {
      setShowWinnerAnnouncement(true);
      setTimeout(() => setShowWinnerAnnouncement(false), 12000); // Extended from 8s to 12s
    }
    
    // FIXED: Immediate refresh with minimal delay to eliminate lag
    console.log('🔄 Immediately refreshing to get new game...');
    
    // Clear old data first
    setLastWinner(null);
    setPlayers([]);
    
    // Force immediate refresh
    setTimeout(async () => {
      await fetchGameData();
    }, 100);
  };

  useEffect(() => {
    fetchGameData();
    
    // Enhanced real-time sync with server-side countdown coordination
    const channelName = `jackpot-realtime-${Date.now()}`;
    const deviceType = navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
    console.log(`🔄 Setting up enhanced real-time sync for ${deviceType}:`, channelName);
    
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false, ack: true },
          presence: { key: user?.id || 'anonymous' }
        }
      })
      // Listen for server-side countdown events
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jackpot_games'
      }, (payload) => {
        console.log(`🎰 REAL-TIME [${deviceType}]: Game updated`, payload);
        
        if (payload.new) {
          const game = payload.new as any;
          const oldGame = payload.old as any;
          
          // SERVER-SIDE TIMER START DETECTION
          if (oldGame && !oldGame.timer_start_at && game.timer_start_at) {
            console.log(`⏰ SERVER TIMER STARTED [${deviceType}]: ${game.id}`);
            
            // Immediately sync with server timer
            const serverEndTime = new Date(game.timer_end_at);
            const remainingMs = serverEndTime.getTime() - Date.now();
            const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
            
            console.log(`🕐 SYNC: ${remainingSeconds}s remaining on server timer`);
            
            // Update timer display immediately with server time
            const timerEl = document.getElementById("jackpot-timer");
            if (timerEl) {
              timerEl.innerText = String(remainingSeconds);
            }
            
            // Force immediate UI refresh
            setTimeout(() => {
              if (!isFetching && !isDrawing) {
                fetchGameData();
              }
            }, 50);
          }
          
          // Handle completed games - immediate winner sync
          if (game.status === 'completed' && game.winner_name && !isDrawing) {
            console.log(`🏆 WINNER DETECTED [${deviceType}]:`, game.winner_name);
            
            setIsDrawing(true);
            setDrawingInProgress(true);
            setLastWinner({
              name: game.winner_name,
              amount: game.total_pool
            });
            
            // Broadcast to sync all clients
            channel.send({
              type: 'broadcast',
              event: 'jackpot_drawing_start',
              payload: {
                winner_name: game.winner_name,
                jackpot_amount: game.total_pool,
                timestamp: Date.now(),
                gameId: game.id
              }
            });
          }
        }
        
        // Force refresh if not busy
        if (!isFetching && !isDrawing) {
          setTimeout(() => fetchGameData(), 100);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jackpot_games'
      }, (payload) => {
        console.log(`🆕 REAL-TIME [${deviceType}]: New game created`, payload);
        if (!isFetching && !isDrawing) {
          setTimeout(() => fetchGameData(), 100);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jackpot_tickets'
      }, (payload) => {
        console.log(`🎫 REAL-TIME [${deviceType}]: Ticket purchased`, payload);
        
        // IMMEDIATE refresh when tickets are purchased
        if (!isFetching && !isDrawing) {
          console.log(`🔄 IMMEDIATE refresh for ticket purchase [${deviceType}]`);
          fetchGameData();
          
          // TRIGGER SERVER-SIDE COUNTDOWN COORDINATOR
          setTimeout(async () => {
            if (!isFetching && !isDrawing) {
              console.log(`⏰ TRIGGERING SERVER COORDINATOR [${deviceType}] - CRITICAL FOR TIMER START`);
              try {
                console.log('🔥 CALLING JACKPOT-COORDINATOR TO START TIMER');
                const result = await supabase.functions.invoke('jackpot-coordinator');
                console.log('✅ Server coordinator response:', result.data);
                
                // IMPORTANT: Force immediate timer sync after coordinator runs
                console.log('🕐 FORCING IMMEDIATE TIMER SYNC AFTER COORDINATOR');
                const timerSync = await supabase.functions.invoke('jackpot-timer-sync');
                console.log('✅ Timer sync response:', timerSync.data);
                
                // Update timer display immediately if timer started
                if (timerSync.data?.timer?.active) {
                  const timerEl = document.getElementById("jackpot-timer");
                  if (timerEl) {
                    timerEl.innerText = String(timerSync.data.timer.remainingSeconds);
                    console.log('🎯 TIMER DISPLAY UPDATED:', timerSync.data.timer.remainingSeconds);
                  }
                }
              } catch (error) {
                console.error('❌ Server coordinator failed:', error);
              }
            }
          }, 100);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jackpot_tickets'
      }, (payload) => {
        console.log(`🎫 REAL-TIME [${deviceType}]: Ticket updated`, payload);
        
        if (!isFetching && !isDrawing) {
          fetchGameData();
        }
      })
      // SERVER COUNTDOWN EVENT LISTENER
      .on('broadcast', { event: 'countdown_started' }, (payload) => {
        console.log(`⏰ SERVER COUNTDOWN STARTED [${deviceType}]:`, payload.payload);
        
        const eventData = payload.payload;
        if (eventData && !isDrawing) {
          const serverEndTime = new Date(eventData.timer_end_at);
          const remainingMs = serverEndTime.getTime() - Date.now();
          const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
          
          console.log(`🕐 COUNTDOWN SYNC: ${remainingSeconds}s remaining`);
          
          // Update timer immediately
          const timerEl = document.getElementById("jackpot-timer");
          if (timerEl) {
            timerEl.innerText = String(remainingSeconds);
          }
          
          // Refresh game data
          fetchGameData();
        }
      })
      // SERVER DRAWING EVENT LISTENER 
      .on('broadcast', { event: 'drawing_started' }, (payload) => {
        console.log(`🎬 SERVER DRAWING STARTED [${deviceType}]:`, payload.payload);
        
        if (!isDrawing && payload.payload?.game_id) {
          console.log(`🎯 Starting synchronized drawing for all users`);
          drawWinner();
        }
      })
      .on('broadcast', { event: 'jackpot_drawing_start' }, (payload) => {
        console.log(`🎰 DRAWING BROADCAST [${deviceType}]:`, payload.payload);
        
        if (!isDrawing && payload.payload?.winner_name) {
          setIsDrawing(true);
          setDrawingInProgress(true);
          setLastWinner({
            name: payload.payload.winner_name,
            amount: payload.payload.jackpot_amount
          });
        }
      })
      .subscribe((status) => {
        console.log(`📡 Real-time status [${deviceType}]:`, status);
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Enhanced sync active for ${deviceType}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Sync failed [${deviceType}] - reconnecting`);
          setTimeout(() => fetchGameData(), 1000);
        }
      });

    return () => {
      console.log(`🔌 Disconnecting real-time sync [${deviceType}]`);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Socket.IO realtime bridge (optional): sync timer/draw if a Socket.IO server is provided
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const updateTimer = (time: number) => {
      const el = document.getElementById('jackpot-timer');
      if (el) el.innerText = String(time);
    };

    const onStart = (time: number) => updateTimer(time);
    const onTick = (time: number) => updateTimer(time);
    const onDraw = () => {
      if (!isDrawing && !drawingInProgress) {
        drawWinner();
      }
    };

    socket.on('countdownStart', onStart);
    socket.on('countdownTick', onTick);
    socket.on('drawWinner', onDraw);

    // Ask server for current state on connect
    socket.emit('requestState');

    // Announce presence to start/extend countdown per server rules
    if (user?.id) {
      socket.emit('joinGame', user.id);
    }

    return () => {
      socket.off('countdownStart', onStart);
      socket.off('countdownTick', onTick);
      socket.off('drawWinner', onDraw);
    };
  }, [user?.id, isDrawing, drawingInProgress]);

  // Server-authoritative countdown timer
  useEffect(() => {
    if (!gameData?.id) return;

    console.log('🕐 Setting up server-authoritative timer for game:', gameData.id);
    
    const timerEl = document.getElementById("jackpot-timer");
    const progressEl = document.getElementById("jackpot-progress");
    const warningEl = document.getElementById("jackpot-warning");
    
    if (!timerEl) return;

    let syncInterval: NodeJS.Timeout;
    let isDrawTriggered = false;

    const syncWithServer = async () => {
      try {
        // Call the timer sync function to get server-authoritative state
        const { data, error } = await supabase.functions.invoke('jackpot-timer-sync');
        
        if (error) {
          console.error('⚠️ Timer sync failed:', error);
          return;
        }

        if (!data?.success || !data.hasActiveGame) {
          // No active game or timer
          if (timerEl) timerEl.innerText = "45";
          if (progressEl) progressEl.style.width = "0%";
          if (warningEl) warningEl.style.display = 'none';
          return;
        }

        const timerState = data.timer;
        
        if (!timerState?.active) {
          // No active timer - show waiting state
          if (timerEl) timerEl.innerText = "45";
          if (progressEl) progressEl.style.width = "0%";
          if (warningEl) warningEl.style.display = 'none';
          return;
        }

        // Update countdown display with server time
        if (timerEl) {
          timerEl.innerText = String(timerState.remainingSeconds);
          
          // Apply color changes based on server state
          switch (timerState.colorState) {
            case 'critical':
              timerEl.className = "text-3xl font-bold text-destructive transition-colors duration-300";
              break;
            case 'warning':
              timerEl.className = "text-3xl font-bold text-yellow-500 transition-colors duration-300";
              break;
            default:
              timerEl.className = "text-3xl font-bold text-primary transition-colors duration-300";
          }
        }

        // Update progress bar based on max countdown
        if (progressEl) {
          progressEl.style.width = `${timerState.progress}%`;
        }

        // Show/hide warning
        if (warningEl) {
          warningEl.style.display = timerState.shouldShowWarning ? 'block' : 'none';
        }

        // Handle server-triggered draw
        if (data.shouldStartDraw && !isDrawTriggered && !isDrawing) {
          console.log('🎰 Server triggered draw');
          isDrawTriggered = true;
          drawWinner();
        }

        // Refresh game state if timer completed
        if (timerState.remainingSeconds === 0 && !isDrawing && !isDrawTriggered) {
          console.log('🔄 Timer completed, refreshing...');
          setTimeout(() => fetchGameData(), 1000);
        }

      } catch (error) {
        console.error('❌ Timer sync error:', error);
      }
    };

    // Initial sync
    syncWithServer();

    // Sync every second for real-time updates
    syncInterval = setInterval(syncWithServer, 1000);

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [gameData?.id, isDrawing]);

  // Show loading state
  if (isDataLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div>Loading jackpot...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (loadingError) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-destructive">⚠️ Error loading jackpot</div>
            <p className="text-sm text-muted-foreground">{loadingError}</p>
            <Button 
              onClick={() => fetchGameData()} 
              variant="outline" 
              size="sm"
              disabled={isFetching}
            >
              {isFetching ? 'Loading...' : 'Try Again'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show no game state
  if (!gameData) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No Active Jackpot</h3>
              <p className="text-sm text-muted-foreground">Check back soon for the next round!</p>
            </div>
            <Button 
              onClick={() => fetchGameData()} 
              variant="outline" 
              size="sm"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const winChance = totalTickets > 0 ? ((userTickets / totalTickets) * 100).toFixed(1) : "0";

  return (
    <ErrorBoundary>
      <div className="w-full space-y-8">
        {/* Winner Announcement Modal - Only show for the actual winner */}
        {showWinnerAnnouncement && lastWinner && username && 
         lastWinner.name.toLowerCase() === username.toLowerCase() && (
          <WinnerAnnouncement
            winnerName={lastWinner.name}
            jackpotAmount={lastWinner.amount}
            onClose={() => setShowWinnerAnnouncement(false)}
          />
        )}

      {/* Main Game Layout - Live Chat + Wheel + 2x2 Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Live Chat (Full Height) */}
        <div className="col-span-12 lg:col-span-3">
          <JackpotLiveChat gameId={gameData?.id} />
        </div>

        {/* Center Column - Jackpot Wheel */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="bg-card border-border h-fit">
            <CardContent className="p-6">
              <div className="w-full max-w-lg mx-auto">
                <div className="flex justify-center">
                  <AnimatedSpinningWheel
                    key={`wheel-${players.length}-${players.map(p => p.username).join('-')}-${isDrawing ? 'drawing' : 'idle'}`}
                    currentPot={gameData.total_pool}
                    players={players}
                    isDrawing={isDrawing}
                    winnerName={lastWinner?.name}
                    onDrawComplete={handleDrawComplete}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 2x2 Grid */}
        <div className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Top Left - Place Your Bet */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold gradient-text flex items-center gap-2">
                  <Ticket className="h-3 w-3" />
                  Place Your Bet
                </CardTitle>
                <CardDescription className="text-xs">
                  ${gameData.ticket_price} per ticket
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {user ? (
                  <>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={ticketsToBuy}
                      onChange={(e) => setTicketsToBuy(Number(e.target.value))}
                      disabled={isLoading}
                      placeholder="Tickets"
                      className="text-center text-sm h-8"
                    />
                    
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Cost:</span>
                        <span className="font-medium">${(ticketsToBuy * gameData.ticket_price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Your Tickets:</span>
                        <span className="font-medium">{userTickets}</span>
                      </div>
                    </div>

                    <Button
                      onClick={buyTickets}
                      disabled={isLoading}
                      className="w-full h-8 text-xs"
                    >
                      {isLoading ? 'Buying...' : 'Buy Tickets'}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground mb-2">Login to bet</p>
                    <Button 
                      onClick={() => window.location.href = '/auth'}
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-xs"
                    >
                      Login
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Right - Recent Jackpots (moved from main page) */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold gradient-text flex items-center gap-2">
                  <Trophy className="h-3 w-3" />
                  Recent Jackpots
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground text-center py-4">
                  Recent winners will appear here
                </div>
              </CardContent>
            </Card>

            {/* Bottom Left - Next Draw */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold gradient-text flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Next Draw
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-center">
                  <div className="text-lg font-bold mb-1">
                    <span id="jackpot-timer">45</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Drawing in seconds
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1 mb-3">
                    <div
                      id="jackpot-progress"
                      className="bg-primary h-1 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: '0%' }}
                    />
                  </div>
                  
                  {/* Admin Reset Button */}
                  {isAdmin && (
                    <Button
                      onClick={restartActiveGame}
                      disabled={restartLoading}
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                    >
                      {restartLoading ? 'Restarting...' : 'Admin: Restart'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bottom Right - Active Players */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold gradient-text flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  Active Players
                </CardTitle>
                <CardDescription className="text-xs">
                  {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} • {players.length} player{players.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-24 overflow-y-auto custom-scrollbar">
                  {players.length > 0 ? (
                    <div className="space-y-1">
                       {players.slice(0, 3).map((player) => (
                         <div key={player.username} className="flex items-center justify-between text-xs">
                           <span 
                             className="truncate flex-1 font-medium"
                             style={{ color: player.color }}
                           >
                             {player.username}
                           </span>
                           <span className="text-muted-foreground">${player.total_value.toFixed(2)}</span>
                         </div>
                       ))}
                      {players.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{players.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <Users className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">No players yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      
      </div>
    </ErrorBoundary>
  );
};
