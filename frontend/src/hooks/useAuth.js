import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const useRequireAuth = (allowedRoles = []) => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isAuthenticated, user, allowedRoles]);

  return { user, isAuthenticated };
};
