import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Plus, AlertTriangle } from 'lucide-react';

interface AddCreditsResult {
  success: boolean;
  message: string;
  previous_balance: number;
  new_balance: number;
}

export const AdminCreditsManager = () => {
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AddCreditsResult | null>(null);
  const { toast } = useToast();

  const handleAddCredits = async () => {
    if (!username.trim() || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid username and positive amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('admin-add-credits', {
        body: { 
          username: username.trim(), 
          amount: parseFloat(amount) 
        }
      });

      if (error) {
        const serverMsg = (data as any)?.error || (data as any)?.message || error.message || 'Request failed';
        throw new Error(serverMsg);
      }

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      setResult(data as AddCreditsResult);
      toast({
        title: "Credits Added Successfully",
        description: `Added $${amount} to ${username}`,
      });

      // Clear form
      setUsername('');
      setAmount('');
    } catch (error: any) {
      console.error('Error adding credits:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add credits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Admin Credits Manager
        </CardTitle>
        <CardDescription>
          Add credits to user accounts (Admin Only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This action will immediately add credits to the user's account.
            Ensure you have verified the username and amount before proceeding.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button 
            onClick={handleAddCredits}
            disabled={loading || !username.trim() || !amount || parseFloat(amount) <= 0}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            {loading ? 'Adding Credits...' : 'Add Credits'}
          </Button>
        </div>

        {result && (
          <Alert className="border-green-500">
            <DollarSign className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p><strong>Success!</strong> {result.message}</p>
                <p className="text-sm">
                  Previous Balance: ${result.previous_balance.toFixed(2)}
                </p>
                <p className="text-sm">
                  New Balance: ${result.new_balance.toFixed(2)}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};