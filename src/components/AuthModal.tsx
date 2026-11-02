import React from 'react';
import { Role, UserProfile } from '../types';
import EmailAuthScreen from './auth/EmailAuthScreen';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile;
  initialRole?: Role;
  initialMode?: 'login' | 'signup' | 'forgot';
  onLoginSuccess?: (targetRole?: Role) => void;
  onRoleSelect?: (role: Role) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'customer',
  initialMode = 'login',
  onLoginSuccess,
  onRoleSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md">
        <EmailAuthScreen
          initialRole={initialRole}
          initialMode={initialMode}
          onClose={onClose}
          onRoleSelect={onRoleSelect}
          onSuccess={(userRole) => {
            if (onLoginSuccess) onLoginSuccess(userRole);
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default AuthModal;
