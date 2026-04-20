import { Outlet } from 'react-router-dom';
import NavBar from '@/common/components/navigation/NavBar';

export default function NavLayout() {
  return (
    <NavBar>
      <Outlet />
    </NavBar>
  );
}
