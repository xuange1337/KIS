import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import { USER_ROLE_LABELS, UserRole } from '@crm/shared';
import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

const DRAWER_WIDTH = 264;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Пункт виден только перечисленным ролям; пусто — виден всем. */
  roles?: UserRole[];
}

/** Разделы АРМ соответствуют экранным формам из п. 2.5 ТЗ. */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: <DashboardIcon /> },
  { to: '/clients', label: 'Клиенты', icon: <BusinessIcon /> },
  { to: '/deals', label: 'Сделки', icon: <HandshakeIcon /> },
  { to: '/calendar', label: 'Календарь', icon: <CalendarMonthIcon /> },
  { to: '/offers', label: 'Коммерческие предложения', icon: <DescriptionIcon /> },
  { to: '/reports', label: 'Отчёты', icon: <AssessmentIcon /> },
  {
    to: '/users',
    label: 'Пользователи',
    icon: <PeopleIcon />,
    roles: [UserRole.ADMIN],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(...item.roles),
  );

  const handleLogout = async () => {
    setMenuAnchor(null);
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'none',
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            АРМ менеджера по работе с клиентами
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mr: 1.5, display: { xs: 'none', sm: 'block' } }}
          >
            {user?.fullName} · {user && USER_ROLE_LABELS[user.role]}
          </Typography>
          <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              {initials}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Выйти из системы
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Divider />
        <List sx={{ px: 1, py: 1.5 }}>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              // Главная активна только при точном совпадении, иначе она
              // подсвечивалась бы на всех вложенных маршрутах
              selected={
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
              }
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: 0 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
