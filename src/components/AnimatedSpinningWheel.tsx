import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Trophy, Star } from 'lucide-react';
import { addColorsToPlayers } from '@/lib/playerColors';

interface WheelPlayer {
  username: string;
  tickets_bought: number;
  total_value: number;
  percentage: number;
  color?: string;
}

interface AnimatedSpinningWheelProps {
  currentPot: number;
  players: WheelPlayer[];
  isDrawing?: boolean;
  winnerName?: string;
  onDrawComplete?: () => void;
  timerEndAt?: string;
  onTimerExpire?: () => void;
}

export const AnimatedSpinningWheel = ({
  currentPot,
  players,
  isDrawing = false,
  winnerName,
  onDrawComplete,
  timerEndAt,
  onTimerExpire
}: AnimatedSpinningWheelProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [confetti, setConfetti] = useState(false);

  const radius = 220;
  const strokeWidth = 60;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Enhanced color assignment with performance monitoring
  const playersWithColors = useMemo(() => {
    const startTime = performance.now();
    console.group('🎨 AnimatedSpinningWheel - Color Assignment');
    console.log('Raw players received:', players);
    console.log('Players count:', players.length);
    
    const coloredPlayers = addColorsToPlayers(players);
    
    const endTime = performance.now();
    console.log('Color assignment completed in:', (endTime - startTime).toFixed(2), 'ms');
    console.log('Final players with colors:', coloredPlayers);
    
    // Store debug info globally for testing
    (window as any).wheelColorDebug = {
      rawPlayers: players,
      coloredPlayers,
      processingTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };
    
    console.groupEnd();
    return coloredPlayers;
  }, [JSON.stringify(players)]); // Use JSON.stringify to detect deep changes

  // Enhanced segment calculation for first user 100% slice handling
  const segments = useMemo(() => {
    const startTime = performance.now();
    console.group('⚙️ AnimatedSpinningWheel - Segment Calculation');
    console.log('Calculating segments for', playersWithColors.length, 'players');
    
    // CRITICAL FIX: Single player MUST get full wheel
    if (playersWithColors.length === 1) {
      const singlePlayer = playersWithColors[0];
      const segment = {
        username: singlePlayer.username,
        tickets_bought: singlePlayer.tickets_bought,
        total_value: singlePlayer.total_value,
        startAngle: 0,
        endAngle: 360,
        index: 0,
        angleSpan: 360,
        isValid: true,
        isFirstUserSlice: true,
        percentage: 100,
        color: singlePlayer.color || 'hsl(0, 70%, 50%)' // Bright red fallback
      };
      
      console.log('🔴 SINGLE PLAYER - FULL WHEEL:', segment);
      console.groupEnd();
      return [segment];
    }
    
    let cumulativePercentage = 0;
    const calculatedSegments = playersWithColors.map((player, index) => {
      const startAngle = (cumulativePercentage / 100) * 360;
      const endAngle = ((cumulativePercentage + player.percentage) / 100) * 360;
      cumulativePercentage += player.percentage;
      
      const segment = {
        ...player,
        startAngle,
        endAngle,
        index,
        angleSpan: endAngle - startAngle,
        isValid: endAngle > startAngle && player.percentage > 0,
        isFirstUserSlice: false
      };
      
      console.log(`Segment ${index + 1} (${segment.username}):`, {
        color: segment.color,
        percentage: segment.percentage.toFixed(2) + '%',
        angles: `${segment.startAngle.toFixed(1)}° → ${segment.endAngle.toFixed(1)}°`,
        span: segment.angleSpan.toFixed(1) + '°',
        valid: segment.isValid
      });
      
      return segment;
    });
    
    // Validation checks
    const totalPercentage = playersWithColors.reduce((sum, p) => sum + p.percentage, 0);
    const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;
    
    const endTime = performance.now();
    console.log('Segment calculation completed in:', (endTime - startTime).toFixed(2), 'ms');
    console.log('Total percentage:', totalPercentage.toFixed(2) + '%', isValidTotal ? '✅' : '❌');
    
    console.groupEnd();
    return calculatedSegments;
  }, [playersWithColors]);

  // Fixed drawing animation with immediate CSS transform
  useEffect(() => {
    if (!isDrawing) {
      setIsSpinning(false);
      setShowWinner(false);
      setConfetti(false);
      setSpinRotation(0);
      
      // Reset wheel transform immediately
      const wheelElement = document.querySelector('.wheel-spinning') as HTMLElement;
      if (wheelElement) {
        wheelElement.style.transition = 'none';
        wheelElement.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
        wheelElement.style.willChange = 'auto';
      }
      return;
    }

    console.log('🎰 STARTING WHEEL ANIMATION - Winner:', winnerName);
    console.log('🎰 SEGMENTS COUNT:', segments.length);
    console.log('🎰 SEGMENTS DATA:', segments);
    
    setIsSpinning(true);
    
    // Force immediate DOM update
    setTimeout(() => {
      const wheelElement = document.querySelector('.wheel-spinning') as HTMLElement;
      if (!wheelElement) {
        console.error('❌ WHEEL ELEMENT NOT FOUND!');
        return;
      }

      console.log('✅ WHEEL ELEMENT FOUND, STARTING ANIMATION');
      
      // Find the winning segment
      const winningPlayer = segments.find(s => s.username === winnerName);
      
      if (winnerName && winningPlayer) {
        // Calculate target angle for the winner - ensure it stops at top (90 degrees)
        const segmentCenter = (winningPlayer.startAngle + winningPlayer.endAngle) / 2;
        const targetAngle = 90 - segmentCenter; // Point to top
        const finalRotation = 1800 + targetAngle; // 5 full rotations + target
        
        console.log(`🎯 ANIMATION TARGET: Winner: ${winnerName}, Segment: ${segmentCenter}°, Final: ${finalRotation}°`);
        
        // Apply immediate animation with hardware acceleration (6s duration for more excitement)
        wheelElement.style.willChange = 'transform';
        wheelElement.style.transition = 'transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelElement.style.transform = `translate3d(0, 0, 0) rotate(${finalRotation}deg)`;
        
        setSpinRotation(finalRotation);
        
        // Complete animation after 6 seconds
        setTimeout(() => {
          console.log('🎉 WHEEL ANIMATION COMPLETED');
          setIsSpinning(false);
          setShowWinner(true);
          setConfetti(true);
          wheelElement.style.willChange = 'auto';
          
          setTimeout(() => {
            onDrawComplete?.();
          }, 3000); // Extended announcement display time
        }, 6000);
        
      } else {
        console.log('⚠️ NO WINNER DATA - FALLBACK ANIMATION');
        // Fallback: just spin without specific target
        const fallbackRotation = 1800; // 5 full rotations
        
        wheelElement.style.willChange = 'transform';
        wheelElement.style.transition = 'transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelElement.style.transform = `translate3d(0, 0, 0) rotate(${fallbackRotation}deg)`;
        
        setSpinRotation(fallbackRotation);
        
        setTimeout(() => {
          setIsSpinning(false);
          setShowWinner(true);
          setConfetti(true);
          wheelElement.style.willChange = 'auto';
          
          setTimeout(() => {
            onDrawComplete?.();
          }, 3000); // Extended announcement display time
        }, 6000);
      }
    }, 100); // Small delay to ensure DOM is ready
  }, [isDrawing, winnerName, segments, onDrawComplete]);

  // Render wheel segments as SVG paths
  const renderWheelSegments = () => {
    if (segments.length === 0) return null;

      return segments.map((segment, index) => {
      // CRITICAL FIX: Handle 100% single player case
      let pathData;
      
      if (segment.isFirstUserSlice && segment.percentage === 100) {
        // Full circle for single player
        pathData = `M ${radius} ${radius} m -${normalizedRadius}, 0 a ${normalizedRadius},${normalizedRadius} 0 1,1 ${normalizedRadius * 2},0 a ${normalizedRadius},${normalizedRadius} 0 1,1 -${normalizedRadius * 2},0`;
      } else {
        // Normal arc calculation for multiple players
        const largeArcFlag = segment.percentage > 50 ? 1 : 0;
        const startAngleRad = (segment.startAngle * Math.PI) / 180;
        const endAngleRad = (segment.endAngle * Math.PI) / 180;
        
        const x1 = radius + normalizedRadius * Math.cos(startAngleRad);
        const y1 = radius + normalizedRadius * Math.sin(startAngleRad);
        const x2 = radius + normalizedRadius * Math.cos(endAngleRad);
        const y2 = radius + normalizedRadius * Math.sin(endAngleRad);
        
        pathData = [
          `M ${radius} ${radius}`,
          `L ${x1} ${y1}`,
          `A ${normalizedRadius} ${normalizedRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `Z`
        ].join(' ');
      }

      const isWinner = showWinner && segment.username === winnerName;
      
      return (
        <g key={`segment-${index}`}>
          <defs>
            <radialGradient id={`gradient-${segment.username}-${index}`} cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor={segment.color || 'hsl(var(--muted))'} stopOpacity="1" />
              <stop offset="100%" stopColor={segment.color || 'hsl(var(--muted))'} stopOpacity="0.8" />
            </radialGradient>
                <filter id={`glow-${segment.username}-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path
                d={pathData}
                fill={`url(#gradient-${segment.username}-${index})`}
                stroke={segment.isFirstUserSlice ? segment.color : "#000"}
                strokeWidth={segment.isFirstUserSlice ? "4" : "2"}
                className={`wheel-segment transition-all duration-700 ease-out ${
                  isWinner ? 'winner animate-pulse' : ''
                } ${segment.isFirstUserSlice ? 'first-user-slice' : ''}`}
                style={{
                  filter: isWinner ? `url(#glow-${segment.username}-${index}) drop-shadow(0 0 20px ${segment.color})` : 
                          segment.isFirstUserSlice ? `drop-shadow(0 0 15px ${segment.color})` : 
                          'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                  opacity: showWinner && !isWinner ? 0.4 : 1,
                  transformOrigin: `${radius}px ${radius}px`,
                  WebkitTransformOrigin: `${radius}px ${radius}px`
                }}
              />
          {/* Segment divider lines - only for multiple players */}
          {!segment.isFirstUserSlice && (() => {
            const startAngleRad = (segment.startAngle * Math.PI) / 180;
            const x1 = radius + normalizedRadius * Math.cos(startAngleRad);
            const y1 = radius + normalizedRadius * Math.sin(startAngleRad);
            return (
              <line
                x1={radius}
                y1={radius}
                x2={x1}
                y2={y1}
                stroke="#000"
                strokeWidth="1.5"
                opacity="0.7"
              />
            );
          })()}
          {/* Player label with better styling */}
          {segment.percentage > 8 && (
            <text
              x={radius + (normalizedRadius * 0.7) * Math.cos((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
              y={radius + (normalizedRadius * 0.7) * Math.sin((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={segment.percentage > 20 ? "16" : segment.percentage > 15 ? "14" : "12"}
              fontWeight="bold"
              className="select-none font-sans"
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
                filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.9))'
              }}
            >
              {segment.username.length > 8 ? segment.username.substring(0, 8) + '...' : segment.username}
            </text>
          )}
          {/* Percentage display for larger segments */}
          {segment.percentage > 15 && (
            <text
              x={radius + (normalizedRadius * 0.5) * Math.cos((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
              y={radius + (normalizedRadius * 0.5) * Math.sin((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180) + 18}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="10"
              fontWeight="500"
              className="select-none"
              style={{
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                opacity: 0.9
              }}
            >
              {segment.percentage.toFixed(1)}%
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div className="relative flex flex-col items-center space-y-4">
      {/* Wheel Container */}
      <div className="relative p-6">
        
        {/* Optimized confetti with enhanced easing and reduced particles on mobile */}
        {confetti && (
          <div className="confetti-container absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-full">
            {[...Array(window.innerWidth < 768 ? 15 : 30)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${4 + Math.random() * 6}px`,
                  height: `${4 + Math.random() * 6}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  backgroundColor: [
                    'hsl(var(--crypto-gold))', 
                    'hsl(var(--crypto-red))', 
                    'hsl(var(--crypto-blue))', 
                    'hsl(var(--crypto-green))'
                  ][i % 4],
                  animation: `confetti-fall ${2 + Math.random() * 1}s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  transform: `translate3d(0, 0, 0) scale(${0.5 + Math.random() * 0.5})`,
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  contain: 'layout style paint'
                }}
              />
            ))}
          </div>
        )}


        {/* RGB Lightning Border - Restored */}
        <div className="relative rounded-full p-1">
          {/* RGB border animation */}
          <div 
            className="absolute inset-0 rounded-full p-1"
            style={{
              background: 'conic-gradient(from 0deg, hsl(0 100% 50%) 0%, hsl(60 100% 50%) 16.66%, hsl(120 100% 50%) 33.33%, hsl(180 100% 50%) 50%, hsl(240 100% 50%) 66.66%, hsl(300 100% 50%) 83.33%, hsl(360 100% 50%) 100%)',
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))',
              animation: 'rgb-cycle-enhanced 4s linear infinite',
              willChange: 'transform, filter',
              backfaceVisibility: 'hidden',
              transform: 'translate3d(0, 0, 0)'
            }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-background via-card to-background"></div>
          </div>
          
          {/* Inner Wheel Container */}
          <div className="relative bg-gradient-to-br from-card/80 via-background to-card/60 rounded-full p-3 shadow-2xl border border-border/20 backdrop-blur-sm">
            <svg
              width={radius * 2}
              height={radius * 2}
              className="wheel-spinning"
              style={{
                transform: `translate3d(0, 0, 0) rotate(${spinRotation}deg)`,
                willChange: isSpinning ? 'transform' : 'auto',
                backfaceVisibility: 'hidden'
              }}
            >
              {/* Enhanced background circle with theme-matching gradient */}
              <defs>
                <radialGradient id="wheelBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--card))" />
                  <stop offset="50%" stopColor="hsl(var(--background))" />
                  <stop offset="100%" stopColor="hsl(var(--card))" />
                </radialGradient>
                <filter id="innerShadow">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                  <feOffset dx="0" dy="0" result="offset"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.8"/>
                  </feComponentTransfer>
                  <feComposite in="SourceGraphic" in2="offset" operator="over"/>
                </filter>
              </defs>
              <circle
                cx={radius}
                cy={radius}
                r={normalizedRadius}
                fill="url(#wheelBg)"
                stroke="hsl(var(--border))"
                strokeWidth="2"
                filter="url(#innerShadow)"
                style={{ 
                  filter: 'drop-shadow(inset 0 0 20px rgba(0,0,0,0.3))',
                  opacity: 0.95
                }}
              />
              
              {/* Player segments */}
              {renderWheelSegments()}
              
            </svg>
          </div>
        </div>

          {/* Enhanced Center Content with smooth animations */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`wheel-center bg-gradient-to-br from-card via-background to-card rounded-full w-32 h-32 flex flex-col items-center justify-center border-4 border-border shadow-2xl relative overflow-hidden ${isDrawing ? 'spinning' : ''}`}>
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-crypto-gold/20 to-accent/20 rounded-full animate-pulse"></div>
              
              {showWinner && winnerName ? (
                <div className="text-center animate-bounce relative z-10">
                  <Trophy className="w-8 h-8 text-crypto-gold mx-auto mb-1 drop-shadow-lg" fill="currentColor" />
                  <div className="text-foreground text-sm font-bold bg-background/50 px-2 py-1 rounded">{winnerName}</div>
                  <div className="text-crypto-gold text-lg font-bold mt-1">${currentPot.toFixed(0)}</div>
                </div>
              ) : isDrawing ? (
                <div className="text-center relative z-10">
                  <div className="text-foreground text-sm font-bold">SPINNING...</div>
                  <div className="text-crypto-gold text-xs">Good Luck!</div>
                </div>
              ) : (
                <div className="text-center relative z-10">
                  <div className="text-crypto-gold text-2xl font-bold bg-background/50 px-2 py-1 rounded">${currentPot.toFixed(0)}</div>
                  <div className="text-foreground text-xs mt-1">{players.length} Player{players.length !== 1 ? 's' : ''}</div>
                  <div className="text-muted-foreground text-xs">Ready to Spin!</div>
                </div>
              )}
            </div>
          </div>

        {/* Timer display - removed duplicate timer as it's handled in parent */}
      </div>
    </div>
  );
};