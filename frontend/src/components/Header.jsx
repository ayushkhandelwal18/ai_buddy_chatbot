// import React from 'react';
import AppBar  from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Logo from "./shared/Logo";
import { useAuth } from '../context/AuthContent';
import NavigationLink from './shared/NavigationLink';
import { IconButton } from '@mui/material';
import { FaGithub } from 'react-icons/fa';


function Header() {
  const auth =useAuth();
  return (
    <AppBar sx={{bgcolor:"transparent",
        position:"static",
        boxShadow:"none",
    }}>
        <Toolbar sx={{
            display:"flex",
        }}>
            <Logo/>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {auth?.isLoggedIn ? (
            <>
              <NavigationLink
                bg="#00fffc"
                to="/chat"
                text="Go To Chat"
                textColor="black"
              />
              <NavigationLink
                bg="#51538f"
                textColor="white"
                to="/"
                text="logout"
                onClick={auth.logout}
              />
            </>
          ) : (
            <>
              <NavigationLink
                bg="#00fffc"
                to="/login"
                text="Login"
                textColor="black"
              />
              <NavigationLink
                bg="#51538f"
                textColor="white"
                to="/signup"
                text="Signup"
              />
            </>
          )}
        </div>

       <IconButton
  component="a"
  href="https://github.com/ayushkhandelwal18/AI-Chat-Bot"
  target="_blank"
  rel="noopener noreferrer"
  sx={{ color: "white", ml: 2 }}
  aria-label="GitHub repository"
>
  <FaGithub size={28} />
</IconButton>

        </Toolbar>
    </AppBar>
  )
}

export default Header;
