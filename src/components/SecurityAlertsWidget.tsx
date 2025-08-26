import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SecurityAlerts {
  critical_alerts: number;
  warning_alerts: number;
  suspicious_activities: number;
  overall_status: string;
  last_check: string;
}

export const SecurityAlertsWidget = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<SecurityAlerts | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSecurityAlerts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_security_alerts');
      
      if (error) {
        throw error;
      }
      
      if (data && typeof data === 'object') {
        setAlerts(data as unknown as SecurityAlerts);
      }
    } catch (error: any) {
      console.error('Error fetching security alerts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch security alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSecurityAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  if (!user) return null;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSecurityAlerts}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {alerts ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon(alerts.overall_status)}
              <Badge variant={getStatusColor(alerts.overall_status)}>
                {alerts.overall_status}
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {alerts.critical_alerts}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {alerts.warning_alerts}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {alerts.suspicious_activities}
                </div>
                <div className="text-xs text-muted-foreground">Suspicious</div>
              </div>
            </div>

            {(alerts.critical_alerts > 0 || alerts.warning_alerts > 10) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {alerts.critical_alerts > 0 
                    ? `${alerts.critical_alerts} critical security events detected in the last 24 hours.`
                    : `High number of warnings detected (${alerts.warning_alerts}). Review security logs.`
                  }
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(alerts.last_check).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            {loading ? 'Loading alerts...' : 'No alert data available'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};