import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LogOut, User, RefreshCw, Trophy, DollarSign, Download, Upload, Gift } from 'lucide-react';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const UserProfile = () => {
  const { user, signOut } = useAuth();
  const { balance, username, level, experience, isUpdating, refreshBalance } = useUserBalance();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  if (!user) return null;

  // Calculate progress to next level
  const experienceNeededForNext = (level * 1000);
  const experienceProgress = (experience / experienceNeededForNext) * 100;
  const experienceToNext = experienceNeededForNext - experience;

  // Level rewards calculation
  const getLevelRewards = (userLevel: number) => {
    const baseReward = 50; // Base reward for level 1
    const multiplier = 1.5; // Increase by 50% each level
    return Math.floor(baseReward * Math.pow(multiplier, userLevel - 1));
  };

  // Fetch user data
  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchWithdrawals();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_transactions', { p_limit: 10 });
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_withdrawals');
      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid deposit amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsDepositLoading(true);
    try {
      // Call purchase credits function
      const { data, error } = await supabase.functions.invoke('purchase-credits', {
        body: { amount: parseFloat(depositAmount) }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in a new tab (recommended)
        window.open(data.url, '_blank');
      } else {
        toast({
          title: 'Deposit Initiated',
          description: `Your deposit of $${depositAmount} is being processed.`,
        });
      }

      setDepositAmount('');
      refreshBalance();
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Deposit Failed',
        description: error.message || 'Failed to process deposit.',
        variant: 'destructive',
      });
    } finally {
      setIsDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid withdrawal amount.',
        variant: 'destructive',
      });
      return;
    }

    if (parseFloat(withdrawAmount) > balance) {
      toast({
        title: 'Insufficient Balance',
        description: 'You cannot withdraw more than your current balance.',
        variant: 'destructive',
      });
      return;
    }

    setIsWithdrawLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-payout', {
        body: { amount: parseFloat(withdrawAmount) }
      });
      if (error) throw error;

      toast({
        title: 'Withdrawal Processed',
        description: data?.message || `Transferred $${withdrawAmount} to your bank account.`,
      });
      setWithdrawAmount('');
      refreshBalance();
      fetchWithdrawals();
    } catch (error: any) {
      toast({
        title: 'Withdrawal Failed',
        description: error.message || 'Failed to process withdrawal.',
        variant: 'destructive',
      });
    } finally {
      setIsWithdrawLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Profile Overview Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Profile Overview</CardTitle>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Username:</span>
                <Badge variant="secondary">{username}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email:</span>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-crypto-gold text-black">
                    ${balance.toFixed(2)}
                  </Badge>
                  <Button
                    onClick={refreshBalance}
                    disabled={isUpdating}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Level:</span>
                <Badge variant="outline" className="border-crypto-blue text-crypto-blue">
                  Level {level} ({experience} XP)
                </Badge>
              </div>
            </div>
          </div>
          <Button 
            onClick={signOut} 
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="rewards" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rewards">
            <Trophy className="h-4 w-4 mr-2" />
            Level Rewards
          </TabsTrigger>
          <TabsTrigger value="deposit">
            <Upload className="h-4 w-4 mr-2" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <Download className="h-4 w-4 mr-2" />
            Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Level Progress & Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Level Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress to Level {level + 1}</span>
                  <span>{experience} / {experienceNeededForNext} XP</span>
                </div>
                <Progress value={experienceProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {experienceToNext} XP needed for next level
                </p>
              </div>

              {/* Level Rewards Table */}
              <div className="space-y-2">
                <h4 className="font-medium">Level Rewards</h4>
                <div className="rounded-md border">
                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted/20 font-medium text-sm">
                    <span>Level</span>
                    <span>Reward</span>
                    <span>Status</span>
                  </div>
                  {[...Array(10)].map((_, i) => {
                    const levelNum = i + 1;
                    const reward = getLevelRewards(levelNum);
                    const isEarned = level >= levelNum;
                    const isCurrent = level === levelNum;
                    
                    return (
                      <div key={levelNum} className={`grid grid-cols-3 gap-4 p-3 border-t text-sm ${isCurrent ? 'bg-primary/10' : ''}`}>
                        <span className={isCurrent ? 'font-bold' : ''}>Level {levelNum}</span>
                        <span className="text-crypto-gold font-medium">${reward}</span>
                        <div>
                          {isEarned ? (
                            <Badge variant="default" className="bg-green-600">Earned</Badge>
                          ) : isCurrent ? (
                            <Badge variant="outline" className="border-primary">Current</Badge>
                          ) : (
                            <Badge variant="secondary">Locked</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Add Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Deposit Amount ($)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="Enter amount to deposit"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
              <Button 
                onClick={handleDeposit}
                disabled={isDepositLoading || !depositAmount}
                className="w-full"
              >
                {isDepositLoading ? 'Processing...' : 'Deposit Funds'}
              </Button>
              
              {/* Recent Transactions */}
              <div className="space-y-2">
                <h4 className="font-medium">Recent Transactions</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <div key={transaction.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{transaction.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={transaction.amount > 0 ? 'default' : 'destructive'}>
                          {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Withdraw Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Ensure your bank account is set up with Stripe Express before withdrawing.
                </p>
              </div>
              <div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke('create-express-account', { body: {} });
                      if (error) throw error;
                      const link = data?.url || data?.account_link_url || data?.link_url;
                      if (link) {
                        window.open(link, '_blank');
                      } else {
                        toast({ title: 'Setup Link Unavailable', description: 'Could not open Stripe onboarding link.', variant: 'destructive' });
                      }
                    } catch (e: any) {
                      toast({ title: 'Setup Failed', description: e.message || 'Could not start Stripe onboarding.', variant: 'destructive' });
                    }
                  }}
                  className="w-full"
                >
                  Set up / Manage Bank Account
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Withdrawal Amount ($)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="Enter amount to withdraw"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="1"
                  max={balance}
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  Available balance: ${balance.toFixed(2)}
                </p>
              </div>
              
              <Button 
                onClick={handleWithdraw}
                disabled={isWithdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) > balance}
                className="w-full"
                variant="outline"
              >
                {isWithdrawLoading ? 'Processing...' : 'Request Withdrawal'}
              </Button>

              {/* Withdrawal History */}
              <div className="space-y-2">
                <h4 className="font-medium">Withdrawal History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {withdrawals.length > 0 ? (
                    withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">${withdrawal.amount}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(withdrawal.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={
                          withdrawal.status === 'completed' ? 'default' :
                          withdrawal.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {withdrawal.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No withdrawals yet</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfile;