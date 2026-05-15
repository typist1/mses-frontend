import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UserProvider } from '@/common/contexts/UserContext';
import NavLayout from '@/common/layouts/NavLayout';
import { PrivateRoute } from '@/common/components/routes/ProtectedRoutes';

import './App.css';
import Home from './pages/home/Home';
import Resumes from './pages/home/Resumes';
import ResumeEditor from './pages/editor/ResumeEditor';
import Analysis from './pages/analysis/Analysis';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<NavLayout />}>
            <Route index element={<Home/>}/>
            <Route element={<PrivateRoute />}>
              <Route path='resumes' element={<Resumes/>}/>
              <Route path='editor' element={<ResumeEditor/>}/>
              <Route path='editor/:resumeId' element={<ResumeEditor/>}/>
              <Route path='analysis' element={<Analysis/>}/>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
