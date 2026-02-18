import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeGoogleCode } from '@/services/googleCalendarService';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'loading' | 'success' | 'error';

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Connecting Google Calendar...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Google authorization failed: ${error}`);
      toast.error('Google authorization was denied');
      setTimeout(() => navigate('/dashboard/settings', { replace: true }), 2000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received from Google');
      toast.error('No authorization code received');
      setTimeout(() => navigate('/dashboard/settings', { replace: true }), 2000);
      return;
    }

    // Wait for auth to be ready
    if (!user) return;

    const handleCallback = async () => {
      try {
        // After returning from Google OAuth redirect, give Supabase a moment
        // to re-establish the session from localStorage/cookies
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = await exchangeGoogleCode(code);

        if (result.success) {
          setStatus('success');
          setMessage(`Connected as ${result.connected_email || 'Google Account'}`);
          toast.success('Google Calendar connected successfully!');
          setTimeout(() => navigate('/dashboard/settings', { replace: true }), 1500);
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to connect Google Calendar');
          toast.error(result.error || 'Failed to connect Google Calendar');
          setTimeout(() => navigate('/dashboard/settings', { replace: true }), 2500);
        }
      } catch (err: unknown) {
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Unexpected error occurred';
        setMessage(errorMessage);
        toast.error(errorMessage);
        setTimeout(() => navigate('/dashboard/settings', { replace: true }), 2500);
      }
    };

    handleCallback();
  }, [searchParams, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">{message}</h2>
            <p className="text-muted-foreground">Please wait while we connect your Google account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Google Calendar Connected!</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Connection Failed</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
          </>
        )}
      </div>
    </div>
  );
}
