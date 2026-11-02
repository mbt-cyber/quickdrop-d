import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';
import EmailAuthScreen from './EmailAuthScreen';
import { ADMIN_EMAIL } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRole?: Role;
  children: React.ReactNode;
  onRedirectRole?: (targetRole: Role) => void;
}

/**
 * Route protection wrapper component.
 * Verifies that the user is authenticated via Supabase Email Auth.
 * If not authenticated, renders the EmailAuthScreen (Sign In / Sign Up).
 * If authenticated with a different role, automatically redirects or notifies.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRole,
  children,
  onRedirectRole,
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while initializing session
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-slate-500 font-sans">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Verifying Supabase Session...
        </p>
      </div>
    );
  }

  // Not logged in -> Show Email Auth Screen
  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-slate-50 font-sans">
        <EmailAuthScreen
          initialRole={allowedRole || 'customer'}
          onRoleSelect={(role) => {
            if (onRedirectRole) {
              onRedirectRole(role);
            }
          }}
          onSuccess={(targetRole) => {
            if (onRedirectRole && targetRole) {
              onRedirectRole(targetRole);
            }
          }}
        />
      </div>
    );
  }

  // Strict Admin Email Protection
  if (allowedRole === 'admin') {
    const isAuthorizedAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAuthorizedAdmin) {
      return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-red-200 shadow-xl text-center font-sans">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black font-heading text-slate-900 mb-1">
            ⚠️ Warning:
          </h3>
          <p className="text-sm font-extrabold text-red-600 mb-3 leading-relaxed whitespace-pre-line">
            Restricted area Do not Proceed Stop
          </p>
          <p className="text-[11px] text-slate-400 mb-5 font-mono">
            Logged in as: {user.email || 'Anonymous'}
          </p>
          <button
            onClick={() => {
              if (onRedirectRole) {
                onRedirectRole('customer');
              }
            }}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Go to Customer Portal
          </button>
        </div>
      );
    }
  }

  // Role mismatch protection: User is logged in as 'customer' trying to view 'rider' or 'admin'
  if (allowedRole && user.role !== allowedRole) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-slate-200 shadow-xl text-center font-sans">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold">
          !
        </div>
        <h3 className="text-lg font-black font-heading text-slate-900 mb-1">
          Role Access Notice
        </h3>
        <p className="text-xs text-slate-600 mb-4">
          You are signed in as <strong className="uppercase text-indigo-600">{user.role}</strong>.
          This section requires <strong className="uppercase text-amber-600">{allowedRole}</strong> authorization.
        </p>
        <button
          onClick={() => {
            if (onRedirectRole) {
              onRedirectRole(user.role);
            }
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
        >
          Go to My {user.role.toUpperCase()} Dashboard
        </button>
      </div>
    );
  }

  // Authenticated & Role Matches -> Render Dashboard
  return <>{children}</>;
};

export default ProtectedRoute;
