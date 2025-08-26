import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";



import { SecurityAlert } from "@/components/SecurityAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CrownIcon } from "@/components/CrownIcon";
import { connectGameServer, disconnectGameServer } from "@/lib/socket";
import { TrendingUp, Zap, Shield, LogIn, Gamepad2, Trophy, User } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    connectGameServer();
    return () => disconnectGameServer();
  }, []);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (!error && data) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative">
                <h1 className="text-2xl font-bold gradient-text mt-2">PVPCasino</h1>
                <CrownIcon className="w-12 h-12 absolute -top-4 left-3" />
                <p className="text-sm text-muted-foreground mt-1">Provably Fair P2P</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button 
                    onClick={() => navigate('/security')} 
                    variant="outline" 
                    size="sm"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Security
                  </Button>
                )}
                {user ? (
                  <Button 
                    onClick={() => navigate('/profile')} 
                    variant="outline" 
                    size="sm"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                ) : (
                  <Button 
                    onClick={() => navigate('/auth')} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                )}
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Shield className="h-4 w-4 mr-2" />
                    How It Works
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-crypto-gold" />
                      Provably Fair Gaming
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-crypto-blue mb-2">🎯 Player vs Player, Not House</h4>
                      <p className="text-muted-foreground">
                        Unlike traditional casinos, you're not betting against the house. Every game is between real players, 
                        ensuring fair competition where skill and luck determine the winner, not rigged algorithms.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-crypto-green mb-2">🔒 Cryptographic Transparency</h4>
                      <p className="text-muted-foreground">
                        Every game result is generated using cryptographic hashes that can be verified by anyone. 
                        Before each game, we publish a "server seed" hash. After the game, we reveal the actual seed, 
                        allowing you to verify the result was predetermined and not manipulated.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-crypto-gold mb-2">💰 Zero House Edge</h4>
                      <p className="text-muted-foreground">
                        We take 0% commission from your winnings. The platform operates on a peer-to-peer model 
                        where players compete directly against each other. Your odds are determined purely by 
                        mathematical probability, not house advantage.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-primary mb-2">⚡ How Jackpot Works</h4>
                      <p className="text-muted-foreground">
                        Players buy tickets with their chosen amount. Each ticket gives you a proportional chance 
                        to win the entire pot. A cryptographically secure random number determines the winner 
                        based on ticket ranges. More tickets = higher winning chance, but anyone can win.
                      </p>
                    </div>
                    
                     <div>
                       <h4 className="font-semibold text-crypto-red mb-2">🎲 Coinflip Mechanics</h4>
                       <p className="text-muted-foreground">
                         Simple heads or tails game with 50/50 odds. Choose your side and double your bet if you win!
                       </p>
                     </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Security Alert */}
      <div className="container mx-auto px-4 pt-8">
        <SecurityAlert className="max-w-2xl mx-auto" />
      </div>

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold mb-6">
              The Future of <span className="gradient-gold-text">Fair</span> Gambling
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Cash casino with provably fair games and instant payouts. 
              No house edge, just pure odds and luck.
            </p>
            <div className="flex justify-center gap-8 mb-12">
              <div className="text-center">
                <div className="bg-crypto-green/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="h-8 w-8 text-crypto-green" />
                </div>
                <p className="font-semibold">0% Fees</p>
                <p className="text-xs text-muted-foreground">No house edge</p>
              </div>
              <div className="text-center">
                <div className="bg-crypto-blue/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-8 w-8 text-crypto-blue" />
                </div>
                <p className="font-semibold">Instant Results</p>
                <p className="text-xs text-muted-foreground">Real-time matches</p>
              </div>
              <div className="text-center">
                <div className="bg-crypto-gold/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-8 w-8 text-crypto-gold" />
                </div>
                <p className="font-semibold">Provably Fair</p>
                <p className="text-xs text-muted-foreground">Cryptographic proof</p>
              </div>
            </div>
            
            {/* Game Navigation */}
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => navigate('/coinflip')}
                size="lg"
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                <Gamepad2 className="h-5 w-5 mr-2" />
                Play Coinflip
              </Button>
              <Button 
                onClick={() => navigate('/jackpot')}
                size="lg"
                variant="outline"
                className="border-crypto-gold/50 hover:bg-crypto-gold/10"
              >
                <Trophy className="h-5 w-5 mr-2" />
                Play Jackpot
              </Button>
            </div>
          </div>
        </div>
        
      </section>


      {/* Footer */}
      <footer className="border-t border-border/20 py-8 px-4 text-center text-muted-foreground">
        <div className="container mx-auto">
          <p className="text-sm">
            Secure P2P Gaming Platform
          </p>
        </div>
      </footer>

      {/* Live Chat */}
      
    </div>
  );
};

export default Index;
