import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserBalance } from "@/hooks/useUserBalance";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CrownIcon } from "@/components/CrownIcon";
import { CoinIcon } from "@/components/CoinIcon";
import { ArrowLeft, LogIn, Coins, Trophy, Users, Shield, Plus, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CoinflipAnimationTracker } from "@/components/CoinflipAnimationTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAnimationStateManager } from "@/components/AnimationStateManager";
import { useMultipleCoinflipGames } from "@/hooks/useMultipleCoinflipGames";
import { JackpotLiveChat } from "@/components/JackpotLiveChat";
import { supabase } from "@/integrations/supabase/client";

// Game interfaces and types (updated to match database schema)
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

// Provably Fair Crypto Functions
const generateRandomSeed = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (message: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const hmacSha256 = async (key: string, message: string): Promise<string> => {
  const keyBuffer = new TextEncoder().encode(key);
  const messageBuffer = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const determineWinner = async (serverSeed: string, clientSeed: string): Promise<'heads' | 'tails'> => {
  const hmac = await hmacSha256(serverSeed, clientSeed);
  // Use first 8 characters of HMAC to determine result
  const hexValue = hmac.substring(0, 8);
  const decimalValue = parseInt(hexValue, 16);
  return decimalValue % 2 === 0 ? 'heads' : 'tails';
};

const Coinflip = () => {
  const { user, loading: authLoading } = useAuth();
  const { balance, username } = useUserBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const coinRef = useRef<HTMLDivElement>(null);

  // UI state for creating new games - Set immediately for fast display
  const [selectedChoice, setSelectedChoice] = useState<'heads' | 'tails'>('heads');
  const [betAmount, setBetAmount] = useState<string>('10');
  const [isUIReady, setIsUIReady] = useState(true); // UI loads immediately

  // Use the new multiple games hook - but don't block UI
  const {
    openGames,
    myActiveGames,
    completedGames,
    flippingGames,
    loadGames,
    setGameFlipping,
    isGameFlipping
  } = useMultipleCoinflipGames();
  const [activeAnimations, setActiveAnimations] = useState<Map<string, 'heads' | 'tails'>>(new Map());
  
  // Enhanced animation state management
  const animationManager = useAnimationStateManager({ 
    onStateChange: (state) => {
      console.log('🎬 Animation state changed:', state);
    }
  });

  // Listen for coin flip events and handle stuck games
  useEffect(() => {
    const handleStartCoinFlip = (event: CustomEvent) => {
      const { gameId, timestamp, result } = event.detail;
      console.log(`🎯 Received startCoinFlip event for game: ${gameId}`, { timestamp, result });
      // IMMEDIATE response for perfect sync
      startCoinFlip(gameId, result);
    };

    window.addEventListener('startCoinFlip', handleStartCoinFlip as EventListener);
    
    // Auto-detect stuck flipping games and trigger animation
    const checkStuckGames = () => {
      myActiveGames.forEach(game => {
        if (game.status === 'flipping' && !isGameFlipping(game.id) && !activeAnimations.has(game.id)) {
          console.log(`🚨 Detected stuck game: ${game.id}, triggering IMMEDIATE animation`);
          // IMMEDIATE trigger for stuck games - no delay
          startCoinFlip(game.id, (game.result as 'heads' | 'tails') || undefined);
        }
      });
    };
    
    // Check for stuck games every 3 seconds (increased from 2 to reduce spam)
    const stuckGameInterval = setInterval(checkStuckGames, 3000);
    
    return () => {
      window.removeEventListener('startCoinFlip', handleStartCoinFlip as EventListener);
      clearInterval(stuckGameInterval);
    };
  }, [myActiveGames, isGameFlipping, activeAnimations]);

  // Game logic functions
  const createGame = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to create a game",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(betAmount);
    if (amount < 1 || amount > 10000) {
      toast({
        title: "Invalid Bet Amount",
        description: "Bet amount must be between $1 and $10,000",
        variant: "destructive"
      });
      return;
    }

    try {
      // Ensure user has sufficient balance first
      if (balance < amount) {
        toast({
          title: "Insufficient Balance",
          description: `You need $${amount.toFixed(2)} to create this game`,
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('coinflip_games')
        .insert({
          player1_id: user.id,
          player1_username: username || user.email?.split('@')[0] || 'Player',
          player1_choice: selectedChoice,
          bet_amount: amount,
          status: 'waiting'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Game Created!",
        description: "Waiting for another player to join...",
      });

      // Force immediate balance refresh for bet deduction
      const balanceRefreshEvent = new CustomEvent('forceBalanceRefresh');
      window.dispatchEvent(balanceRefreshEvent);

      loadGames(); // Refresh games list
    } catch (error) {
      console.error('Error creating game:', error);
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const joinGame = async (game: CoinflipGame) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to join a game",
        variant: "destructive"
      });
      return;
    }

    if (game.player1_id === user.id) {
      toast({
        title: "Cannot Join Own Game",
        description: "You cannot join your own game",
        variant: "destructive"
      });
      return;
    }

    // Force opposing choices - essential for coinflip game logic
    const joinerChoice: 'heads' | 'tails' = game.player1_choice === 'heads' ? 'tails' : 'heads';

    try {
      const { error } = await supabase
        .from('coinflip_games')
        .update({
          player2_id: user.id,
          player2_username: username || user.email?.split('@')[0] || 'Player',
          player2_choice: joinerChoice,
          status: 'flipping'
        })
        .eq('id', game.id);

      if (error) throw error;

      toast({
        title: "Joined Game!",
        description: "Starting coin flip...",
      });

      // Don't trigger here - let the real-time subscription handle it
      console.log(`✅ Joined game ${game.id}, real-time will trigger animation`);
      
      // Force balance refresh immediately
      const balanceRefreshEvent = new CustomEvent('forceBalanceRefresh');
      window.dispatchEvent(balanceRefreshEvent);

      loadGames(); // Refresh to get updated game
    } catch (error) {
      console.error('Error joining game:', error);
      toast({
        title: "Error",
        description: "Failed to join game. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Cancel own waiting game
  const cancelMyGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('coinflip_games')
        .update({ status: 'cancelled' })
        .eq('id', gameId);

      if (error) throw error;

      toast({ title: 'Game cancelled', description: 'Your game was removed from the list.' });
      loadGames();
    } catch (error) {
      console.error('Error cancelling game:', error);
      toast({ title: 'Error', description: 'Failed to cancel game.', variant: 'destructive' });
    }
  };

  // Simplified synchronized coin flip animation
  const startCoinFlip = async (gameId: string, predeterminedResult?: 'heads' | 'tails') => {
    console.log(`🎯 Starting synchronized coin flip for game: ${gameId}`);
    
    if (isGameFlipping(gameId)) {
      console.log(`⚠️ Game ${gameId} already flipping, skipping`);
      return;
    }

    try {
      // Mark game as flipping
      setGameFlipping(gameId, true);
      
      // Use predetermined result or get from database
      const { data: currentGame } = await supabase
        .from('coinflip_games')
        .select('result')
        .eq('id', gameId)
        .maybeSingle();

      const gameResult: 'heads' | 'tails' = predeterminedResult || 
        (currentGame?.result as 'heads' | 'tails') || 'heads';
      
      // Set animation with exact 3.8s duration
      setActiveAnimations(prev => new Map(prev.set(gameId, gameResult)));
      console.log(`🎯 Starting 3.8s animation for game ${gameId}: ${gameResult}`);

      // Auto-complete after exactly 3.8 seconds
      setTimeout(() => {
        setGameFlipping(gameId, false);
        setActiveAnimations(prev => {
          const newMap = new Map(prev);
          newMap.delete(gameId);
          return newMap;
        });
        console.log(`✅ Animation completed for game ${gameId}`);
      }, 3800);

    } catch (error) {
      console.error('Error in startCoinFlip:', error);
      
      // Clean up on error
      setGameFlipping(gameId, false);
      setActiveAnimations(prev => {
        const newMap = new Map(prev);
        newMap.delete(gameId);
        return newMap;
      });
      
      toast({
        title: "Error",
        description: "Failed to start coin flip. Please try again.",
        variant: "destructive"
      });
    }
  };


  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/20 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
                <div className="flex items-center">
                  <div className="relative">
                    <h1 className="text-xl font-bold gradient-text mt-2">PVPCasino</h1>
                    <CrownIcon className="w-10 h-10 absolute -top-3 left-2" />
                    <p className="text-sm text-muted-foreground mt-1">Provably Fair Coinflip</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-4">
                    <Badge variant="default" className="bg-crypto-gold text-black">
                      ${balance.toFixed(2)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {username || user?.email?.split('@')[0] || 'Player'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => navigate("/auth")} 
                    variant="default"
                    className="bg-primary hover:bg-primary/90"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {!user ? (
          <div className="container mx-auto px-4 py-12 text-center">
            <LogIn className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">Please login to play Coinflip</p>
            <Button onClick={() => navigate('/auth')} className="glow-effect">
              <LogIn className="h-4 w-4 mr-2" />
              Login to Play
            </Button>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-4">
            {/* Main Layout - Active Games (Large) + Right Sidebar */}
            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
              
              {/* Large Active Games Section (8 columns) */}
              <div className="col-span-8">
                <Card className="h-full bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold gradient-text">Active Games</CardTitle>
                    <CardDescription>Join an existing game or wait for players to join yours</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-100px)]">
                    <div className="space-y-4 h-full overflow-y-auto pr-2">
                      {/* My Active Games */}
                      {myActiveGames.map((game) => (
                        <div
                          key={game.id}
                          className="relative p-3 border rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300"
                        >
                          {/* Horizontal Bar Layout */}
                          <div className="flex items-center justify-between h-16">
                            {/* Left Side - Player 1 */}
                            <div className="flex items-center gap-3 flex-1">
                              <div className="text-left">
                                <div className="font-bold text-sm">{game.player1_username}</div>
                                <div className="text-xs text-muted-foreground">${game.bet_amount}</div>
                              </div>
                            </div>

                            {/* Center - Coin Animation */}
                            <div className="flex-shrink-0 relative">
                              {game.status === 'flipping' && isGameFlipping(game.id) && activeAnimations.has(game.id) ? (
                                <div className="w-16 h-16 relative coin-3d">
                                  <div 
                                    className={`coin-container ${isGameFlipping(game.id) ? `coin-flipping ${activeAnimations.get(game.id)}-result` : ''}`}
                                    style={{
                                      width: '64px',
                                      height: '64px',
                                      transformStyle: 'preserve-3d',
                                      perspective: '1000px',
                                    }}
                                  >
                                    <div className="coin-side coin-heads">
                                      <img 
                                        src="/lovable-uploads/105aa71c-7531-4a7e-bab4-142cbad338d9.png" 
                                        alt="Heads" 
                                        className="w-full h-full object-contain rounded-full" 
                                        loading="eager"
                                      />
                                    </div>
                                    <div className="coin-side coin-tails">
                                      <img 
                                        src="/lovable-uploads/cb546342-bd06-4ad4-b5cd-a81ce18a44fb.png" 
                                        alt="Tails" 
                                        className="w-full h-full object-contain rounded-full"
                                        loading="eager"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-16 h-16 flex items-center justify-center border-2 border-primary/30 rounded-full bg-background/50">
                                  <CoinIcon side={game.player1_choice as 'heads' | 'tails'} className="h-8 w-8" />
                                </div>
                              )}
                            </div>

                            {/* Right Side - Player 2 */}
                            <div className="flex items-center gap-3 flex-1 justify-end">
                              {game.player2_username ? (
                                <div className="text-right">
                                  <div className="font-bold text-sm">{game.player2_username}</div>
                                  <div className="text-xs text-muted-foreground">${game.bet_amount}</div>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="text-sm text-muted-foreground">Waiting for</div>
                                  <div className="text-xs text-muted-foreground">opponent</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cancel Button for waiting games */}
                          {game.status === 'waiting' && (
                            <div className="absolute top-2 right-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cancelMyGame(game.id)}
                                className="h-6 px-2 text-xs hover:bg-destructive/10 hover:border-destructive/30"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Open Games */}
                      {openGames.map((game) => (
                        <div
                          key={game.id}
                          className="relative p-3 border rounded-lg bg-gradient-to-r from-secondary/5 to-primary/5 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                        >
                          {/* Horizontal Bar Layout */}
                          <div className="flex items-center justify-between h-16">
                            {/* Left Side - Player 1 */}
                            <div className="flex items-center gap-3 flex-1">
                              <div className="text-left">
                                <div className="font-bold text-sm">{game.player1_username}</div>
                                <div className="text-xs text-muted-foreground">${game.bet_amount}</div>
                              </div>
                            </div>

                            {/* Center - Coin Icon (Static for Open Games) */}
                            <div className="flex-shrink-0 relative">
                              <div className="w-16 h-16 flex items-center justify-center border-2 border-primary/30 rounded-full bg-background/50">
                                <CoinIcon side={game.player1_choice as 'heads' | 'tails'} className="h-8 w-8" />
                              </div>
                            </div>

                            {/* Right Side - Join Option */}
                            <div className="flex items-center gap-3 flex-1 justify-end">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">You play</div>
                                <div className="text-xs font-bold text-primary">
                                  {game.player1_choice === 'heads' ? 'TAILS' : 'HEADS'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Join Button */}
                          <div className="absolute top-2 right-2">
                            <Button
                              onClick={() => joinGame(game)}
                              size="sm"
                              className="h-6 px-3 text-xs font-bold glow-effect bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                            >
                              Join ${game.bet_amount}
                            </Button>
                          </div>
                        </div>
                      ))}

                      {openGames.length === 0 && myActiveGames.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <div className="relative">
                            <Coins className="h-20 w-20 mx-auto mb-6 opacity-30" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent rounded-full" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">No active games</h3>
                          <p className="text-sm">Create a new game to get started!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Sidebar (4 columns) */}
              <div className="col-span-4 flex flex-col gap-6">
                
                {/* Top Row - Place Your Bet and Last 25 Games */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Place Your Bet */}
                  <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold gradient-text">Place Your Bet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Compact 3D Coin Display */}
                      <div className="flex justify-center">
                        <div 
                          ref={coinRef}
                          className="coin-3d relative cursor-pointer transition-all duration-500 hover:scale-105"
                          style={{
                            width: '60px',
                            height: '60px',
                            transformStyle: 'preserve-3d',
                            transform: `rotateY(${selectedChoice === 'tails' ? '180deg' : '0deg'})`,
                          }}
                        >
                          <div className="coin-side coin-heads">
                            <img 
                              src="/lovable-uploads/105aa71c-7531-4a7e-bab4-142cbad338d9.png" 
                              alt="Gold Heads" 
                              className="w-full h-full object-contain rounded-full" 
                              loading="eager"
                            />
                          </div>
                          
                          <div className="coin-side coin-tails">
                            <img 
                              src="/lovable-uploads/cb546342-bd06-4ad4-b5cd-a81ce18a44fb.png" 
                              alt="Silver Tails" 
                              className="w-full h-full object-contain rounded-full"
                              loading="eager"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Compact controls */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          <Button
                            variant={selectedChoice === 'heads' ? 'secondary' : 'outline'}
                            onClick={() => setSelectedChoice('heads')}
                            className="h-6 text-xs"
                          >
                            H
                          </Button>
                          <Button
                            variant={selectedChoice === 'tails' ? 'secondary' : 'outline'}
                            onClick={() => setSelectedChoice('tails')}
                            className="h-6 text-xs"
                          >
                            T
                          </Button>
                        </div>
                        
                        <Input
                          type="number"
                          placeholder="$"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          className="h-6 text-xs text-center"
                        />
                        
                        <Button
                          onClick={createGame}
                          className="w-full h-6 text-xs font-bold glow-effect"
                          disabled={!betAmount || parseFloat(betAmount) < 1}
                        >
                          Create
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Last 25 Games */}
                  <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold gradient-text">Last 25 Games</CardTitle>
                    </CardHeader>
                     <CardContent>
                      <style>{`
                        .custom-scrollbar::-webkit-scrollbar {
                          width: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                          background: hsl(var(--background));
                          border-radius: 3px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                          background: linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary)/0.7));
                          border-radius: 3px;
                          transition: all 0.3s ease;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                          background: linear-gradient(180deg, hsl(var(--primary)/0.9), hsl(var(--primary)/0.6));
                          transform: scale(1.1);
                        }
                      `}</style>
                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {completedGames.slice(0, 8).map((game) => (
                          <div
                            key={game.id}
                            className="flex items-center justify-between p-1 border rounded bg-card/30"
                          >
                            <div className="flex items-center gap-1">
                              <CoinIcon side={game.result as 'heads' | 'tails'} className="h-3 w-3" />
                              <span className="text-xs font-medium truncate max-w-16">
                                {game.winner_id === game.player1_id ? game.player1_username : game.player2_username}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-crypto-green">
                                ${game.bet_amount}
                              </p>
                            </div>
                          </div>
                        ))}

                        {completedGames.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            <Trophy className="h-6 w-6 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">No games yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Live Chat - Full width, properly aligned */}
                <div className="flex-1">
                  <JackpotLiveChat />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Coin Flip Animation Tracker */}
        {Array.from(activeAnimations.entries()).map(([gameId, result]) => (
          <CoinflipAnimationTracker
            key={gameId}
            isFlipping={isGameFlipping(gameId)}
            expectedResult={result}
            onAnimationStart={() => console.log(`🎬 Animation started for game: ${gameId}`)}
            onAnimationEnd={() => console.log(`🎬 Animation ended for game: ${gameId}`)}
            onFrameRateUpdate={(fps) => console.log(`📊 FPS for game ${gameId}: ${fps}`)}
          />
        ))}
      </div>
    </ErrorBoundary>
  );
};

export default Coinflip;