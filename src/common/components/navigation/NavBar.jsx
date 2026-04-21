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
  const path = location.pathname;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  };

  const navCls = (p) => `btn-header${path === p ? ' btn-header-active' : ''}`;

  return (
    <div className="app">
      <div className="header">
        <Container maxWidth="lg">
          <div className="header-content">
            <div className="header-left">
              <a href="/" className="header-logo-link">
                <img src={nuLogo} style={{ maxWidth: 25 }} />
                <span className="header-title">Resume Optimizer</span>
              </a>
            </div>

            <div className="header-right">
              {user ? (
                <>
                  <Button className={navCls('/')} href="/">Home</Button>
                  <Button className={navCls('/resumes')} href="/resumes">My Resumes</Button>
                  <Button className={navCls('/editor')} href="/editor">Resume Editor</Button>
                  <Button className="btn-header" onClick={handleLogout}>Sign Out</Button>
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