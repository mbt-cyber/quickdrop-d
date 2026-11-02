import React from 'react';
import EmailAuthScreen from './EmailAuthScreen';
import { Role } from '../../types';

interface PhoneAuthScreenProps {
  initialRole?: Role;
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onRoleSelect?: (role: Role) => void;
}

export const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({
  initialRole = 'customer',
  onClose,
  onSuccess,
  onRoleSelect,
}) => {
  return (
    <EmailAuthScreen
      initialRole={initialRole}
      onClose={onClose}
      onRoleSelect={onRoleSelect}
      onSuccess={onSuccess}
    />
  );
};

export default PhoneAuthScreen;
