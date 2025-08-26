import React, { useRef, useEffect, useState } from 'react';

interface AnimationTrackerProps {
  isFlipping: boolean;
  expectedResult: 'heads' | 'tails' | null;
  onAnimationStart?: (timestamp: number) => void;
  onAnimationEnd?: (visualResult: 'heads' | 'tails', timestamp: number) => void;
  onFrameRateUpdate?: (fps: number) => void;
  children?: React.ReactNode;
}

export const CoinflipAnimationTracker: React.FC<AnimationTrackerProps> = ({
  isFlipping,
  expectedResult,
  onAnimationStart,
  onAnimationEnd,
  onFrameRateUpdate,
  children
}) => {
  const coinRef = useRef<HTMLDivElement>(null);
  const animationStartTime = useRef<number | null>(null);
  const frameCount = useRef(0);
  const lastFrameTime = useRef(performance.now());
  const animationId = useRef<number>();
  
  const [currentRotation, setCurrentRotation] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'spinning' | 'settling'>('idle');

  // Frame rate monitoring
  useEffect(() => {
    if (!isFlipping) return;

    const measureFrameRate = () => {
      const now = performance.now();
      frameCount.current++;
      
      if (now - lastFrameTime.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));
        onFrameRateUpdate?.(fps);
        frameCount.current = 0;
        lastFrameTime.current = now;
      }
      
      animationId.current = requestAnimationFrame(measureFrameRate);
    };

    animationId.current = requestAnimationFrame(measureFrameRate);
    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, [isFlipping, onFrameRateUpdate]);

  // Animation tracking
  useEffect(() => {
    if (!isFlipping || !coinRef.current || !expectedResult) {
      console.log('🚫 Animation skipped:', { isFlipping, hasCoin: !!coinRef.current, expectedResult });
      return;
    }

    const coin = coinRef.current;
    animationStartTime.current = performance.now();
    setAnimationPhase('spinning');
    
    onAnimationStart?.(animationStartTime.current);

    // Reset coin position and ensure clean state
    coin.style.transition = "none";
    coin.style.transform = "rotateY(0deg)";
    
    // Force reflow to ensure the reset is applied
    coin.offsetHeight;
    
    // Add immediate visual feedback
    console.log(`🎬 Starting coinflip animation for result: ${expectedResult}`);
    
    // Start animation after a brief delay
    const animationTimeout = setTimeout(() => {
      if (!coin) {
        console.warn('🚫 Coin element lost during animation start');
        return;
      }
      
      // Add spinning class for initial effect
      coin.classList.add('coin-spinning');
      
      // Calculate final rotation for realistic coinflip (showing correct result)
      const baseSpins = 5; // 5 full rotations for realistic 3.8-second animation
      let finalDegrees: number;
      
      if (expectedResult === 'heads') {
        // Heads = multiples of 360 degrees (0, 360, 720, 1080, etc.)
        finalDegrees = baseSpins * 360;
      } else {
        // Tails = 180 + multiples of 360 degrees (180, 540, 900, 1260, etc.)
        finalDegrees = baseSpins * 360 + 180;
      }
        
      setCurrentRotation(finalDegrees);
      
      console.log(`🎲 REALISTIC Animation settings:`, { finalDegrees, expectedResult, baseSpins });
      
      // Remove spinning class and start realistic flip animation using CSS keyframes
      setTimeout(() => {
        coin.classList.remove('coin-spinning');
        coin.classList.add('coin-flipping');
        
        // Add result-specific class for the correct animation
        coin.classList.add(`${expectedResult}-result`);
        
        // Let CSS keyframes handle the animation timing
        coin.style.willChange = 'transform'; // Force hardware acceleration
      }, 300); // Brief spinning phase for anticipation
      
      // Track animation completion with enhanced error handling
      const handleAnimationEnd = (event: AnimationEvent) => {
        // Make sure this is our animation event
        const validAnimations = ['coin-flip-realistic-heads', 'coin-flip-realistic-tails'];
        if (!validAnimations.includes(event.animationName)) return;
        
        const endTime = performance.now();
        const duration = endTime - (animationStartTime.current || 0);
        
        // Determine visual result based on final rotation
        const normalizedRotation = finalDegrees % 360;
        const visualResult: 'heads' | 'tails' = 
          normalizedRotation === 0 ? 'heads' : 'tails';
        
        setAnimationPhase('settling');
        onAnimationEnd?.(visualResult, endTime);
        
        console.log(`🎯 Animation completed:`, {
          expectedResult,
          visualResult,
          finalDegrees,
          normalizedRotation,
          duration: `${duration.toFixed(0)}ms`,
          accurate: expectedResult === visualResult
        });
        
        // Clean up animation classes and styles
        coin.classList.remove('coin-spinning', 'coin-flipping', 'heads-result', 'tails-result');
        coin.style.willChange = 'auto';
        coin.removeEventListener('animationend', handleAnimationEnd);
        
        // Reset phase after settling
        setTimeout(() => setAnimationPhase('idle'), 500);
      };
      
      coin.addEventListener('animationend', handleAnimationEnd);
      
      // Fallback timeout for realistic animation
      setTimeout(() => {
        if (coin.classList.contains('coin-flipping')) {
          console.warn('⏰ Realistic coinflip animation timeout, forcing completion');
          const animationName = expectedResult === 'heads' ? 'coin-flip-realistic-heads' : 'coin-flip-realistic-tails';
          handleAnimationEnd({ animationName } as AnimationEvent);
        }
      }, 4300); // Timeout for 3.8s animation + buffer
    }, 200); // Standard delay for classic animation buildup

    // Cleanup function
    return () => {
      clearTimeout(animationTimeout);
      if (coin) {
        coin.style.willChange = 'auto';
      }
    };
  }, [isFlipping, expectedResult, onAnimationStart, onAnimationEnd]);

  return (
    <div className="relative">
      <div
        ref={coinRef}
        className="coin-container"
        style={{
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        {children}
      </div>
    </div>
  );
};