import { Crown, Trophy, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WinnerAnnouncementProps {
  winnerName: string;
  jackpotAmount: number;
  onClose?: () => void;
}

export const WinnerAnnouncement = ({ winnerName, jackpotAmount, onClose }: WinnerAnnouncementProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gradient-to-br from-crypto-gold/20 to-crypto-blue/20 border-crypto-gold/50 max-w-md w-full">
        <CardContent className="text-center p-8 space-y-6">
          {/* Crown Animation */}
          <div className="flex justify-center">
            <div className="relative">
              <Crown className="h-16 w-16 text-crypto-gold animate-bounce" />
              <div className="absolute -inset-2 bg-crypto-gold/20 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Winner Announcement */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold gradient-gold-text">
              🎉 JACKPOT WINNER! 🎉
            </h2>
            
            <div className="bg-secondary/30 p-4 rounded-lg border border-crypto-gold/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-crypto-gold" />
                <span className="text-sm text-muted-foreground">Winner</span>
              </div>
              <Badge className="bg-gradient-primary text-white font-bold text-lg px-4 py-2">
                {winnerName}
              </Badge>
            </div>

            <div className="bg-secondary/30 p-4 rounded-lg border border-crypto-blue/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-crypto-blue" />
                <span className="text-sm text-muted-foreground">Prize</span>
              </div>
              <div className="text-3xl font-bold gradient-gold-text">
                ${jackpotAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Celebration Text */}
          <p className="text-lg text-crypto-gold font-semibold animate-pulse">
            Congratulations! 🎊
          </p>

          {/* Auto-close notification */}
          <p className="text-xs text-muted-foreground">
            New jackpot starting soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};