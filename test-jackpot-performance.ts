/**
 * Comprehensive Jackpot Game Performance Test Suite
 * Tests animation smoothness, countdown accuracy, and wheel performance
 */

interface JackpotPerformanceTest {
  testName: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  issues?: string[];
  metrics?: Record<string, any>;
}

class JackpotGameTester {
  private tests: JackpotPerformanceTest[] = [];
  private animationFrameId?: number;
  private startTime: number = 0;
  
  constructor() {
    console.log('🎰 Jackpot Performance Tester Initialized');
  }

  async runFullTestSuite(): Promise<JackpotPerformanceTest[]> {
    console.group('🎯 JACKPOT GAME COMPREHENSIVE TEST SUITE');
    
    const testSuite = [
      () => this.testCountdownAccuracy(),
      () => this.testWheelAnimationPerformance(),
      () => this.testConfettiOptimization(),
      () => this.testRGBBorderPerformance(),
      () => this.testSegmentRendering(),
      () => this.testMemoryLeaks(),
      () => this.testCrossPlatformCompatibility(),
      () => this.testRealTimeSync()
    ];

    for (const test of testSuite) {
      try {
        await test();
        await this.delay(100); // Prevent overwhelming
      } catch (error) {
        console.error('Test suite error:', error);
      }
    }

    console.groupEnd();
    return this.tests;
  }

  private addTest(name: string, status: JackpotPerformanceTest['status'] = 'pending'): JackpotPerformanceTest {
    const test: JackpotPerformanceTest = {
      testName: name,
      status,
      issues: [],
      metrics: {}
    };
    this.tests.push(test);
    return test;
  }

  private async testCountdownAccuracy(): Promise<void> {
    const test = this.addTest('Countdown Timer Accuracy', 'running');
    const startTime = performance.now();

    try {
      // Test timer accuracy over multiple seconds
      const timerDebug = (window as any).timerDebugInfo;
      
      if (!timerDebug) {
        test.issues!.push('Timer debug info not available');
        test.status = 'failed';
        return;
      }

      // Check sync offset
      if (Math.abs(timerDebug.syncOffset) > 1000) {
        test.issues!.push(`High sync offset: ${timerDebug.syncOffset}ms`);
      }

      // Platform compatibility checks
      if (timerDebug.platform.isIOS && !timerDebug.platform.isSafari) {
        test.issues!.push('iOS detected but not Safari - potential timing issues');
      }

      test.metrics = {
        syncOffset: timerDebug.syncOffset,
        platform: timerDebug.platform.platform,
        browser: this.detectBrowser(),
        timeZone: timerDebug.platform.timeZone
      };

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Timer test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testWheelAnimationPerformance(): Promise<void> {
    const test = this.addTest('Wheel Animation Performance', 'running');
    const startTime = performance.now();

    try {
      const wheel = document.querySelector('.wheel-spinning') as HTMLElement;
      
      if (!wheel) {
        test.issues!.push('Wheel element not found');
        test.status = 'failed';
        return;
      }

      // Check hardware acceleration
      const computedStyle = getComputedStyle(wheel);
      const hasHardwareAccel = computedStyle.willChange === 'transform' || 
                              computedStyle.transform.includes('translate3d');

      if (!hasHardwareAccel) {
        test.issues!.push('Hardware acceleration not properly applied');
      }

      // Test animation smoothness during spin
      const frameRates: number[] = [];
      let lastFrameTime = performance.now();
      let frameCount = 0;

      const measureFrameRate = () => {
        frameCount++;
        const currentTime = performance.now();
        const deltaTime = currentTime - lastFrameTime;
        const fps = 1000 / deltaTime;
        frameRates.push(fps);
        lastFrameTime = currentTime;

        if (frameCount < 60) { // Measure for 60 frames
          requestAnimationFrame(measureFrameRate);
        } else {
          const avgFPS = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
          const minFPS = Math.min(...frameRates);
          
          test.metrics = {
            averageFPS: avgFPS.toFixed(2),
            minimumFPS: minFPS.toFixed(2),
            frameDrops: frameRates.filter(fps => fps < 55).length,
            hardwareAccelerated: hasHardwareAccel
          };

          if (avgFPS < 55) {
            test.issues!.push(`Low average FPS: ${avgFPS.toFixed(2)}`);
          }
          
          if (minFPS < 45) {
            test.issues!.push(`Severe frame drops detected: ${minFPS.toFixed(2)} FPS`);
          }

          test.status = test.issues!.length === 0 ? 'passed' : 'failed';
          test.duration = performance.now() - startTime;
        }
      };

      requestAnimationFrame(measureFrameRate);

    } catch (error) {
      test.issues!.push(`Wheel animation test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testConfettiOptimization(): Promise<void> {
    const test = this.addTest('Confetti Animation Optimization', 'running');
    const startTime = performance.now();

    try {
      const confettiElements = document.querySelectorAll('[style*="animation"][style*="confetti"]');
      
      test.metrics = {
        confettiCount: confettiElements.length,
        expectedCount: 40
      };

      if (confettiElements.length > 50) {
        test.issues!.push(`Too many confetti elements: ${confettiElements.length}`);
      }

      // Check for hardware acceleration on confetti
      let hardwareAccelCount = 0;
      confettiElements.forEach(el => {
        const style = (el as HTMLElement).style;
        if (style.transform.includes('translate3d') || style.willChange === 'transform') {
          hardwareAccelCount++;
        }
      });

      test.metrics.hardwareAcceleratedCount = hardwareAccelCount;

      if (hardwareAccelCount < confettiElements.length * 0.8) {
        test.issues!.push('Not all confetti elements are hardware accelerated');
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Confetti test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testRGBBorderPerformance(): Promise<void> {
    const test = this.addTest('RGB Border Animation Performance', 'running');
    const startTime = performance.now();

    try {
      const rgbBorder = document.querySelector('[style*="rgb-cycle"]') as HTMLElement;
      
      if (!rgbBorder) {
        test.issues!.push('RGB border animation not found');
        test.status = 'failed';
        return;
      }

      const computedStyle = getComputedStyle(rgbBorder);
      
      test.metrics = {
        animationDuration: computedStyle.animationDuration,
        hasBackfaceVisibility: computedStyle.backfaceVisibility === 'hidden',
        hasWillChange: computedStyle.willChange.includes('transform') || computedStyle.willChange.includes('filter')
      };

      if (!test.metrics.hasBackfaceVisibility) {
        test.issues!.push('RGB border missing backface-visibility optimization');
      }

      if (!test.metrics.hasWillChange) {
        test.issues!.push('RGB border missing will-change optimization');
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`RGB border test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testSegmentRendering(): Promise<void> {
    const test = this.addTest('Wheel Segment Rendering', 'running');
    const startTime = performance.now();

    try {
      const wheelColorDebug = (window as any).wheelColorDebug;
      
      if (!wheelColorDebug) {
        test.issues!.push('Wheel color debug info not available');
        test.status = 'failed';
        return;
      }

      const { rawPlayers, coloredPlayers, processingTime } = wheelColorDebug;
      
      test.metrics = {
        playerCount: rawPlayers.length,
        colorProcessingTime: processingTime,
        allPlayersHaveColors: coloredPlayers.every((p: any) => p.color),
        colorDistribution: coloredPlayers.map((p: any) => p.color)
      };

      if (processingTime > 10) {
        test.issues!.push(`Slow color processing: ${processingTime}ms`);
      }

      if (!test.metrics.allPlayersHaveColors) {
        test.issues!.push('Some players missing colors');
      }

      // Check for color uniqueness
      const uniqueColors = new Set(test.metrics.colorDistribution);
      if (uniqueColors.size < Math.min(coloredPlayers.length, 8)) {
        test.issues!.push('Insufficient color diversity');
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Segment rendering test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testMemoryLeaks(): Promise<void> {
    const test = this.addTest('Memory Leak Detection', 'running');
    const startTime = performance.now();

    try {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Simulate rapid re-renders
      for (let i = 0; i < 10; i++) {
        const event = new CustomEvent('forceRerender');
        document.dispatchEvent(event);
        await this.delay(50);
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      test.metrics = {
        initialMemory: Math.round(initialMemory / 1024 / 1024),
        finalMemory: Math.round(finalMemory / 1024 / 1024),
        memoryIncrease: Math.round(memoryIncrease / 1024 / 1024)
      };

      if (memoryIncrease > 10 * 1024 * 1024) { // 10MB threshold
        test.issues!.push(`Potential memory leak: ${test.metrics.memoryIncrease}MB increase`);
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Memory leak test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testCrossPlatformCompatibility(): Promise<void> {
    const test = this.addTest('Cross-Platform Compatibility', 'running');
    const startTime = performance.now();

    try {
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      
      test.metrics = {
        userAgent,
        platform,
        isIOS: /iPad|iPhone|iPod/.test(userAgent),
        isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
        isChrome: /Chrome/.test(userAgent),
        isFirefox: /Firefox/.test(userAgent),
        isEdge: /Edge/.test(userAgent),
        supportsWebGL: !!document.createElement('canvas').getContext('webgl'),
        supportsRequestAnimationFrame: !!window.requestAnimationFrame
      };

      // Platform-specific checks
      if (test.metrics.isIOS && !test.metrics.supportsWebGL) {
        test.issues!.push('iOS device without WebGL support');
      }

      if (test.metrics.isSafari) {
        // Check for Safari-specific animation support
        const testEl = document.createElement('div');
        testEl.style.willChange = 'transform';
        if (getComputedStyle(testEl).willChange !== 'transform') {
          test.issues!.push('Safari does not support will-change property');
        }
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Cross-platform test error: ${error}`);
      test.status = 'failed';
    }
  }

  private async testRealTimeSync(): Promise<void> {
    const test = this.addTest('Real-time Synchronization', 'running');
    const startTime = performance.now();

    try {
      // Test if Supabase real-time is working
      const supabaseTest = typeof window !== 'undefined' && (window as any).supabase;
      
      if (!supabaseTest) {
        test.issues!.push('Supabase client not available');
        test.status = 'failed';
        return;
      }

      // Check for active subscriptions
      const channels = supabaseTest.getChannels?.() || [];
      
      test.metrics = {
        activeChannels: channels.length,
        hasRealtimeConnection: channels.some((ch: any) => ch.state === 'joined')
      };

      if (channels.length === 0) {
        test.issues!.push('No active Supabase channels found');
      }

      if (!test.metrics.hasRealtimeConnection) {
        test.issues!.push('No active real-time connections');
      }

      test.status = test.issues!.length === 0 ? 'passed' : 'failed';
      test.duration = performance.now() - startTime;

    } catch (error) {
      test.issues!.push(`Real-time sync test error: ${error}`);
      test.status = 'failed';
    }
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public generateReport(): void {
    console.group('📊 JACKPOT PERFORMANCE TEST REPORT');
    
    const passedTests = this.tests.filter(t => t.status === 'passed').length;
    const failedTests = this.tests.filter(t => t.status === 'failed').length;
    const totalTests = this.tests.length;

    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Tests Failed: ${failedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    this.tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏳';
      console.group(`${icon} ${test.testName} (${test.duration?.toFixed(2)}ms)`);
      
      if (test.metrics) {
        console.log('Metrics:', test.metrics);
      }
      
      if (test.issues && test.issues.length > 0) {
        console.warn('Issues:', test.issues);
      }
      
      console.groupEnd();
    });

    console.groupEnd();
  }
}

// Auto-run tests when in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).JackpotTester = JackpotGameTester;
  
  // Auto-test after page load
  window.addEventListener('load', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for components to load
    
    const tester = new JackpotGameTester();
    await tester.runFullTestSuite();
    tester.generateReport();
    
    // Store results globally for inspection
    (window as any).jackpotTestResults = tester;
  });
}

export { JackpotGameTester };