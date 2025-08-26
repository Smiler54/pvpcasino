import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertTriangle } from 'lucide-react';

interface BootstrapResult {
  success: boolean;
  message?: string;
  error?: string;
  user_id?: string;
  email?: string;
}

export const AdminBootstrap = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const { toast } = useToast();

  const handleBootstrap = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('bootstrap_admin_from_email', {
        p_email: email
      });

      if (error) {
        throw error;
      }

      const resultData = data as unknown as BootstrapResult;
      setResult(resultData);
      
      if (resultData.success) {
        toast({
          title: "Admin Bootstrap Successful",
          description: `Admin role granted to ${email}`,
        });
      } else {
        toast({
          title: "Bootstrap Failed",
          description: resultData.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      toast({
        title: "Bootstrap Error",
        description: error.message || "Failed to bootstrap admin",
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
          <Shield className="w-5 h-5" />
          Admin Bootstrap
        </CardTitle>
        <CardDescription>
          Create the first admin user for this system. This can only be done once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will grant admin privileges to the specified user account. Only use this for trusted administrators.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="email">User Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button 
          onClick={handleBootstrap}
          disabled={loading || !email}
          className="w-full"
        >
          {loading ? "Bootstrapping..." : "Bootstrap Admin"}
        </Button>

        {result && (
          <Alert className={result.success ? "border-green-500" : "border-red-500"}>
            <AlertDescription>
              {result.success ? (
                <span className="text-green-700">
                  ✅ {result.message}
                </span>
              ) : (
                <span className="text-red-700">
                  ❌ {result.error}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};