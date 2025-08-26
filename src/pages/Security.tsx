import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AdminBootstrap } from '@/components/AdminBootstrap';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { SecurityAlertsWidget } from '@/components/SecurityAlertsWidget';
import { AdminCreditsManager } from '@/components/AdminCreditsManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Security = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        // Check if user has admin role
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (!error && data) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        setIsAuthorized(false);
      }
      setLoading(false);
    };

    checkAuthorization();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <Alert className="border-red-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-4">
                <p><strong>Access Denied</strong></p>
                <p>This security page is restricted to authorized administrators only.</p>
                <Button 
                  onClick={() => navigate('/')} 
                  variant="outline"
                  className="mt-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Home
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Security Center</h1>
        <p className="text-muted-foreground">
          Manage security settings and monitor system health
        </p>
      </div>

      {/* Security Warnings */}
      <Alert className="border-amber-500">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Security Configuration Required:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <strong>OTP Expiry:</strong> Configure shorter OTP expiry times in{' '}
                <a 
                  href="https://supabase.com/dashboard/project/dvdydmknpgweohnwbpeg/auth/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Supabase Auth Settings <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <strong>Password Protection:</strong> Enable leaked password protection in{' '}
                <a 
                  href="https://supabase.com/dashboard/project/dvdydmknpgweohnwbpeg/auth/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Supabase Auth Settings <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SecurityDashboard />
        </div>
        <div className="space-y-6">
          <SecurityAlertsWidget />
        </div>
      </div>

      {/* Admin Credits Manager */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Credits Management</h2>
          <p className="text-muted-foreground text-sm">
            Add credits to user accounts
          </p>
        </div>
        <AdminCreditsManager />
      </div>

      {/* Admin Bootstrap */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Admin Management</h2>
          <p className="text-muted-foreground text-sm">
            Bootstrap the first admin user if none exist
          </p>
        </div>
        <AdminBootstrap />
      </div>

      {/* Security Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Guidelines
          </CardTitle>
          <CardDescription>
            Important security practices for your gaming platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">✅ Implemented Security Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Row Level Security (RLS) policies on all tables</li>
                <li>Input sanitization and validation</li>
                <li>Rate limiting for financial transactions</li>
                <li>Comprehensive audit logging</li>
                <li>Fraud detection for balance changes</li>
                <li>Secure Edge Functions with CORS protection</li>
                <li>Admin privilege escalation monitoring</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">⚠️ Required Manual Configuration</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Configure OTP expiry to 5-10 minutes in Supabase Auth settings</li>
                <li>Enable leaked password protection in Supabase Auth settings</li>
                <li>Set up URL redirects for production domain</li>
                <li>Bootstrap first admin user using the form above</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Security;