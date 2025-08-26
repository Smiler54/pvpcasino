import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface SecurityAlertProps {
  className?: string;
}

export const SecurityAlert = ({ className }: SecurityAlertProps) => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [alertType, setAlertType] = useState<'info' | 'warning'>('info');

  useEffect(() => {
    // Check if user has seen security information
    const hasSeenAlert = localStorage.getItem('security-alert-seen');
    if (!hasSeenAlert) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('security-alert-seen', 'true');
  };

  if (!isVisible || !user) return null;

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">Security & Privacy</h4>
              <Badge variant="outline" className="text-xs">
                Protected
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>🔒 Your financial data is protected with bank-level encryption</p>
              <p>🛡️ All transactions are monitored for suspicious activity</p>
              <p>🚫 Automated spam and fraud detection active</p>
              <p>⚡ Rate limiting prevents abuse and ensures fair play</p>
            </div>
            <div className="text-xs text-muted-foreground">
              We use industry-standard security measures to protect your account.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="flex-shrink-0 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};