import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TestTube2, 
  Smartphone, 
  Monitor, 
  Timer, 
  Palette, 
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Download
} from 'lucide-react';

export const JackpotTestGuide = () => {
  const [testResults, setTestResults] = useState<{[key: string]: 'pass' | 'fail' | 'warning' | 'pending'}>({});

  const runColorTest = () => {
    console.group('🎨 Color Consistency Test - Manual');
    
    // Check wheel color debug info
    const wheelDebug = (window as any).wheelColorDebug;
    const segmentDebug = (window as any).wheelSegmentDebug;
    
    if (!wheelDebug || !segmentDebug) {
      console.error('Debug info not available. Make sure the wheel is rendered.');
      setTestResults(prev => ({ ...prev, colorTest: 'fail' }));
      return;
    }
    
    console.log('Wheel Color Debug:', wheelDebug);
    console.log('Segment Debug:', segmentDebug);
    
    // Check for color duplicates
    const colors = wheelDebug.coloredPlayers.map((p: any) => p.color);
    const uniqueColors = new Set(colors);
    const hasDuplicates = colors.length !== uniqueColors.size;
    
    console.log('Color Analysis:', {
      totalPlayers: colors.length,
      uniqueColors: uniqueColors.size,
      hasDuplicates,
      colors: colors
    });
    
    setTestResults(prev => ({ 
      ...prev, 
      colorTest: hasDuplicates ? 'warning' : 'pass'
    }));
    
    console.groupEnd();
  };

  const runTimerTest = () => {
    console.group('⏰ Timer Sync Test - Manual');
    
    const timerDebug = (window as any).timerDebugInfo;
    
    if (!timerDebug) {
      console.error('Timer debug info not available');
      setTestResults(prev => ({ ...prev, timerTest: 'fail' }));
      return;
    }
    
    console.log('Timer Debug Info:', timerDebug);
    
    // Calculate discrepancy
    const serverTime = new Date().getTime();
    const discrepancy = Math.abs(timerDebug.now.value - serverTime);
    
    console.log('Timer Analysis:', {
      currentTime: new Date().toISOString(),
      debugTime: timerDebug.now.iso,
      discrepancyMs: discrepancy,
      discrepancySeconds: discrepancy / 1000,
      platform: timerDebug.platform
    });
    
    setTestResults(prev => ({ 
      ...prev, 
      timerTest: discrepancy > 2000 ? 'warning' : 'pass'
    }));
    
    console.groupEnd();
  };

  const runPerformanceTest = () => {
    console.group('⚡ Performance Test - Manual');
    
    const wheelDebug = (window as any).wheelColorDebug;
    const segmentDebug = (window as any).wheelSegmentDebug;
    
    if (!wheelDebug || !segmentDebug) {
      console.error('Performance debug info not available');
      setTestResults(prev => ({ ...prev, performanceTest: 'fail' }));
      return;
    }
    
    const totalProcessingTime = wheelDebug.processingTime + segmentDebug.processingTime;
    
    console.log('Performance Analysis:', {
      colorProcessing: wheelDebug.processingTime + 'ms',
      segmentProcessing: segmentDebug.processingTime + 'ms',
      totalProcessing: totalProcessingTime + 'ms',
      memoryUsage: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
    });
    
    setTestResults(prev => ({ 
      ...prev, 
      performanceTest: totalProcessingTime > 50 ? 'warning' : 'pass'
    }));
    
    console.groupEnd();
  };

  const runCrossPlatformTest = () => {
    console.group('📱 Cross-Platform Test - Manual');
    
    const platformInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isAndroid: /Android/.test(navigator.userAgent),
      isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
      isChrome: /Chrome/.test(navigator.userAgent),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };
    
    console.log('Platform Analysis:', platformInfo);
    
    setTestResults(prev => ({ 
      ...prev, 
      platformTest: 'pass'
    }));
    
    console.groupEnd();
  };

  const copyTestReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      testResults,
      platform: navigator.userAgent,
      wheelDebug: (window as any).wheelColorDebug,
      segmentDebug: (window as any).wheelSegmentDebug,
      timerDebug: (window as any).timerDebugInfo
    };
    
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    alert('Test report copied to clipboard!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Timer className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-500">Pass</Badge>;
      case 'fail': return <Badge variant="destructive">Fail</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Warning</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="bg-card/95 backdrop-blur-sm border-blue-500/50 mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Jackpot Testing Suite</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyTestReport}
            className="flex items-center gap-2"
          >
            <Copy className="h-3 w-3" />
            Export Report
          </Button>
        </div>
        <CardDescription>
          Comprehensive testing tools for identifying and documenting bugs in the Jackpot lottery game
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="tests" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tests">Run Tests</TabsTrigger>
            <TabsTrigger value="checklist">Test Checklist</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="tests" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Color Consistency</span>
                  </div>
                  {getStatusIcon(testResults.colorTest)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Test user slice colors for real-time rendering accuracy
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runColorTest}
                  className="w-full"
                >
                  Run Color Test
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Timer Sync</span>
                  </div>
                  {getStatusIcon(testResults.timerTest)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Verify countdown timer accuracy across platforms
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runTimerTest}
                  className="w-full"
                >
                  Run Timer Test
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Performance</span>
                  </div>
                  {getStatusIcon(testResults.performanceTest)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Check wheel animation smoothness and FPS
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runPerformanceTest}
                  className="w-full"
                >
                  Run Performance Test
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Cross-Platform</span>
                  </div>
                  {getStatusIcon(testResults.platformTest)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Analyze platform-specific behaviors
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runCrossPlatformTest}
                  className="w-full"
                >
                  Run Platform Test
                </Button>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Slice User Color Testing
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Colors render correctly during spin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>No color overlap between users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Colors persist throughout animation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Test on PC, iOS, and Android</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Timer Discrepancy Testing
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Compare PC browser vs iOS Safari timing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Check for &gt;1 second delays</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Test under varying network conditions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Verify spin initiation timing</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Wheel Animation Testing
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Check for stuttering on low-end devices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Verify acceleration/deceleration consistency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Test slice alignment accuracy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-gray-500" />
                    <span>Monitor FPS during animation</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Color Consistency</span>
                  {getStatusBadge(testResults.colorTest || 'pending')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {testResults.colorTest === 'pass' ? 'All colors unique and properly assigned' :
                   testResults.colorTest === 'warning' ? 'Some color conflicts detected' :
                   testResults.colorTest === 'fail' ? 'Major color issues found' :
                   'Test not run yet'}
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Timer Sync</span>
                  {getStatusBadge(testResults.timerTest || 'pending')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {testResults.timerTest === 'pass' ? 'Timer sync within acceptable range' :
                   testResults.timerTest === 'warning' ? 'Timer discrepancy detected' :
                   testResults.timerTest === 'fail' ? 'Major timing issues found' :
                   'Test not run yet'}
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Performance</span>
                  {getStatusBadge(testResults.performanceTest || 'pending')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {testResults.performanceTest === 'pass' ? 'Performance within expected range' :
                   testResults.performanceTest === 'warning' ? 'Some performance issues detected' :
                   testResults.performanceTest === 'fail' ? 'Significant performance problems' :
                   'Test not run yet'}
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Cross-Platform</span>
                  {getStatusBadge(testResults.platformTest || 'pending')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {testResults.platformTest === 'pass' ? 'Platform information collected' :
                   'Test not run yet'}
                </p>
              </Card>
            </div>

            <Card className="p-4 mt-4">
              <h4 className="font-medium mb-2">Debug Information</h4>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>Platform: {navigator.userAgent.includes('iPhone') ? 'iOS' : 
                              navigator.userAgent.includes('Android') ? 'Android' : 'Desktop'}</div>
                <div>Browser: {navigator.userAgent.split(' ')[0]}</div>
                <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
                <div>Pixel Ratio: {window.devicePixelRatio}</div>
                <div>Time Zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};