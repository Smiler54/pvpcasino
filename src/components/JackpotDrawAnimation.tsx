import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Sparkles } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

interface JackpotDrawAnimationProps {
  isDrawing: boolean;
  totalTickets: number;
  winnerName?: string;
  onDrawComplete?: () => void;
  gameId?: string;
}

export const JackpotDrawAnimation = ({
  isDrawing,
  winnerName,
  onDrawComplete,
  gameId
}: JackpotDrawAnimationProps) => {
  const [animationPhase, setAnimationPhase] = useState<'drawing' | 'winner' | 'complete'>('drawing');
  const [confettiVisible, setConfettiVisible] = useState(false);

  // Optimized confetti array with hardware acceleration
  const confettiElements = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      delay: Math.random() * 2000,
      duration: 2000 + Math.random() * 1000,
      color: ['hsl(var(--crypto-gold))', 'hsl(var(--crypto-blue))', 'hsl(var(--crypto-green))', 'hsl(var(--crypto-red))'][i % 4],
      size: 8 + Math.random() * 6,
      left: Math.random() * 100,
      rotation: Math.random() * 360
    })), [isDrawing]
  );

  useEffect(() => {
    console.log('🎭 DRAW ANIMATION DEBUG: Effect triggered', { isDrawing, winnerName });
    
    if (!isDrawing) {
      console.log('🎭 DRAW ANIMATION DEBUG: Not drawing, resetting');
      setAnimationPhase('drawing');
      setConfettiVisible(false);
      return;
    }

    // Phase 1: Drawing phase
    console.log('🎭 DRAW ANIMATION DEBUG: Starting drawing phase');
    setAnimationPhase('drawing');
    
    if (winnerName) {
      console.log('🎭 DRAW ANIMATION DEBUG: Winner provided:', winnerName);
      
      // Phase 2: Winner revealed - start celebration (extended timing)
      const winnerTimer = setTimeout(() => {
        console.log('🎭 DRAW ANIMATION DEBUG: Moving to winner phase');
        setAnimationPhase('winner');
        setConfettiVisible(true);
      }, 2000);

      // Phase 3: Complete animation (extended from 3.5s to 9s for longer celebration)
      const completeTimer = setTimeout(() => {
        console.log('🎭 DRAW ANIMATION DEBUG: Completing animation');
        setAnimationPhase('complete');
        onDrawComplete?.();
      }, 9000);

      return () => {
        clearTimeout(winnerTimer);
        clearTimeout(completeTimer);
      };
    } else {
      console.warn('⚠️ DRAW ANIMATION DEBUG: No winner name provided');
    }
  }, [isDrawing, winnerName, onDrawComplete]);

  if (!isDrawing) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
      style={{ willChange: 'opacity' }}
    >
      {/* Optimized confetti with hardware acceleration */}
      {confettiVisible && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confettiElements.map((confetti) => (
            <div
              key={confetti.id}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: confetti.color,
                left: `${confetti.left}%`,
                top: '-20px',
                width: `${confetti.size}px`,
                height: `${confetti.size}px`,
                animation: `confetti ${confetti.duration}ms linear infinite`,
                animationDelay: `${confetti.delay}ms`,
                transform: `rotate(${confetti.rotation}deg)`,
                willChange: 'transform',
                backfaceVisibility: 'hidden'
              }}
            />
          ))}
        </div>
      )}

      <Card 
        className="w-full max-w-2xl mx-4 bg-card/90 backdrop-blur-md border-crypto-gold relative overflow-hidden"
        style={{ willChange: 'transform' }}
      >
        {/* Animated background glow */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--crypto-gold)) 0%, transparent 70%)',
            animation: animationPhase === 'winner' ? 'glow-pulse 1s ease-in-out infinite' : 'none'
          }}
        />
        
        <CardContent className="p-8 relative z-10">
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                {animationPhase === 'drawing' ? (
                  <>
                    <div 
                      className="text-4xl"
                      style={{
                        animation: 'spin-slow 1s linear infinite',
                        willChange: 'transform'
                      }}
                    >
                      🎰
                    </div>
                    <h2 className="text-3xl font-bold gradient-gold-text animate-pulse">
                      Drawing Winner...
                    </h2>
                    <div 
                      className="text-4xl"
                      style={{
                        animation: 'spin-slow 1s linear infinite reverse',
                        willChange: 'transform'
                      }}
                    >
                      🎰
                    </div>
                  </>
                ) : (
                  <>
                    <Trophy 
                      className="h-10 w-10 text-crypto-gold" 
                      fill="currentColor"
                      style={{
                        animation: 'glow-pulse 1s ease-in-out infinite',
                        willChange: 'transform'
                      }}
                    />
                    <h2 className="text-4xl font-bold gradient-gold-text animate-scale-in">
                      🎉 {winnerName} Wins! 🎉
                    </h2>
                    <Trophy 
                      className="h-10 w-10 text-crypto-gold" 
                      fill="currentColor"
                      style={{
                        animation: 'glow-pulse 1s ease-in-out infinite',
                        willChange: 'transform'
                      }}
                    />
                  </>
                )}
              </div>
              
              {animationPhase === 'winner' && (
                <div 
                  className="flex items-center justify-center gap-2 text-lg text-crypto-gold animate-fade-in"
                  style={{ animationDelay: '0.5s' }}
                >
                  <Sparkles className="h-5 w-5" />
                  <span>Congratulations!</span>
                  <Sparkles className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};