import { Navigate, Outlet } from 'react-router-dom';

import { useUser } from '@/common/contexts/UserContext';

export function PrivateRoute() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return null;
  }

  return user ? <Outlet /> : <Navigate to='/' replace />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return null;
  }

  return !user ? <Outlet /> : <Navigate to='/' replace />;
}
