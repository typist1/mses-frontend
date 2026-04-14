import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UserProvider } from '@/common/contexts/UserContext';
import NavLayout from '@/common/layouts/NavLayout';

import './App.css';
import Home from './pages/home/Home';
import Resumes from './pages/home/Resumes';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<NavLayout />}>
            <Route index element={<Home/>}/>
            <Route path='resumes' element={<Resumes/>}/>
          </Route>

        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
