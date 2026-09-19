import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { USER_ROLE_LABELS, UserRole } from '@crm/shared';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { DURATION, NEUTRAL, TOKENS } from '../theme/tokens';

const RAIL_WIDTH = 228;
const RAIL_WIDTH_COLLAPSED = 60;
/** Ниже этой ширины меню сворачивается само: рабочей области остаётся мало. */
const AUTO_COLLAPSE_WIDTH = 1100;
const COLLAPSE_STORAGE_KEY = 'crm.sidebar.collapsed';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Пункт виден только перечисленным ролям; пусто — виден всем. */
  roles?: UserRole[];
}

/** Разделы АРМ соответствуют экранным формам из п. 2.5 ТЗ. */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Обзор', icon: <GridViewOutlinedIcon /> },
  { to: '/clients', label: 'Клиенты', icon: <BusinessOutlinedIcon /> },
  { to: '/deals', label: 'Сделки', icon: <SwapHorizOutlinedIcon /> },
  { to: '/calendar', label: 'Календарь', icon: <CalendarTodayOutlinedIcon /> },
  // Полное название «Коммерческие предложения» ломало вертикальный ритм
  // меню переносом на две строки, поэтому здесь оно сокращено
  { to: '/offers', label: 'Предложения', icon: <DescriptionOutlinedIcon /> },
  { to: '/reports', label: 'Отчёты', icon: <AssessmentOutlinedIcon /> },
  {
    to: '/users',
    label: 'Пользователи',
    icon: <PeopleOutlinedIcon />,
    roles: [UserRole.ADMIN],
  },
];

/**
 * Оболочка приложения.
 *
 * Меню закреплено и отделено от рабочей области одной линией: отдельная
 * верхняя панель занимала бы высоту, не неся информации, поэтому сведения
 * о пользователе перенесены вниз меню. На узких экранах меню сворачивается
 * до значков, чтобы таблицы не теряли ширину.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const muiTheme = useTheme();
  /**
   * На телефоне меню убирается в выдвижную панель.
   *
   * Свёрнутая полоса значков занимала 60 из 360 точек — шестую часть
   * ширины, постоянно, на каждом экране. Для таблицы клиентов это
   * заметная потеря, а сами значки без подписей на ощупь неочевидны.
   */
  const isPhone = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Переход по разделу закрывает панель: иначе она перекрывает открытый экран
  const location_pathname_for_drawer = location.pathname;
  useEffect(() => {
    setDrawerOpen(false);
  }, [location_pathname_for_drawer]);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth < AUTO_COLLAPSE_WIDTH;
  });

  // Выбор пользователя сохраняется, но на узком экране меню сворачивается
  // принудительно: там развёрнутое отнимает треть рабочей ширины
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_WIDTH) setCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(!previous));
      return !previous;
    });
  };

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

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // На телефоне панель всегда развёрнута: там она не отнимает ширину
  // у содержимого, а значки без подписей читаются хуже
  const width = collapsed && !isPhone ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH;
  const compact = collapsed && !isPhone;

  const navigation = (
    <Box
      component="nav"
      aria-label="Разделы системы"
      sx={{
        width,
        flexShrink: 0,
        borderRight: `1px solid ${TOKENS.border}`,
        bgcolor: TOKENS.surfaceSunken,
        display: 'flex',
        flexDirection: 'column',
        position: isPhone ? 'static' : 'sticky',
        top: 0,
        height: isPhone ? '100%' : '100vh',
        transition: `width ${DURATION.normal}ms`,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={compact ? 'center' : 'space-between'}
        sx={{ px: compact ? 0 : 2.25, pt: 2.5, pb: 2 }}
      >
        {!compact && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              АРМ · CRM
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.125 }}>
              работа с клиентами
            </Typography>
          </Box>
        )}
        {!isPhone && (
          <Tooltip title={compact ? 'Развернуть меню' : 'Свернуть меню'}>
            <IconButton
              size="small"
              onClick={toggleCollapsed}
              aria-label={compact ? 'Развернуть меню' : 'Свернуть меню'}
              aria-expanded={!compact}
            >
              {compact ? (
                <KeyboardDoubleArrowRightIcon sx={{ fontSize: 17 }} />
              ) : (
                <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 17 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack
        component="ul"
        sx={{
          gap: 0.25,
          listStyle: 'none',
          m: 0,
          px: compact ? 1 : 1.5,
          py: 0,
        }}
      >
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          const link = (
            <Box
              component={NavLink}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              aria-label={compact ? item.label : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: compact ? 'center' : 'flex-start',
                gap: 1.25,
                px: compact ? 0 : 1.25,
                height: 38,
                borderRadius: 1,
                textDecoration: 'none',
                color: active ? NEUTRAL[0] : TOKENS.textSecondary,
                bgcolor: active ? TOKENS.primary : 'transparent',
                transition: `background-color ${DURATION.fast}ms, color ${DURATION.fast}ms`,
                '&:hover': {
                  bgcolor: active ? TOKENS.primary : NEUTRAL[100],
                  color: active ? NEUTRAL[0] : TOKENS.textPrimary,
                },
                '& svg': { fontSize: 18, flexShrink: 0 },
              }}
            >
              {item.icon}
              {!compact && (
                <Typography
                  sx={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}
                  noWrap
                >
                  {item.label}
                </Typography>
              )}
            </Box>
          );

          return (
            <Box component="li" key={item.to}>
              {compact ? (
                <Tooltip title={item.label} placement="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          px: compact ? 1 : 1.75,
          py: 1.5,
          justifyContent: compact ? 'center' : undefined,
        }}
      >
        <Tooltip
          title={
            compact
              ? `${user?.fullName} · ${user && USER_ROLE_LABELS[user.role]}`
              : ''
          }
        >
          <Avatar
            sx={{
              width: 30,
              height: 30,
              bgcolor: TOKENS.primary,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>

        {!compact && (
          <>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}
                noWrap
              >
                {user?.fullName}
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                {user && USER_ROLE_LABELS[user.role]}
              </Typography>
            </Box>
            <Tooltip title="Выйти из системы">
              <IconButton
                size="small"
                aria-label="Выйти из системы"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
              >
                <LogoutIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleLogout} sx={{ fontSize: 13 }}>
          <ListItemIcon>
            <LogoutIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
          Выйти из системы
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isPhone ? 'column' : 'row',
        minHeight: '100vh',
        bgcolor: TOKENS.background,
      }}
    >
      {/*
        Ссылка пропуска навигации.
        Меню — это шесть-семь ссылок перед содержимым каждого экрана;
        тому, кто работает с клавиатуры или диктора, приходилось
        прощёлкивать их заново на каждой странице. Ссылка видна только
        при фокусе и не занимает места в обычном режиме.
      */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 10,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: TOKENS.surface,
          border: `1px solid ${TOKENS.borderControl}`,
          color: TOKENS.textPrimary,
          fontSize: 13,
          textDecoration: 'none',
          transition: `top ${DURATION.fast}ms`,
          '&:focus': { top: 8 },
        }}
      >
        Перейти к содержимому
      </Box>

      {isPhone ? (
        <>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1,
              py: 0.75,
              borderBottom: `1px solid ${TOKENS.border}`,
              bgcolor: TOKENS.surface,
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            <IconButton
              aria-label="Открыть меню"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              АРМ менеджера
            </Typography>
          </Stack>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            // Панель поверх содержимого, а не рядом: на 360 точках
            // постоянное меню не оставляет места таблице
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: RAIL_WIDTH } }}
          >
            {navigation}
          </Drawer>
        </>
      ) : (
        navigation
      )}

      <Box
        component="main"
        id="main-content"
        // Фокус переводится на область содержимого по ссылке пропуска
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          // В строке нулевая ширина с flexGrow не даёт содержимому
          // растягивать колонку; в столбце она же обнуляет ширину,
          // и весь экран схлопывается в узкую полосу
          width: isPhone ? '100%' : 0,
          px: { xs: 2, md: 3, lg: 4 },
          py: { xs: 2.5, md: 3 },
          maxWidth: 1680,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
