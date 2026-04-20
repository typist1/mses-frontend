import SignUpModal from "@/pages/account/SignUp"
import {
  Button,
  Container,
} from '@mui/material';
import { useContext, useState } from "react"
import { useLocation } from "react-router-dom"
import nuLogo from "../../../assets/nuLogo.svg"
import { UserContext } from "@/common/contexts/UserContext";

function NavBar({ children }) {
  const [signupOpen, setSignupOpen] = useState(false);
  const { user, logout } = useContext(UserContext);
  const location = useLocation();
  const onResumesPage = location.pathname === '/resumes';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  };

  return (
    <div className="app">
      <div className="header">
        <Container maxWidth="lg">
          <div className="header-content">
            <div className="header-left">
              <img src={nuLogo} style={{ maxWidth: 25 }} />
              <span className="header-title">Resume Optimizer</span>
            </div>

            <div className="header-right">
              {user ? (
                <>
                  <Button className="btn-header" href={onResumesPage ? '/' : '/resumes'}>
                    {onResumesPage ? 'Home' : 'My Resumes'}
                  </Button>
                  <Button className="btn-header" onClick={handleLogout}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button className="btn-header btn-primary" onClick={() => setSignupOpen(true)}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </Container>
      </div>

      <SignUpModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
      />

      {children}
    </div>
  )
}

export default NavBar