import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PublicJackpotGame {
  id: string;
  ticket_price: number;
  total_pool: number;
  status: string;
  player_count: number;
}

export const PublicJackpotHistory = () => {
  const [games, setGames] = useState<PublicJackpotGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const loadPublicJackpotHistory = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_jackpot_stats');
        if (error) throw error;
        // Filter only completed games with winner info and limit to last 50 games
        const completedGames = (data || [])
          .filter(game => game.status === 'completed')
          .slice(0, 50); // Limit to maximum 50 games
        setGames(completedGames);
      } catch (error) {
        console.error('Failed to load public jackpot history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPublicJackpotHistory();

    // Subscribe to jackpot game updates
    const channel = supabase
      .channel('public-jackpot-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jackpot_games',
          filter: 'status=eq.completed'
        },
        () => {
          // Reload when a jackpot completes
          loadPublicJackpotHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-crypto-gold" />
            <CardTitle>Recent Jackpots</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading recent jackpots...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20 h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-crypto-gold" />
            <CardTitle>Recent Jackpots</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Last {games.length} games
          </Badge>
        </div>
        <CardDescription>
          Latest jackpot winners and prizes
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {games.length === 0 ? (
          <div className="text-center py-8 px-6 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No jackpots completed yet</p>
            <p className="text-sm">Be the first to win big!</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">{/* Updated to use custom-scrollbar class */}
            {games.map((game, index) => (
              <div 
                key={game.id}
                className="p-4 border border-border/40 rounded-lg bg-gradient-to-r from-secondary/20 to-secondary/10 hover:from-secondary/30 hover:to-secondary/20 transition-all duration-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Crown className="w-8 h-8 text-crypto-gold" />
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-crypto-gold rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-foreground">Jackpot #{game.id.slice(0, 8)}</span>
                        <Badge 
                          variant="default" 
                          className="bg-crypto-gold text-black text-xs"
                        >
                          WON
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <span>{game.player_count} players</span>
                        <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                        <span>${game.ticket_price} per ticket</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-crypto-gold">
                      ${game.total_pool.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Prize Pool
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {games.length >= 50 && (
              <div className="text-center py-3 text-xs text-muted-foreground border-t border-border/30">
                Showing last 50 jackpots • Scroll to see all
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};