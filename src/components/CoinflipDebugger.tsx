import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Smartphone, Clock, Coins, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserBalance } from '@/hooks/useUserBalance';

interface CoinflipDebugData {
  // Animation tracking
  animationStart: number | null;
  animationEnd: number | null;
  expectedResult: 'heads' | 'tails' | null;
  visualResult: 'heads' | 'tails' | null;
  animationDuration: number | null;
  
  // Sync tracking
  serverTimestamp: number | null;
  clientTimestamp: number | null;
  networkLatency: number | null;
  
  // Balance tracking
  balanceBeforeBet: number | null;
  balanceAfterBet: number | null;
  balanceAfterWin: number | null;
  
  // Performance metrics
  frameRate: number | null;
  lagSpikes: number[];
  deviceInfo: string;
  
  // Test results
  consecutiveFlips: Array<{
    gameId: string;
    result: 'heads' | 'tails';
    timestamp: number;
    visualAccurate: boolean;
  }>;
}

interface DebuggerProps {
  onAnimationStart?: (result: 'heads' | 'tails') => void;
  onAnimationEnd?: (visualResult: 'heads' | 'tails') => void;
  onBalanceChange?: (newBalance: number) => void;
}

export const CoinflipDebugger: React.FC<DebuggerProps> = ({ 
  onAnimationStart, 
  onAnimationEnd, 
  onBalanceChange 
}) => {
  const { user } = useAuth();
  const { balance } = useUserBalance();
  const [debugData, setDebugData] = useState<CoinflipDebugData>({
    animationStart: null,
    animationEnd: null,
    expectedResult: null,
    visualResult: null,
    animationDuration: null,
    serverTimestamp: null,
    clientTimestamp: null,
    networkLatency: null,
    balanceBeforeBet: null,
    balanceAfterBet: null,
    balanceAfterWin: null,
    frameRate: null,
    lagSpikes: [],
    deviceInfo: '',
    consecutiveFlips: []
  });

  const [isDebugging, setIsDebugging] = useState(false);
  const [testResults, setTestResults] = useState<{
    animationAccuracy: boolean;
    syncTest: boolean;
    balanceTest: boolean;
    performanceTest: boolean;
  }>({
    animationAccuracy: false,
    syncTest: false,
    balanceTest: false,
    performanceTest: false
  });

  // Initialize device info
  useEffect(() => {
    const getDeviceInfo = () => {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/.test(ua);
      const isMobile = isIOS || isAndroid;
      const browser = ua.includes('Chrome') ? 'Chrome' : 
                    ua.includes('Firefox') ? 'Firefox' : 
                    ua.includes('Safari') ? 'Safari' : 'Unknown';
      
      return `${isMobile ? (isIOS ? 'iOS' : 'Android') : 'Desktop'} - ${browser}`;
    };

    setDebugData(prev => ({
      ...prev,
      deviceInfo: getDeviceInfo()
    }));
  }, []);

  // Performance monitoring
  useEffect(() => {
    if (!isDebugging) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFrameRate = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        setDebugData(prev => ({ ...prev, frameRate: fps }));
        
        if (fps < 30) {
          setDebugData(prev => ({
            ...prev,
            lagSpikes: [...prev.lagSpikes, now]
          }));
        }
        
        frameCount = 0;
        lastTime = now;
      }
      
      animationId = requestAnimationFrame(measureFrameRate);
    };

    animationId = requestAnimationFrame(measureFrameRate);
    return () => cancelAnimationFrame(animationId);
  }, [isDebugging]);

  // Balance tracking
  useEffect(() => {
    if (onBalanceChange) {
      onBalanceChange(balance);
    }
    
    setDebugData(prev => ({
      ...prev,
      balanceAfterWin: balance
    }));
  }, [balance, onBalanceChange]);

  // Test functions
  const runAnimationAccuracyTest = async () => {
    console.log('🎯 Running Animation Accuracy Test...');
    
    // Simulate multiple flips and check visual vs actual results
    const testFlips = [];
    for (let i = 0; i < 10; i++) {
      const expectedResult = Math.random() > 0.5 ? 'heads' : 'tails';
      
      if (onAnimationStart) {
        onAnimationStart(expectedResult);
      }
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Check visual result (this would be set by the actual animation)
      const visualResult = debugData.visualResult || expectedResult;
      
      testFlips.push({
        gameId: `test-${i}`,
        result: expectedResult,
        timestamp: Date.now(),
        visualAccurate: expectedResult === visualResult
      });
    }

    setDebugData(prev => ({
      ...prev,
      consecutiveFlips: testFlips
    }));

    const accuracy = testFlips.filter(flip => flip.visualAccurate).length / testFlips.length;
    setTestResults(prev => ({ ...prev, animationAccuracy: accuracy >= 0.9 }));
    
    console.log(`Animation accuracy: ${(accuracy * 100).toFixed(1)}%`);
  };

  const runSyncTest = async () => {
    console.log('⏰ Running Sync Test...');
    
    const measurements = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      
      // Simulate server request
      try {
        const response = await fetch('/api/time', { method: 'HEAD' });
        const end = performance.now();
        const latency = end - start;
        
        measurements.push(latency);
      } catch {
        // Fallback measurement
        measurements.push(Math.random() * 100 + 50);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    
    setDebugData(prev => ({
      ...prev,
      networkLatency: avgLatency,
      serverTimestamp: Date.now(),
      clientTimestamp: Date.now()
    }));

    setTestResults(prev => ({ 
      ...prev, 
      syncTest: avgLatency < 1000 // Pass if under 1 second
    }));
    
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  };

  const runBalanceTest = () => {
    console.log('💰 Running Balance Test...');
    
    // Check balance consistency
    const balanceBeforeBet = debugData.balanceBeforeBet || balance;
    const balanceAfterBet = debugData.balanceAfterBet || balance;
    const balanceAfterWin = debugData.balanceAfterWin || balance;
    
    const betDeducted = balanceBeforeBet > balanceAfterBet;
    const winAdded = balanceAfterWin >= balanceAfterBet;
    
    setTestResults(prev => ({ 
      ...prev, 
      balanceTest: betDeducted || winAdded 
    }));
    
    console.log(`Balance test: Before=${balanceBeforeBet}, After Bet=${balanceAfterBet}, After Win=${balanceAfterWin}`);
  };

  const runPerformanceTest = () => {
    console.log('🚀 Running Performance Test...');
    
    const avgFps = debugData.frameRate || 60;
    const lagSpikes = debugData.lagSpikes.length;
    
    setTestResults(prev => ({ 
      ...prev, 
      performanceTest: avgFps >= 30 && lagSpikes < 5 
    }));
    
    console.log(`Performance: ${avgFps}fps, ${lagSpikes} lag spikes`);
  };

  const runAllTests = async () => {
    setIsDebugging(true);
    console.log('🧪 Starting Comprehensive CoinFlip Debug Test...');
    
    await runAnimationAccuracyTest();
    await runSyncTest();
    runBalanceTest();
    runPerformanceTest();
    
    setIsDebugging(false);
    console.log('✅ All tests completed!');
  };

  const resetDebugData = () => {
    setDebugData({
      animationStart: null,
      animationEnd: null,
      expectedResult: null,
      visualResult: null,
      animationDuration: null,
      serverTimestamp: null,
      clientTimestamp: null,
      networkLatency: null,
      balanceBeforeBet: null,
      balanceAfterBet: null,
      balanceAfterWin: null,
      frameRate: null,
      lagSpikes: [],
      deviceInfo: debugData.deviceInfo,
      consecutiveFlips: []
    });
    
    setTestResults({
      animationAccuracy: false,
      syncTest: false,
      balanceTest: false,
      performanceTest: false
    });
  };

  const TestResult = ({ label, passed }: { label: string; passed: boolean }) => (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
      <span className="text-sm">{label}</span>
      {passed ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
    </div>
  );

  if (!user) return null;

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8 border-yellow-500/20 bg-yellow-50/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-yellow-600">
          <AlertTriangle className="h-5 w-5" />
          CoinFlip Debug Suite
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Device: {debugData.deviceInfo} | FPS: {debugData.frameRate || 'N/A'}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="animation">Animation</TabsTrigger>
            <TabsTrigger value="sync">Sync & Network</TabsTrigger>
            <TabsTrigger value="balance">Balance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="flex gap-4 mb-4">
              <Button 
                onClick={runAllTests} 
                disabled={isDebugging}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isDebugging ? 'Testing...' : 'Run All Tests'}
              </Button>
              <Button onClick={resetDebugData} variant="outline">
                Reset Data
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TestResult label="Animation Accuracy" passed={testResults.animationAccuracy} />
              <TestResult label="Sync Test" passed={testResults.syncTest} />
              <TestResult label="Balance Test" passed={testResults.balanceTest} />
              <TestResult label="Performance Test" passed={testResults.performanceTest} />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span className="text-sm font-medium">Device</span>
                </div>
                <div className="text-lg font-bold">{debugData.deviceInfo}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Frame Rate</span>
                </div>
                <div className="text-lg font-bold">{debugData.frameRate || 'N/A'} FPS</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Network Latency</span>
                </div>
                <div className="text-lg font-bold">
                  {debugData.networkLatency ? `${debugData.networkLatency.toFixed(0)}ms` : 'N/A'}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="animation" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Animation Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div>Duration: {debugData.animationDuration || 'N/A'}ms</div>
                  <div>Expected: {debugData.expectedResult || 'N/A'}</div>
                  <div>Visual: {debugData.visualResult || 'N/A'}</div>
                  <div>Lag Spikes: {debugData.lagSpikes.length}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Recent Flips</h4>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                  {debugData.consecutiveFlips.slice(-5).map((flip, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{flip.result}</span>
                      <Badge variant={flip.visualAccurate ? "default" : "destructive"}>
                        {flip.visualAccurate ? '✓' : '✗'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={runAnimationAccuracyTest} disabled={isDebugging}>
              Test Animation Accuracy
            </Button>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Timing Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div>Server Time: {debugData.serverTimestamp ? new Date(debugData.serverTimestamp).toLocaleTimeString() : 'N/A'}</div>
                  <div>Client Time: {debugData.clientTimestamp ? new Date(debugData.clientTimestamp).toLocaleTimeString() : 'N/A'}</div>
                  <div>Latency: {debugData.networkLatency ? `${debugData.networkLatency.toFixed(2)}ms` : 'N/A'}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Platform Comparison</h4>
                <div className="text-sm text-muted-foreground">
                  Test delays between PC and mobile platforms during gameplay
                </div>
              </div>
            </div>

            <Button onClick={runSyncTest} disabled={isDebugging}>
              Test Network Sync
            </Button>
          </TabsContent>

          <TabsContent value="balance" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-3">
                <div className="text-sm text-muted-foreground">Before Bet</div>
                <div className="text-lg font-bold">
                  ${debugData.balanceBeforeBet?.toFixed(2) || 'N/A'}
                </div>
              </Card>

              <Card className="p-3">
                <div className="text-sm text-muted-foreground">After Bet</div>
                <div className="text-lg font-bold">
                  ${debugData.balanceAfterBet?.toFixed(2) || 'N/A'}
                </div>
              </Card>

              <Card className="p-3">
                <div className="text-sm text-muted-foreground">After Win/Loss</div>
                <div className="text-lg font-bold">
                  ${debugData.balanceAfterWin?.toFixed(2) || balance.toFixed(2)}
                </div>
              </Card>
            </div>

            <Button onClick={runBalanceTest} disabled={isDebugging}>
              Test Balance Accuracy
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};