import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Hash } from 'lucide-react';
import { ProvablyFairDisplay } from './ProvablyFairDisplay';
import { addColorsToPlayers } from '@/lib/playerColors';

interface JackpotPlayer {
  username: string;
  tickets_bought: number;
  total_value: number;
  color: string;
  percentage: number;
  avatar?: string;
}

interface JackpotPlayersListProps {
  players: JackpotPlayer[];
  gameId?: string;
}

export const JackpotPlayersList = ({ players, gameId }: JackpotPlayersListProps) => {
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  
  // Add consistent colors to players
  const playersWithColors = addColorsToPlayers(players);
  
  if (playersWithColors.length === 0) {
    return (
      <div className="bg-card/30 rounded-lg p-6 text-center">
        <div className="text-muted-foreground text-sm">
          No players yet. Be the first to join!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {playersWithColors.map((player, index) => (
        <div 
          key={`${player.username}-${index}`}
          className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-card/80 transition-colors"
        >
          {/* Rank */}
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            {index + 1}
          </div>
          
          {/* Player Avatar */}
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: player.color }}
          >
            {player.avatar ? (
              <img 
                src={player.avatar} 
                alt={player.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              player.username.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div 
              className="font-medium truncate"
              style={{ color: player.color }}
            >
              {player.username}
            </div>
            <div className="text-xs text-muted-foreground">
              {player.tickets_bought} ticket{player.tickets_bought !== 1 ? 's' : ''}
            </div>
          </div>
          
          {/* Value */}
          <div className="text-sm font-medium text-foreground">
            ${player.total_value.toFixed(2)}
          </div>
        </div>
      ))}
      
      {/* Provably Fair */}
      <div className="pt-2 mt-3 border-t border-border">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>⚖️</span>
          <span>Provably Fair</span>
          {gameId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProvablyFair(true)}
              className="h-5 w-5 p-0 ml-1"
            >
              <Hash className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Provably Fair Modal */}
      {showProvablyFair && gameId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">{/* Updated to use custom-scrollbar class */}
            <div className="bg-background border rounded-lg p-1">
              <div className="flex justify-between items-center p-3 border-b">
                <h3 className="text-lg font-semibold">Provably Fair Verification</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProvablyFair(false)}
                >
                  ✕
                </Button>
              </div>
              <div className="p-3">
                <ProvablyFairDisplay
                  gameId={gameId}
                  gameType="jackpot"
                  showTitle={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};