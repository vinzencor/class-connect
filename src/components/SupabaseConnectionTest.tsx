/**
 * Supabase Connection Test
 * Add this to your Login.tsx temporarily to diagnose connection issues
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function SupabaseConnectionTest() {
  const [status, setStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [message, setMessage] = useState('');
  const [envVars, setEnvVars] = useState({
    url: '',
    keyPrefix: '',
  });

  useEffect(() => {
    // Check environment variables
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setEnvVars({
      url: url || 'NOT SET',
      keyPrefix: key ? key.substring(0, 20) + '...' : 'NOT SET',
    });

    // Test connection
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setStatus('testing');
      setMessage('Testing connection...');

      // Simple health check
      const { data, error } = await supabase
        .from('organizations')
        .select('count', { count: 'exact', head: true });

      if (error) {
        setStatus('error');
        setMessage(`Connection failed: ${error.message}`);
        console.error('Supabase connection error:', error);
      } else {
        setStatus('success');
        setMessage('✅ Successfully connected to Supabase!');
        console.log('Supabase connection successful!', data);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(`Network error: ${err.message}`);
      console.error('Supabase connection error:', err);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-md p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-50">
      <h3 className="font-bold mb-2">🔌 Supabase Connection Test</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>URL:</strong>
          <code className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {envVars.url}
          </code>
        </div>
        
        <div>
          <strong>Key:</strong>
          <code className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {envVars.keyPrefix}
          </code>
        </div>
        
        <div className="pt-2 border-t">
          <strong>Status:</strong>
          <span className={`ml-2 ${
            status === 'success' ? 'text-green-600' :
            status === 'error' ? 'text-red-600' :
            'text-yellow-600'
          }`}>
            {status === 'testing' && '⏳ Testing...'}
            {status === 'success' && '✅ Connected'}
            {status === 'error' && '❌ Failed'}
          </span>
        </div>
        
        <div className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded mt-2">
          {message}
        </div>

        <button
          onClick={testConnection}
          className="w-full mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Test Again
        </button>
      </div>

      {status === 'error' && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          <strong>Quick Fix:</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Verify URL in Supabase Dashboard → Settings → API</li>
            <li>Stop dev server (Ctrl+C)</li>
            <li>Update .env.local with correct URL</li>
            <li>Run: npm run dev</li>
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * HOW TO USE:
 * 
 * 1. Import in Login.tsx:
 *    import { SupabaseConnectionTest } from '@/components/SupabaseConnectionTest';
 * 
 * 2. Add to JSX (at the end, before closing div):
 *    <SupabaseConnectionTest />
 * 
 * 3. Open login page and check the diagnostic panel
 * 
 * 4. Remove after debugging
 */
