import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Bug, 
  Timer, 
  Palette, 
  Monitor, 
  Smartphone, 
  RotateCcw,
  Eye,
  Clock,
  Settings
} from 'lucide-react';

interface DebugProps {
  players: Array<{
    username: string;
    tickets_bought: number;
    total_value: number;
    percentage: number;
    color?: string;
  }>;
  timerEndAt?: string;
  isVisible?: boolean;
}

export const JackpotDebugger = ({ players, timerEndAt, isVisible = false }: DebugProps) => {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [colorTestMode, setColorTestMode] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    renderTime: 0,
    memoryUsage: 0
  });
  const [timerSyncData, setTimerSyncData] = useState({
    clientTime: '',
    serverTime: '',
    discrepancy: 0,
    platform: ''
  });

  // Detect platform
  useEffect(() => {
    const platform = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') 
      ? 'iOS' 
      : navigator.userAgent.includes('Android') 
      ? 'Android' 
      : 'Desktop';
    
    setTimerSyncData(prev => ({ ...prev, platform }));
  }, []);

  // Performance monitoring
  useEffect(() => {
    if (!debugEnabled) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrame: number;

    const measurePerformance = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        const memoryInfo = (performance as any).memory;
        
        setPerformanceMetrics({
          fps,
          renderTime: now - lastTime,
          memoryUsage: memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 0
        });
        
        frameCount = 0;
        lastTime = now;
      }
      
      animationFrame = requestAnimationFrame(measurePerformance);
    };

    measurePerformance();
    return () => cancelAnimationFrame(animationFrame);
  }, [debugEnabled]);

  // Timer sync monitoring
  useEffect(() => {
    if (!debugEnabled || !timerEndAt) return;

    const checkTimerSync = () => {
      const clientTime = new Date().toISOString();
      const serverEndTime = new Date(timerEndAt).toISOString();
      const discrepancy = new Date(timerEndAt).getTime() - new Date().getTime();
      
      setTimerSyncData(prev => ({
        ...prev,
        clientTime,
        serverTime: serverEndTime,
        discrepancy: Math.floor(discrepancy / 1000)
      }));
    };

    checkTimerSync();
    const interval = setInterval(checkTimerSync, 1000);
    return () => clearInterval(interval);
  }, [debugEnabled, timerEndAt]);

  // Color consistency check
  const validateColors = () => {
    const colorMap = new Map();
    const duplicates = [];
    
    players.forEach((player, index) => {
      if (colorMap.has(player.color)) {
        duplicates.push({
          player1: colorMap.get(player.color),
          player2: player.username,
          color: player.color
        });
      } else {
        colorMap.set(player.color, player.username);
      }
    });
    
    return {
      total: players.length,
      unique: colorMap.size,
      duplicates
    };
  };

  const colorValidation = validateColors();

  // Test functions
  const runColorTest = () => {
    console.group('🎨 Color Consistency Test');
    players.forEach((player, index) => {
      console.log(`Player ${index + 1}: ${player.username}`, {
        assignedColor: player.color,
        percentage: player.percentage,
        tickets: player.tickets_bought
      });
    });
    console.log('Color validation:', colorValidation);
    console.groupEnd();
  };

  const runTimerTest = () => {
    console.group('⏰ Timer Sync Test');
    console.log('Platform:', timerSyncData.platform);
    console.log('Client Time:', timerSyncData.clientTime);
    console.log('Server End Time:', timerSyncData.serverTime);
    console.log('Discrepancy (seconds):', timerSyncData.discrepancy);
    console.log('Browser:', navigator.userAgent);
    console.groupEnd();
  };

  const runPerformanceTest = () => {
    console.group('⚡ Performance Test');
    console.log('FPS:', performanceMetrics.fps);
    console.log('Render Time:', performanceMetrics.renderTime + 'ms');
    console.log('Memory Usage:', performanceMetrics.memoryUsage + 'MB');
    console.log('Players Count:', players.length);
    console.groupEnd();
  };

  if (!isVisible && !debugEnabled) return null;

  return (
    <Card className="bg-card/95 backdrop-blur-sm border-orange-500/50 mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Jackpot Debug Panel</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="debug-mode"
              checked={debugEnabled}
              onCheckedChange={setDebugEnabled}
            />
            <Label htmlFor="debug-mode" className="text-sm">Enable</Label>
          </div>
        </div>
        <CardDescription>
          Bug testing tools for color rendering, timer sync, and performance
        </CardDescription>
      </CardHeader>

      {debugEnabled && (
        <CardContent className="space-y-4">
          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-green-500">{performanceMetrics.fps}</div>
              <div className="text-xs text-muted-foreground">FPS</div>
            </div>
            <div className="text-center p-3 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-500">{performanceMetrics.memoryUsage}</div>
              <div className="text-xs text-muted-foreground">MB Memory</div>
            </div>
            <div className="text-center p-3 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-500">{timerSyncData.discrepancy}s</div>
              <div className="text-xs text-muted-foreground">Timer Sync</div>
            </div>
          </div>

          <Separator />

          {/* Color Testing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Color Consistency</span>
              </div>
              <Badge variant={colorValidation.duplicates.length > 0 ? "destructive" : "default"}>
                {colorValidation.unique}/{colorValidation.total} Unique
              </Badge>
            </div>
            
            {colorValidation.duplicates.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3">
                <div className="text-sm font-medium text-destructive mb-2">⚠️ Color Conflicts Detected:</div>
                {colorValidation.duplicates.map((dup, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    {dup.player1} & {dup.player2} both have {dup.color}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {players.slice(0, 8).map((player, index) => (
                <div 
                  key={player.username}
                  className="flex items-center gap-2 bg-background/50 rounded-lg px-2 py-1"
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-xs">{player.username}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Timer Sync Testing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="font-medium">Timer Synchronization</span>
              <Badge variant="outline">{timerSyncData.platform}</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-background/50 rounded-lg p-2">
                <div className="text-muted-foreground mb-1">Client Time</div>
                <div className="font-mono">{timerSyncData.clientTime.slice(-8)}</div>
              </div>
              <div className="bg-background/50 rounded-lg p-2">
                <div className="text-muted-foreground mb-1">Server End Time</div>
                <div className="font-mono">{timerSyncData.serverTime.slice(-8)}</div>
              </div>
            </div>

            {Math.abs(timerSyncData.discrepancy) > 2 && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-2">
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ Timer discrepancy detected: {timerSyncData.discrepancy}s
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Test Controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Test Controls</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runColorTest}
                className="flex items-center gap-2"
              >
                <Palette className="h-3 w-3" />
                Color Test
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={runTimerTest}
                className="flex items-center gap-2"
              >
                <Timer className="h-3 w-3" />
                Timer Test
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={runPerformanceTest}
                className="flex items-center gap-2"
              >
                <Monitor className="h-3 w-3" />
                Performance
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Device Info */}
          <div className="text-xs text-muted-foreground bg-background/30 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-3 w-3" />
              <span className="font-medium">Device Info</span>
            </div>
            <div>Platform: {timerSyncData.platform}</div>
            <div>User Agent: {navigator.userAgent.slice(0, 60)}...</div>
            <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};