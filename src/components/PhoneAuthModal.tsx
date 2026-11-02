import React from 'react';
import { Role } from '../types';
import EmailAuthScreen from './auth/EmailAuthScreen';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  loginRole?: Role;
  onSuccess?: () => void;
  onRoleSelect?: (role: Role) => void;
}

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  loginRole = 'customer',
  onSuccess,
  onRoleSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md">
        <EmailAuthScreen
          initialRole={loginRole}
          onClose={onClose}
          onRoleSelect={onRoleSelect}
          onSuccess={() => {
            if (onSuccess) onSuccess();
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default PhoneAuthModal;
