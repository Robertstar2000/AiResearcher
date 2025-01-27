import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Box, AppBar, Toolbar, Typography, Container, Button, IconButton } from '@mui/material'
import { Menu as MenuIcon, ExitToApp as ExitToAppIcon } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { signOut } from '../services/authService'
import { AuthUser } from '../store/slices/authSlice'
import { useState } from 'react'
import SignInDialog from './SignInDialog'

const Layout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated)
  const user = useSelector((state: RootState) => state.auth.user) as AuthUser | null
  const [signInOpen, setSignInOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={2}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Box component="span" sx={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
              AI Researcher
            </Box>
            <Typography 
              variant="subtitle1" 
              component="span" 
              sx={{ 
                ml: 2,
                color: 'white',
                opacity: 0.9,
                fontStyle: 'italic',
                display: { xs: 'none', sm: 'inline' },
                fontSize: '1.4rem'
              }}
            >
              AI Powered Virtual Research Assistant
            </Typography>
          </Typography>
          {isAuthenticated ? (
            <>
              <Typography variant="body1" sx={{ mr: 2 }}>
                {user?.email}
              </Typography>
              <IconButton color="inherit" onClick={handleLogout}>
                <ExitToAppIcon />
              </IconButton>
            </>
          ) : (
            location.pathname === '/' && (
              <Button color="inherit" onClick={() => setSignInOpen(true)}>
                Login
              </Button>
            )
          )}
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
      />
    </Box>
  )
}

export default Layout
