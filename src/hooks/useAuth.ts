import { useAuthContext } from '../context/AuthContext';

/**
 * Reusable authentication hook for React components.
 * Provides access to user session, role, OTP generation, verification, and logout.
 */
export const useAuth = () => {
  return useAuthContext();
};

export default useAuth;
