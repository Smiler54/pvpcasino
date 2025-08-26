import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId }
        });
        if (error) throw error;
        setStatus('success');
        toast({ title: 'Payment Verified', description: 'Your credits have been added.' });
        // Notify balance hooks to refresh
        window.dispatchEvent(new Event('forceBalanceRefresh'));
      } catch (e: any) {
        setStatus('error');
        toast({ title: 'Verification Failed', description: e.message || 'Could not verify payment.', variant: 'destructive' });
      }
    };
    verify();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Payment {status === 'verifying' ? 'Verifying…' : status === 'success' ? 'Successful' : 'Error'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verifying' && <p>Please wait while we verify your payment…</p>}
          {status === 'success' && <p>Your deposit was successful and your balance has been updated.</p>}
          {status === 'error' && <p>We couldn't verify your payment. If funds were captured, they will be credited shortly.</p>}
          <Button onClick={() => navigate('/profile')} className="w-full">Go to Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
