import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SecurityStatus {
  admin_count: number;
  recent_suspicious_activities: number;
  security_status: string;
  last_check: string;
}

export const SecurityDashboard = () => {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSecurityStatus = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_security_status');

      if (error) {
        throw error;
      }

      setStatus(data as unknown as SecurityStatus);
    } catch (error: any) {
      console.error('Security status error:', error);
      toast({
        title: "Access Denied",
        description: "Admin privileges required to view security status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityStatus();
  }, [user]);

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Please log in to access the security dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusColor = (status: string) => {
    if (status.includes('CRITICAL')) return 'destructive';
    if (status.includes('HIGH')) return 'destructive';
    if (status.includes('MEDIUM')) return 'secondary';
    return 'default';
  };

  const getStatusIcon = (status: string) => {
    if (status.includes('CRITICAL') || status.includes('HIGH')) {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <CheckCircle className="w-4 h-4" />;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Dashboard
        </CardTitle>
        <CardDescription>
          Monitor security status and potential threats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Security Status</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSecurityStatus}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {status ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Admin Users</span>
                    <Badge variant={status.admin_count === 0 ? 'destructive' : 'default'}>
                      {status.admin_count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Suspicious Activities (24h)</span>
                    <Badge variant={status.recent_suspicious_activities > 5 ? 'destructive' : 'default'}>
                      {status.recent_suspicious_activities}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Alert className={getStatusColor(status.security_status) === 'destructive' ? 'border-red-500' : 'border-green-500'}>
              <div className="flex items-center gap-2">
                {getStatusIcon(status.security_status)}
                <AlertDescription>
                  <strong>Status:</strong> {status.security_status}
                </AlertDescription>
              </div>
            </Alert>

            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(status.last_check).toLocaleString()}
            </div>

            {status.admin_count === 0 && (
              <Alert className="border-red-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Critical:</strong> No admin users found. System administration is not possible.
                  Use the Admin Bootstrap component to create the first admin user.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              {loading ? "Loading security status..." : "Click refresh to load security status"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};