import { useState, useCallback, useEffect } from 'react';

interface AnimationState {
  isSpinning: boolean;
  isDrawing: boolean;
  isFlipping: boolean;
  isCompleting: boolean;
  currentResult: 'heads' | 'tails' | null;
  animationStartTime: number | null;
  expectedDuration: number;
}

interface AnimationStateManagerProps {
  onStateChange?: (state: AnimationState) => void;
  debugMode?: boolean;
}

export const useAnimationStateManager = ({ onStateChange, debugMode = false }: AnimationStateManagerProps = {}) => {
  const [state, setState] = useState<AnimationState>({
    isSpinning: false,
    isDrawing: false,
    isFlipping: false,
    isCompleting: false,
    currentResult: null,
    animationStartTime: null,
    expectedDuration: 3000 // Default 3 seconds
  });

  // Enhanced state change handler with validation
  const updateState = useCallback((updates: Partial<AnimationState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      
      // State validation and conflict resolution
      if (newState.isSpinning && newState.isFlipping) {
        console.warn('⚠️ Animation conflict: Both spinning and flipping active, prioritizing spinning');
        newState.isFlipping = false;
      }
      
      if (newState.isCompleting && (newState.isSpinning || newState.isFlipping || newState.isDrawing)) {
        console.warn('⚠️ Animation conflict: Completion state conflicts with active animations');
        newState.isSpinning = false;
        newState.isFlipping = false;
        newState.isDrawing = false;
      }
      
      // Auto-set start time when animation begins
      if ((newState.isSpinning || newState.isFlipping || newState.isDrawing) && !newState.animationStartTime) {
        newState.animationStartTime = performance.now();
      }
      
      // Clear start time when all animations stop
      if (!newState.isSpinning && !newState.isFlipping && !newState.isDrawing && !newState.isCompleting) {
        newState.animationStartTime = null;
        newState.currentResult = null;
      }
      
      if (debugMode) {
        console.log('🎬 Animation state updated:', {
          from: prevState,
          to: newState,
          changes: updates
        });
      }
      
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange, debugMode]);

  // Start spinning animation (for jackpot wheel)
  const startSpinning = useCallback((duration: number = 3000) => {
    if (debugMode) console.log('🎡 Starting spinning animation');
    updateState({
      isSpinning: true,
      isDrawing: false,
      isFlipping: false,
      isCompleting: false,
      expectedDuration: duration
    });
  }, [updateState, debugMode]);

  // Start flipping animation (for coinflip)
  const startFlipping = useCallback((result: 'heads' | 'tails', duration: number = 4000) => {
    if (debugMode) console.log('🪙 Starting flipping animation with result:', result);
    updateState({
      isFlipping: true,
      isSpinning: false,
      isDrawing: false,
      isCompleting: false,
      currentResult: result,
      expectedDuration: duration
    });
  }, [updateState, debugMode]);

  // Start drawing process (triggers spinning)
  const startDrawing = useCallback((duration: number = 3000) => {
    if (debugMode) console.log('🎯 Starting drawing process');
    updateState({
      isDrawing: true,
      isSpinning: true,
      isFlipping: false,
      isCompleting: false,
      expectedDuration: duration
    });
  }, [updateState, debugMode]);

  // Complete animation
  const completeAnimation = useCallback(() => {
    if (debugMode) console.log('✅ Completing animation');
    updateState({
      isSpinning: false,
      isDrawing: false,
      isFlipping: false,
      isCompleting: true
    });
    
    // Auto-clear completion state after a short delay
    setTimeout(() => {
      updateState({
        isCompleting: false,
        currentResult: null,
        animationStartTime: null
      });
    }, 1000);
  }, [updateState, debugMode]);

  // Reset all animations
  const resetAll = useCallback(() => {
    if (debugMode) console.log('🔄 Resetting all animations');
    updateState({
      isSpinning: false,
      isDrawing: false,
      isFlipping: false,
      isCompleting: false,
      currentResult: null,
      animationStartTime: null,
      expectedDuration: 3000
    });
  }, [updateState, debugMode]);

  // Auto-completion based on expected duration
  useEffect(() => {
    if (!state.animationStartTime || (!state.isSpinning && !state.isFlipping)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (state.isSpinning || state.isFlipping) {
        if (debugMode) console.log('⏰ Auto-completing animation after expected duration');
        completeAnimation();
      }
    }, state.expectedDuration);

    return () => clearTimeout(timeoutId);
  }, [state.animationStartTime, state.isSpinning, state.isFlipping, state.expectedDuration, completeAnimation, debugMode]);

  // Get elapsed time
  const getElapsedTime = useCallback(() => {
    if (!state.animationStartTime) return 0;
    return performance.now() - state.animationStartTime;
  }, [state.animationStartTime]);

  // Get remaining time
  const getRemainingTime = useCallback(() => {
    const elapsed = getElapsedTime();
    return Math.max(0, state.expectedDuration - elapsed);
  }, [getElapsedTime, state.expectedDuration]);

  // Check if any animation is active
  const isAnimating = useCallback(() => {
    return state.isSpinning || state.isFlipping || state.isDrawing || state.isCompleting;
  }, [state.isSpinning, state.isFlipping, state.isDrawing, state.isCompleting]);

  // Store debug info globally for testing
  useEffect(() => {
    if (debugMode) {
      (window as any).animationStateDebug = {
        state,
        elapsedTime: getElapsedTime(),
        remainingTime: getRemainingTime(),
        isAnimating: isAnimating(),
        timestamp: new Date().toISOString()
      };
    }
  }, [state, getElapsedTime, getRemainingTime, isAnimating, debugMode]);

  return {
    state,
    startSpinning,
    startFlipping,
    startDrawing,
    completeAnimation,
    resetAll,
    getElapsedTime,
    getRemainingTime,
    isAnimating
  };
};