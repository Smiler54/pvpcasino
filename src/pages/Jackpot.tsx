import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserBalance } from "@/hooks/useUserBalance";
import { JackpotGame } from "@/components/JackpotGame";
import { PublicJackpotHistory } from "@/components/PublicJackpotHistory";
import UserProfile from "@/components/UserProfile";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrownIcon } from "@/components/CrownIcon";
import { connectGameServer, disconnectGameServer } from "@/lib/socket";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn } from "lucide-react";

const Jackpot = () => {
  const { user, loading } = useAuth();
  const { balance, username } = useUserBalance();
  const navigate = useNavigate();

  useEffect(() => {
    connectGameServer();
    return () => disconnectGameServer();
  }, []);

  return (
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
                  <p className="text-sm text-muted-foreground mt-1">Jackpot Lottery</p>
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
                      Logged in as <span className="font-medium">{username || 'Loading...'}</span>
                    </span>
                    <Button 
                      onClick={() => navigate('/profile')} 
                      variant="outline" 
                      size="sm"
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Single column layout - Jackpot Game now contains its own layout */}
          <div className="w-full">
            <JackpotGame />
          </div>
        </div>
      </main>

      {/* Live Chat */}
      
    </div>
  );
};

export default Jackpot;