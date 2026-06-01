import SignUpModal from "@/pages/account/SignUp"
import { toast } from 'sonner';
import {
  Button,
  Container,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useContext, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import nuLogo from "../../../assets/nuLogo.svg"
import { UserContext } from "@/common/contexts/UserContext";

function NavBar({ children }) {
  const [signupOpen, setSignupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isLoading, logout } = useContext(UserContext);
  const location = useLocation();
  const path = location.pathname;
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [path]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
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

            {/* Desktop nav */}
            <div className="header-right header-desktop" style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.15s ease' }}>
              {user ? (
                <>
                  <Button className={navCls('/')} href="/">Home</Button>
                  <Button className={navCls('/analysis')} href="/analysis">Past Analyses</Button>
                  <Button className={navCls('/resumes')} href="/resumes">My Resumes</Button>
                  <Button className="btn-header" onClick={handleLogout}>Sign Out</Button>
                </>
              ) : (
                <Button className="btn-header btn-primary" onClick={() => setSignupOpen(true)}>
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile hamburger */}
            <div className="header-mobile" ref={menuRef}>
              <IconButton
                className="hamburger-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="menu"
                style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.15s ease' }}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </IconButton>

              {menuOpen && (
                <div className="mobile-menu">
                  {user ? (
                    <>
                      <a href="/" className={`mobile-menu-item${path === '/' ? ' mobile-menu-item-active' : ''}`}>Home</a>
                      <a href="/resumes" className={`mobile-menu-item${path === '/resumes' ? ' mobile-menu-item-active' : ''}`}>My Resumes</a>
                      <a href="/analysis" className={`mobile-menu-item${path === '/analysis' ? ' mobile-menu-item-active' : ''}`}>Past Analyses</a>
                      <button className="mobile-menu-item mobile-menu-signout" onClick={handleLogout}>Sign Out</button>
                    </>
                  ) : (
                    <button className="mobile-menu-item mobile-menu-signin" onClick={() => { setMenuOpen(false); setSignupOpen(true); }}>
                      Sign In
                    </button>
                  )}
                </div>
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