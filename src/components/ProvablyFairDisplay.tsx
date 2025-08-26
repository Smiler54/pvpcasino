import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Hash, Eye, EyeOff, Copy, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProvablyFairData {
  game_id: string;
  server_seed_hash: string;
  server_seed?: string;
  client_seed: string;
  hmac_result?: string;
  result?: string;
  winner_name?: string;
  status: string;
  completed_at?: string;
}

interface ProvablyFairDisplayProps {
  gameId: string;
  gameType: 'coinflip' | 'jackpot';
  showTitle?: boolean;
  compact?: boolean;
}

export const ProvablyFairDisplay = ({ gameId, gameType, showTitle = true, compact = false }: ProvablyFairDisplayProps) => {
  const [fairData, setFairData] = useState<ProvablyFairData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationSeed, setVerificationSeed] = useState('');
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const { toast } = useToast();

  const loadFairData = async () => {
    if (!gameId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_game_provably_fair_data', {
        p_game_id: gameId,
        p_game_type: gameType
      });

      if (error) throw error;
      setFairData(data as unknown as ProvablyFairData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load provably fair data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const verifyResult = async () => {
    if (!fairData?.server_seed || !verificationSeed) return;

    try {
      // Create HMAC using Web Crypto API
      const serverSeedBuffer = new TextEncoder().encode(fairData.server_seed);
      const clientSeedBuffer = new TextEncoder().encode(verificationSeed);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        serverSeedBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, clientSeedBuffer);
      const hashArray = Array.from(new Uint8Array(signature));
      const hmacResult = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (gameType === 'coinflip') {
        // Use first 8 characters for coinflip result
        const hexValue = hmacResult.substring(0, 8);
        const decimalValue = parseInt(hexValue, 16);
        const result = decimalValue % 2 === 0 ? 'heads' : 'tails';
        setVerificationResult(result);
      } else {
        // For jackpot, show the HMAC result
        setVerificationResult(hmacResult);
      }

      toast({
        title: "Verification Complete",
        description: `Result verified using client seed: ${verificationSeed}`,
      });
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Unable to verify result",
        variant: "destructive"
      });
    }
  };

  if (!gameId) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="p-4 text-center">
          <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No game selected</p>
        </CardContent>
      </Card>
    );
  }

  if (!fairData && !isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className={compact ? "pb-2" : ""}>
          {showTitle && (
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5 text-crypto-gold" />
              Provably Fair Verification
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className={compact ? "pt-2" : ""}>
          <div className="text-center space-y-4">
            <Button onClick={loadFairData} variant="outline">
              Load Verification Data
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="p-4 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading verification data...</p>
        </CardContent>
      </Card>
    );
  }

  const isCompleted = fairData?.status === 'completed';

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
      <CardHeader className={compact ? "pb-2" : ""}>
        {showTitle && (
          <>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5 text-crypto-gold" />
              Provably Fair Verification
            </CardTitle>
            <CardDescription>
              Cryptographic proof that this game was fair and predetermined
            </CardDescription>
          </>
        )}
        <div className="flex items-center gap-2">
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed & Verifiable
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Game In Progress
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className={`space-y-4 ${compact ? "pt-2" : ""}`}>
        {/* Server Seed Hash (Always Visible) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            Server Seed Hash (Pre-committed)
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(fairData?.server_seed_hash || '', 'Server Seed Hash')}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </Label>
          <div className="bg-muted p-3 rounded font-mono text-xs break-all">
            {fairData?.server_seed_hash}
          </div>
          <p className="text-xs text-muted-foreground">
            This hash was generated before the game started and proves the server seed was predetermined.
          </p>
        </div>

        {/* Client Seed */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            Client Seed (Player Input)
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(fairData?.client_seed || '', 'Client Seed')}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </Label>
          <div className="bg-muted p-3 rounded font-mono text-xs break-all">
            {fairData?.client_seed}
          </div>
          <p className="text-xs text-muted-foreground">
            This seed was generated to ensure randomness and prevent manipulation.
          </p>
        </div>

        {/* Server Seed (Only for completed games) */}
        {isCompleted && fairData?.server_seed && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              Server Seed (Revealed)
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(fairData.server_seed!, 'Server Seed')}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </Label>
            <div className="bg-muted p-3 rounded font-mono text-xs break-all">
              {fairData.server_seed}
            </div>
            <p className="text-xs text-muted-foreground">
              The original server seed is now revealed. Verify this matches the hash above.
            </p>
          </div>
        )}

        {/* Game Result */}
        {isCompleted && (fairData?.result || fairData?.winner_name) && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Game Result</Label>
            <div className="bg-primary/10 p-3 rounded">
              {gameType === 'coinflip' ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{fairData.result === 'heads' ? '👑' : '⚡'}</span>
                  <span className="font-bold capitalize">{fairData.result}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <span className="font-bold">Winner: {fairData.winner_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Verification Section */}
        {isCompleted && fairData?.server_seed && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVerification(!showVerification)}
                >
                  {showVerification ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showVerification ? 'Hide' : 'Show'} Manual Verification
                </Button>
              </div>

              {showVerification && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <Label className="text-sm font-medium">
                    Verify Result Manually
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enter the client seed to manually verify the game result using HMAC-SHA256.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter client seed..."
                      value={verificationSeed}
                      onChange={(e) => setVerificationSeed(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={verifyResult}
                      disabled={!verificationSeed}
                      size="sm"
                    >
                      Verify
                    </Button>
                  </div>
                  {verificationResult && (
                    <div className="bg-primary/10 p-3 rounded">
                      <p className="text-sm font-medium">Verification Result:</p>
                      <p className="font-mono text-xs mt-1">{verificationResult}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Instructions for incomplete games */}
        {!isCompleted && (
          <div className="bg-muted/50 p-3 rounded">
            <p className="text-xs text-muted-foreground">
              The server seed will be revealed when this game completes, allowing full verification of the result.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};