import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PaymentCanceled = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Payment Canceled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Your payment was canceled. You can try again anytime.</p>
          <Button onClick={() => navigate('/profile')} className="w-full">Back to Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCanceled;
