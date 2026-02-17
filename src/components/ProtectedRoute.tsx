import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Changed to string[] for flexibility
  requiredPermission?: string; // Feature key required to access this route
}

export function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, hasPermission } = useAuth();

  console.log('🛡️ ProtectedRoute check:', { isLoading, isAuthenticated, user: user?.email });

  // Show loading state while checking authentication
  if (isLoading) {
    console.log('⏳ ProtectedRoute: Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="ml-3 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('❌ ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ ProtectedRoute: Authenticated, rendering protected content');

  // Check permission-based access first (preferred method)
  if (requiredPermission && hasPermission && !hasPermission(requiredPermission)) {
    console.log(`❌ ProtectedRoute: Missing required permission: ${requiredPermission}`);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  // Fallback: Check role-based access if roles are specified (for backward compatibility)
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log(`❌ ProtectedRoute: User role ${user.role} not in allowed roles: ${allowedRoles.join(', ')}`);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
