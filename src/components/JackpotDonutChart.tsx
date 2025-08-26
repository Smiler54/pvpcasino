import React, { useEffect, useState, useMemo } from 'react';

interface JackpotPlayer {
  username: string;
  tickets_bought: number;
  color: string;
  percentage: number;
}

interface JackpotDonutChartProps {
  currentPot: number;
  players: JackpotPlayer[];
  isDrawing?: boolean;
  winnerName?: string;
  onDrawComplete?: () => void;
}

export const JackpotDonutChart = ({ 
  currentPot, 
  players,
  isDrawing = false,
  winnerName,
  onDrawComplete 
}: JackpotDonutChartProps) => {
  const [showWinner, setShowWinner] = useState(false);

  const radius = 180;
  const strokeWidth = 40;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Memoize segments calculation to prevent unnecessary re-renders
  const segments = useMemo(() => {
    let cumulativePercentage = 0;
    return players.map(player => {
      const startPercentage = cumulativePercentage;
      cumulativePercentage += player.percentage;
      return {
        ...player,
        startPercentage,
        strokeDasharray: `${(player.percentage / 100) * circumference} ${circumference}`,
        strokeDashoffset: circumference - (startPercentage / 100) * circumference,
      };
    });
  }, [players, circumference]);

  // Memoize winner index to prevent recalculation
  const winnerIndex = useMemo(() => {
    return winnerName ? players.findIndex(p => p.username === winnerName) : -1;
  }, [winnerName, players]);

  // Simplified animation handling - no complex phases
  useEffect(() => {
    if (!isDrawing) {
      setShowWinner(false);
      return;
    }

    // Show winner after short spinning delay
    const winnerTimeout = setTimeout(() => {
      if (winnerName) {
        setShowWinner(true);
        
        // Complete after showing winner
        const completeTimeout = setTimeout(() => {
          onDrawComplete?.();
        }, 2000); // Reduced from 3000ms to 2000ms
        
        return () => clearTimeout(completeTimeout);
      } else {
        // If no winner name yet, complete the draw anyway after timeout
        const fallbackTimeout = setTimeout(() => {
          onDrawComplete?.();
        }, 3000);
        
        return () => clearTimeout(fallbackTimeout);
      }
    }, 1000); // Reduced from 1500ms to 1000ms
    
    return () => clearTimeout(winnerTimeout);
  }, [isDrawing, winnerName, onDrawComplete]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Optimized animation overlay - reduced complexity */}
      {isDrawing && (
        <div className="absolute inset-0 z-10 bg-background/90 rounded-full flex items-center justify-center">
          <div className="text-center space-y-4">
            {!showWinner ? (
              <div className="space-y-3">
                <div className="w-12 h-12 border-3 border-crypto-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="text-lg font-bold text-crypto-gold">Drawing Winner...</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-6xl">🎉</div>
                <div className="text-xl font-bold gradient-gold-text">WINNER!</div>
                <div className="text-lg text-foreground font-semibold">{winnerName}</div>
                <div className="text-2xl font-bold text-crypto-gold">${currentPot.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <svg
        height={radius * 2}
        width={radius * 2}
        className={`transform -rotate-90 transition-opacity duration-500 ${
          isDrawing ? 'opacity-30' : 'opacity-100'
        }`}
      >
        {/* Background circle */}
        <circle
          stroke="hsl(var(--muted))"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          opacity="0.3"
        />
        
        {/* Player segments with optimized rendering */}
        {segments.map((segment, index) => {
          const isWinner = winnerIndex === index && showWinner;
          
          return (
            <circle
              key={`segment-${index}`}
              stroke={segment.color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="transition-opacity duration-500"
              style={{
                opacity: isDrawing ? (isWinner ? 1 : 0.3) : 0.9,
                filter: isWinner && showWinner
                  ? 'drop-shadow(0 0 10px currentColor)' 
                  : 'drop-shadow(0 0 3px currentColor)',
              }}
            />
          );
        })}
      </svg>
      
      {/* Center content - optimized visibility */}
      {!isDrawing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-sm text-muted-foreground mb-1">Current Pot</div>
          <div className="text-3xl font-bold gradient-gold-text mb-2">
            {currentPot.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
};