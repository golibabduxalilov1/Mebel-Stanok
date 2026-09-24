/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Plus, 
  Search, 
  AlertCircle, 
  LogOut, 
  User, 
  ChevronRight, 
  ChevronLeft,
  Star,
  Layers,
  Database,
  Calendar,
  MapPin,
  Tag,
  Hammer,
  History,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  History as HistoryIcon,
  Cog,
  Wrench,
  XCircle,
  Boxes,
  Building2,
  BarChart3,
  MoveHorizontal,
  PlusCircle,
  Package,
  TrendingDown,
  Clock,
  Printer,
  ChevronDown,
  ShoppingCart,
  ListOrdered,
  RefreshCw,
  Pencil,
  Camera,
  Upload,
  Maximize2,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Check,
  Receipt,
  CircleDollarSign,
  Filter,
  Menu as MenuIcon,
  Phone,
  Users,
  Shield,
  ShieldAlert,
  Key,
  Lock,
  LogIn,
  EyeOff,
  Archive,
  ArrowRightLeft,
  FolderOpen,
  Folder
} from 'lucide-react';
import { MachineFilesModal } from './components/MachineFilesModal';


async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { machineService, DEFAULT_UNITS } from './services/machineService';
import { userService, canAccessTab, canPerformAction } from './services/userService';
import { Machine, MachineStatus, MaintenanceLog, LogType, Branch, SparePart, MaintenanceSchedule, Transfer, ActivityLog, UnitOfMeasure, ToirTaskType, AppUser, Role } from './types';
import { TOIR_CATEGORIES, getToirCategory, calculateDeadlineInfo, ToirCategoryConfig } from './toirConstants';
import { UsersTab } from './components/UsersTab';
import { 
  CreateToirScheduleModal, 
  EditToirScheduleModal, 
  ToirScheduleCard, 
  ToirGuideModal, 
  ToirScheduleItem,
  getToirIcon 
} from './components/ToirScheduleManager';


// Helper for status colors
const getStatusColor = (status: MachineStatus) => {
  switch (status) {
    case 'active': return 'bg-emerald-500';
    case 'maintenance': return 'bg-amber-500';
    case 'repair': return 'bg-rose-500';
    case 'retired': return 'bg-slate-500';
    default: return 'bg-slate-500';
  }
};

const getStatusLabel = (status: MachineStatus) => {
  switch (status) {
    case 'active': return 'Активен';
    case 'maintenance': return 'Обслуживание';
    case 'repair': return 'В ремонте';
    case 'retired': return 'Списан';
    default: return status;
  }
};

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>(DEFAULT_UNITS);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [allLogs, setAllLogs] = useState<MaintenanceLog[]>([]);
  const [allSchedules, setAllSchedules] = useState<MaintenanceSchedule[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingMachine, setIsEditingMachine] = useState(false);
  const [machineToDeleteId, setMachineToDeleteId] = useState<string | null>(null);
  const [machineToTransfer, setMachineToTransfer] = useState<Machine | null>(null);
  const [transferTargetBranchId, setTransferTargetBranchId] = useState<string>('');
  const [machineToDecommission, setMachineToDecommission] = useState<Machine | null>(null);
  const [decommissionReason, setDecommissionReason] = useState<string>('Плановый вывод из эксплуатации (износ)');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [filesModalMachine, setFilesModalMachine] = useState<Machine | null>(null);
  const [photoLightboxUrl, setPhotoLightboxUrl] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<{ images: string[]; initialIndex: number; title?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [registryBranchFilter, setRegistryBranchFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'maintenance' | 'repair' | 'branches' | 'inventory' | 'reports' | 'history' | 'users'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearPasswordError, setClearPasswordError] = useState(false);

  // App Users and RBAC Roles state
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [appRoles, setAppRoles] = useState<Role[]>([]);
  const [activeAppUser, setActiveAppUser] = useState<AppUser | null>(null);
  const [sessionToast, setSessionToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (sessionToast) {
      const timer = setTimeout(() => setSessionToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [sessionToast]);

  // Credentials login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Restore a session from the httpOnly refresh cookie on first load, if there is one.
  useEffect(() => {
    let cancelled = false;
    userService.restoreSession().then((user) => {
      if (cancelled) return;
      if (user) setActiveAppUser(user);
      setAuthLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const hasSession = Boolean(activeAppUser);

  useEffect(() => {
    if (!hasSession) return;
    const unsubUsers = userService.subscribeUsers(setAppUsers);
    const unsubRoles = userService.subscribeRoles(setAppRoles);
    const unsubscribeM = machineService.subscribeToMachines(setMachines);
    const unsubscribeB = machineService.subscribeToBranches(setBranches);
    const unsubscribeH = machineService.subscribeToActivityLogs(setActivityLogs);
    refreshData();
    return () => {
      unsubUsers();
      unsubRoles();
      unsubscribeM();
      unsubscribeB();
      unsubscribeH();
    };
  }, [hasSession]);

  useEffect(() => {
    if (selectedMachine && machines.length > 0) {
      const updated = machines.find(m => m.id === selectedMachine.id);
      if (updated) {
        if (JSON.stringify(updated) !== JSON.stringify(selectedMachine)) {
          setSelectedMachine(updated);
        }
      }
    }
  }, [machines, selectedMachine]);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const [sp, logs, scheds, hist, u, usersList, rolesList] = await Promise.all([
        machineService.getSpareParts(),
        machineService.getAllLogs(),
        machineService.getAllSchedules(),
        machineService.getActivityLogs(),
        machineService.getUnitsOfMeasure(),
        userService.getUsers(),
        userService.getRoles()
      ]);
      setSpareParts(sp);
      setAllLogs(logs);
      setAllSchedules(scheds);
      setActivityLogs(hist);
      setUnits(u);
      setAppUsers(usersList);
      setAppRoles(rolesList);
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const ALL_TABS = useMemo(() => [
    { id: 'all', permId: 'machines', label: 'Оборудование', icon: LayoutDashboard, count: machines.length },
    { id: 'maintenance', permId: 'maintenance', label: 'Техобслуживание (ТОиР)', icon: Cog, count: allSchedules.length },
    { id: 'branches', permId: 'branches', label: 'Филиалы', icon: Building2, count: branches.length },
    { id: 'inventory', permId: 'inventory', label: 'Склад запчастей', icon: Boxes, count: spareParts.length },
    { id: 'users', permId: 'users', label: 'Пользователи и роли', icon: Users, count: appUsers.length },
    { id: 'reports', permId: 'reports', label: 'Аналитические отчеты', icon: BarChart3 },
    { id: 'history', permId: 'history', label: 'История изменений', icon: History }
  ], [machines.length, allSchedules.length, branches.length, spareParts.length, appUsers.length]);

  const currentRole = useMemo(() => {
    if (!activeAppUser) return null;
    return appRoles.find(r => r.id === activeAppUser.roleId) || 
           appRoles.find(r => r.name.toLowerCase().trim() === activeAppUser.roleName?.toLowerCase().trim()) || 
           null;
  }, [activeAppUser, appRoles]);

  const allowedTabs = useMemo(() => {
    return ALL_TABS.filter(tab => canAccessTab(currentRole, tab.permId));
  }, [ALL_TABS, currentRole]);

  const canOpenMachineManagement = useMemo(() => {
    return canPerformAction(currentRole, 'machines.management', 'view');
  }, [currentRole]);

  // If role does not have permission to open management, close machine card if open
  useEffect(() => {
    if (selectedMachine && !canOpenMachineManagement) {
      setSelectedMachine(null);
    }
  }, [canOpenMachineManagement, selectedMachine]);

  // If current activeTab is no longer allowed, automatically switch to first allowed tab
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0].id as any);
    }
  }, [allowedTabs, activeTab]);

  // Machine attachment thumbnails point at an authenticated download endpoint that a
  // plain <img src> can't fetch (it needs a Bearer header) - resolve those to blob URLs
  // up front so grid/table thumbnails and the lightbox don't render as broken/black.
  useEffect(() => {
    let isMounted = true;
    const urls = new Set<string>();
    machines.forEach(m => getMachineImages(m).forEach(u => urls.add(u)));
    const toResolve = Array.from(urls).filter(u => !resolvedImageUrls[u]);
    if (toResolve.length === 0) return;
    (async () => {
      const entries: Record<string, string> = {};
      for (const url of toResolve) {
        try {
          const resolved = await machineService.resolveImageUrl(url);
          if (resolved) entries[url] = resolved;
        } catch (e) {
          console.error('Error resolving machine image URL:', e);
        }
      }
      if (isMounted && Object.keys(entries).length > 0) {
        setResolvedImageUrls(prev => ({ ...prev, ...entries }));
      }
    })();
    return () => { isMounted = false; };
  }, [machines]);

  const imgSrc = (url: string): string => resolvedImageUrls[url] || url;

  // Only used for the two legitimate self-sync cases from UsersTab.tsx: an admin
  // editing their own active account (updatedUser), or deleting it (null, signs out).
  // "Become another user without a password" has been removed - real login is required.
  const handleSelectActiveUser = (updatedUser: AppUser | null) => {
    if (!updatedUser) {
      handleAppSignOut();
      return;
    }
    setActiveAppUser(updatedUser);
  };

  const handleCredentialsLogin = async (overrideUser?: string, overridePass?: string) => {
    const uName = (overrideUser !== undefined ? overrideUser : loginUsername).trim();
    const pWord = overridePass !== undefined ? overridePass : loginPassword;

    setLoginError(null);
    if (!uName || !pWord) {
      setLoginError('Пожалуйста, введите логин и пароль');
      return;
    }

    setIsLoggingIn(true);
    try {
      const matched = await userService.login(uName, pWord);
      setActiveAppUser(matched);

      const roles = appRoles.length > 0 ? appRoles : await userService.getRoles();
      const targetRole = roles.find(r => r.id === matched.roleId) ||
                       roles.find(r => r.name.toLowerCase().trim() === matched.roleName?.toLowerCase().trim());

      let nextTab: any = 'all';
      if (!canAccessTab(targetRole, 'machines')) {
        const firstAllowed = ALL_TABS.find(t => canAccessTab(targetRole, t.permId));
        nextTab = firstAllowed ? firstAllowed.id : 'all';
      }
      setActiveTab(nextTab);

      setSessionToast({
        type: 'success',
        message: `Вход выполнен! Вы вошли как: ${matched.fullName} (${matched.roleName || 'Пользователь'})`
      });
    } catch (err: any) {
      if (err.code === 'INVALID_CREDENTIALS') {
        setLoginError('Неверный логин или пароль. Проверьте правильность введенных данных.');
      } else if (err.code === 'FORBIDDEN') {
        setLoginError('Данная учетная запись заблокирована администратором.');
      } else {
        setLoginError(err.message || 'Ошибка входа');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAppSignOut = async () => {
    setActiveAppUser(null);
    await userService.logout();
  };

  const handleClearDatabase = async () => {
    try {
      setIsClearingDb(true);
      await machineService.clearAllData(clearPassword);
      await refreshData();
      setMachines([]);
      setBranches([]);
      setActivityLogs([]);
      setShowClearConfirm(false);
      setClearPassword('');
      setClearPasswordError(false);
    } catch (err) {
      console.error("Database clear error:", err);
      setClearPasswordError(true);
    } finally {
      setIsClearingDb(false);
    }
  };

  const [seedingDemo, setSeedingDemo] = useState(false);
  const handleSeedDemoData = async () => {
    try {
      setSeedingDemo(true);
      await machineService.seedDemoData();
      await refreshData();
      const updatedMachines = await machineService.getMachines();
      setMachines(updatedMachines);
      const updatedBranches = await machineService.getBranches();
      setBranches(updatedBranches);
    } catch (err) {
      console.error("Seed demo data error:", err);
    } finally {
      setSeedingDemo(false);
    }
  };

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.manufacturer && m.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         m.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = registryBranchFilter === 'all' || m.branchId === registryBranchFilter;

    if (activeTab === 'all') return matchesSearch && matchesBranch;
    if (activeTab === 'maintenance') return matchesSearch && matchesBranch && m.status === 'maintenance';
    if (activeTab === 'repair') return matchesSearch && matchesBranch && m.status === 'repair';
    return matchesSearch && matchesBranch;
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Settings className="w-8 h-8 text-slate-400" />
        </motion.div>
      </div>
    );
  }

  if (!activeAppUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-4 sm:p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-slate-200"
        >
          <div className="flex justify-center mb-6">
            <div className="p-3.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
              <Settings className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 mb-1 tracking-tight">StankoBase Pro</h1>
          <p className="text-slate-500 text-center mb-6 text-xs sm:text-sm font-medium">Система учета промышленного оборудования</p>

          {/* Credentials Login Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleCredentialsLogin(); }} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Логин или Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin, technolog, mechanic..."
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Пароль
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4 text-blue-600" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoggingIn ? 'Авторизация...' : 'Войти в систему'}</span>
            </button>
          </form>

          <p className="mt-5 text-center text-[10px] text-slate-400 font-mono">Enterprise Edition v1.3 • StankoBase RBAC</p>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-[#f1f5f9] relative overflow-x-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {sessionToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold backdrop-blur-md ${
              sessionToast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-800 shadow-rose-500/10'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10'
            }`}
          >
            {sessionToast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{sessionToast.message}</span>
            <button 
              onClick={() => setSessionToast(null)} 
              className="ml-2 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72 sm:w-80 bg-[#1e293b] text-white flex flex-col z-50 shadow-2xl lg:hidden"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-base tracking-tight block">StankoBase Pro</span>
                    <span className="text-[10px] text-slate-400 font-mono">Мобильная версия</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile in Drawer */}
              <div className="p-4 bg-slate-900/40 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                    style={{ backgroundColor: activeAppUser?.roleColor || '#3b82f6' }}
                  >
                    {activeAppUser?.fullName
                      ? activeAppUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')
                      : <User className="w-5 h-5 text-white" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {activeAppUser?.fullName || 'Администратор'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600/40 text-blue-200">
                        {activeAppUser?.roleName || 'Администратор'}
                      </span>
                      {activeAppUser?.branchName && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {activeAppUser.branchName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={handleAppSignOut} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Выйти">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                {allowedTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button 
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm text-left font-semibold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <tab.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.count !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                          isActive ? 'bg-blue-700/60 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Status Footer in Drawer */}
              <div className="p-3.5 bg-slate-900/70 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  PostgreSQL API
                </span>
                <span>v1.2.4</span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-[#1e293b] text-white hidden lg:flex flex-col border-r border-slate-200 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">StankoBase Pro</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {allowedTabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm text-left font-medium transition-all cursor-pointer ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <tab.icon className="w-5 h-5 shrink-0" />
                <span>{tab.label}</span>
              </div>
              {tab.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === tab.id ? 'bg-blue-700/60 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
              style={{ backgroundColor: activeAppUser?.roleColor || '#3b82f6' }}
            >
              {activeAppUser?.fullName
                ? activeAppUser.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')
                : <User className="w-4 h-4 text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {activeAppUser?.fullName || 'Пользователь'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600/40 text-blue-200">
                  {activeAppUser?.roleName || 'Администратор'}
                </span>
              </div>
            </div>
            <button onClick={handleAppSignOut} className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer p-1.5" title="Выйти">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 md:px-8 z-10 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all active:scale-95 shrink-0"
              title="Открыть меню"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            <h1 className="text-sm sm:text-base md:text-xl font-bold text-slate-800 uppercase tracking-tight truncate">
              {activeTab === 'all' && 'Реестр оборудования'}
              {activeTab === 'maintenance' && 'График ТОиР'}
              {activeTab === 'repair' && 'Ремонтный цех'}
              {activeTab === 'branches' && 'Филиалы'}
              {activeTab === 'inventory' && 'Склад запчастей'}
              {activeTab === 'users' && 'Пользователи и роли'}
              {activeTab === 'reports' && 'Отчеты'}
              {activeTab === 'history' && 'История'}
            </h1>

          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {activeTab === 'all' && canPerformAction(currentRole, 'machines.catalog', 'create') && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="min-h-10 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Добавить станок</span>
                <span className="xs:hidden sm:hidden">Станок</span>
              </button>
            )}
            {activeTab === 'branches' && canPerformAction(currentRole, 'branches.branch_list', 'create') && (
              <button 
                onClick={() => setShowBranchModal(true)}
                className="min-h-10 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Создать филиал</span>
                <span className="xs:hidden sm:hidden">Филиал</span>
              </button>
            )}
            {activeTab === 'inventory' && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {canPerformAction(currentRole, 'inventory.units', 'view') && (
                  <button 
                    onClick={() => setShowUnitsModal(true)}
                    className="hidden sm:flex min-h-10 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all items-center gap-1.5 active:scale-95"
                    title="Управление единицами измерения"
                  >
                    <Tag className="w-4 h-4 text-blue-600" />
                    Единицы
                  </button>
                )}
                {canPerformAction(currentRole, 'inventory.parts_catalog', 'create') && (
                  <button 
                    onClick={() => setShowPartModal(true)}
                    className="min-h-10 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden xs:inline sm:inline">Оприходовать</span>
                    <span className="xs:hidden sm:hidden">Запчасть</span>
                  </button>
                )}
              </div>
            )}
            
            <button 
              onClick={refreshData}
              disabled={refreshing}
              className="p-3 sm:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90 shrink-0"
              title="Обновить данные"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Mobile Search Toggle */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className={`p-3 rounded-xl transition-all active:scale-90 ${
                  isMobileSearchOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'
                }`}
                title="Поиск"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Desktop Search Input */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="w-px h-6 bg-slate-200"></div>
              {activeTab === 'all' && (
                <select
                  value={registryBranchFilter}
                  onChange={(e) => setRegistryBranchFilter(e.target.value)}
                  className="min-w-[140px] max-w-[160px] min-h-10 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
                  title="Фильтр по филиалу"
                >
                  <option value="all">Все филиалы ({machines.length})</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({machines.filter(m => m.branchId === b.id).length})
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-48 bg-slate-50"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Search Bar Expandable */}
        <AnimatePresence>
          {isMobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white px-3 py-2 border-b border-slate-200 overflow-hidden shrink-0"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Поиск по названию, модели, SN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-10 pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex flex-col min-h-0 pb-6 md:pb-8">
          {!canAccessTab(currentRole, activeTab === 'all' ? 'machines' : activeTab) ? (
            <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto my-12">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">
                Доступ к разделу ограничен
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                Для вашей роли «<strong className="text-slate-800 font-bold">{currentRole?.name || 'Пользователь'}</strong>» отключены права доступа к этому разделу в матрице полномочий.
              </p>
              {allowedTabs.length > 0 && (
                <button
                  onClick={() => setActiveTab(allowedTabs[0].id as any)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Перейти в раздел «{allowedTabs[0].label}»
                </button>
              )}
            </div>
          ) : activeTab === 'all' ? (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-3 sm:gap-6 shrink-0">
                <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">Всего активов</p>
                  <h3 className="text-xl sm:text-3xl font-mono font-bold text-slate-800">{machines.length}</h3>
                </div>
                <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 transition-all hover:shadow-md text-slate-800">
                  <p className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5 sm:mb-1">В работе</p>
                  <h3 className="text-xl sm:text-3xl font-mono font-bold text-slate-800">{machines.filter(m => m.status === 'active').length}</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1 truncate">Готовы к эксплуатации</p>
                </div>
              </div>

              {/* Mobile Card List (sm:hidden) */}
              <div className="sm:hidden space-y-2.5">
                <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Список оборудования</span>
                  <span>Найдено: {filteredMachines.length}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {filteredMachines.map((machine) => {
                    const machineImages = getMachineImages(machine);
                    const fileCount = Math.max(
                      machine.attachments?.length || 0,
                      (machine.imageUrls?.length || (machine.imageUrl ? 1 : 0))
                    );
                    return (
                      <motion.div
                        key={machine.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => {
                          if (canOpenMachineManagement) {
                            setSelectedMachine(machine);
                          }
                        }}
                        className={`bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm transition-all flex flex-col gap-2.5 ${
                          canOpenMachineManagement ? 'active:bg-slate-50 cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {machineImages.length > 0 ? (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxState({
                                  images: machineImages.map(imgSrc),
                                  initialIndex: 0,
                                  title: `Станок: ${machine.name} (${machine.model || ''})`
                                });
                              }}
                              className="relative w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 shrink-0 cursor-pointer group/img hover:ring-2 hover:ring-blue-500 transition-all z-10"
                              title="Нажмите для просмотра фото в 1 клик"
                            >
                              <img
                                src={imgSrc(machineImages[0])}
                                alt={machine.name} 
                                className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                                referrerPolicy="no-referrer"
                              />
                              {machineImages.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-tight">
                                  +{machineImages.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400 shrink-0">
                              <Hammer className="w-7 h-7 opacity-60" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                machine.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                machine.status === 'maintenance' ? 'bg-amber-100 text-amber-700' :
                                machine.status === 'repair' ? 'bg-rose-100 text-rose-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {getStatusLabel(machine.status)}
                              </span>
                              {machine.manufacturer && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[110px]">
                                  {machine.manufacturer}
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm line-clamp-2 break-words leading-snug">{machine.name}</h3>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase truncate">
                              {machine.model} • SN: {machine.serialNumber}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 text-slate-600">
                          <div className="flex items-center gap-1.5 min-w-0 truncate text-slate-500 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate font-medium">{branches.find(b => b.id === machine.branchId)?.name || 'Не указан'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 shrink-0">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>ТО: {formatSafeDate(machine.nextMaintenanceDate)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilesModalMachine(machine);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-10 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs active:scale-95 cursor-pointer group/mobfolder"
                            title="Папка материалов станка (видео, фото, документы)"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-amber-600 group-hover/mobfolder:scale-110 transition-transform" />
                            <span className="font-extrabold text-[11px] text-amber-950">Папка</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                              fileCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-white text-slate-400 border border-slate-200'
                            }`}>
                              {fileCount}
                            </span>
                          </button>

                          {canOpenMachineManagement && (
                            <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                              Открыть <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {filteredMachines.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1">
                      {machines.length === 0 ? 'База данных пуста' : 'Оборудование не найдено'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
                      {machines.length === 0 
                        ? 'В системе пока нет станков. Загрузите демонстрационный комплект ТОиР или добавьте оборудование вручную.' 
                        : 'По вашему поисковому запросу ничего не найдено.'}
                    </p>
                    {machines.length === 0 && (
                      <div className="flex flex-col gap-2 w-full max-w-xs">
                        <button
                          onClick={handleSeedDemoData}
                          disabled={seedingDemo}
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {seedingDemo ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Загрузка...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>Загрузить демо-данные</span>
                            </>
                          )}
                        </button>
                        {canPerformAction(currentRole, 'machines.catalog', 'create') && (
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                          >
                            + Добавить станок вручную
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Table Container (hidden sm:flex) */}
              <div className="hidden sm:flex bg-white rounded-2xl border border-slate-200 shadow-sm flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="font-semibold text-slate-700 uppercase text-xs tracking-widest">Список оборудования</h2>
                  <span className="text-xs text-slate-400">Показано {filteredMachines.length} объектов</span>
                </div>

                <div>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        <th className="px-6 py-4 border-b">Станок</th>
                        <th className="px-6 py-4 border-b">Производитель</th>
                        <th className="px-6 py-4 border-b">Филиал</th>
                        <th className="px-6 py-4 border-b">Статус</th>
                        <th className="px-6 py-4 border-b">ТО</th>
                        <th className="px-4 py-4 border-b text-center">Папка</th>
                        {canOpenMachineManagement && (
                          <th className="px-6 py-4 border-b text-right">Управление</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      <AnimatePresence mode="popLayout">
                        {filteredMachines.map((machine) => {
                          const machineImages = getMachineImages(machine);
                          const fileCount = Math.max(
                            machine.attachments?.length || 0,
                            (machine.imageUrls?.length || (machine.imageUrl ? 1 : 0))
                          );
                          return (
                            <motion.tr 
                              key={machine.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="hover:bg-blue-50/50 transition-colors group cursor-default"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {machineImages.length > 0 ? (
                                    <div 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxState({
                                          images: machineImages.map(imgSrc),
                                          initialIndex: 0,
                                          title: `Станок: ${machine.name} (${machine.model || ''})`
                                        });
                                      }}
                                      className="relative w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 shrink-0 cursor-pointer group/img hover:ring-2 hover:ring-blue-500 transition-all"
                                      title="Нажмите для просмотра фото в 1 клик"
                                    >
                                      <img
                                        src={imgSrc(machineImages[0])}
                                        alt={machine.name} 
                                        className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                                        referrerPolicy="no-referrer"
                                      />
                                      {machineImages.length > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-tight">
                                          +{machineImages.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400 shrink-0">
                                      <Hammer className="w-6 h-6 opacity-60" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-semibold text-slate-800">{machine.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{machine.model} / SN: {machine.serialNumber}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {machine.manufacturer ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/70">
                                    {machine.manufacturer}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium italic">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-slate-600 font-medium">
                                  {branches.find(b => b.id === machine.branchId)?.name || 'Не указан'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                  machine.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                  machine.status === 'maintenance' ? 'bg-amber-100 text-amber-700' :
                                  machine.status === 'repair' ? 'bg-rose-100 text-rose-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {getStatusLabel(machine.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                                {formatSafeDate(machine.nextMaintenanceDate)}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilesModalMachine(machine);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer group/folder"
                                  title="Папка материалов станка (видео, фото, документы, схемы)"
                                >
                                  <FolderOpen className="w-4 h-4 text-amber-600 group-hover/folder:scale-110 transition-transform" />
                                  <span className="font-extrabold text-[11px] text-amber-950">Папка</span>
                                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                    fileCount > 0 
                                      ? 'bg-amber-200 text-amber-950 border border-amber-300/70' 
                                      : 'bg-white text-slate-400 border border-slate-200'
                                  }`}>
                                    {fileCount}
                                  </span>
                                </button>
                              </td>
                              {canOpenMachineManagement && (
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => setSelectedMachine(machine)}
                                    className="text-blue-600 font-medium hover:underline flex items-center gap-1 justify-end w-full cursor-pointer"
                                  >
                                    Открыть
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                  {filteredMachines.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
                        <Sparkles className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mb-1.5">
                        {machines.length === 0 ? 'База данных оборудования пуста' : 'Записей не найдено'}
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                        {machines.length === 0 
                          ? 'В системе пока нет зарегистрированных станков и производственных участков. Вы можете добавить станок вручную или в 1 клик загрузить готовый комплект демонстрационных данных ТОиР (станки, цеха, склад запчастей и регламенты).'
                          : 'По текущему фильтру или поисковому запросу ничего не найдено. Попробуйте сбросить фильтры.'}
                      </p>
                      {machines.length === 0 && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleSeedDemoData}
                            disabled={seedingDemo}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {seedingDemo ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Загрузка данных ТОиР...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                <span>Загрузить демонстрационные данные</span>
                              </>
                            )}
                          </button>
                          {canPerformAction(currentRole, 'machines.catalog', 'create') && (
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                            >
                              + Добавить станок вручную
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'maintenance' ? (
            <MaintenanceScheduleTab machines={machines} schedules={allSchedules} logs={allLogs} branches={branches} parts={spareParts} onRefresh={refreshData} role={currentRole} />
          ) : activeTab === 'branches' ? (
            <BranchesTab branches={branches} machines={machines} onRefresh={refreshData} role={currentRole} />
          ) : activeTab === 'inventory' ? (
            <InventoryTab parts={spareParts} units={units} branches={branches} machines={machines} onOpenUnitsModal={() => setShowUnitsModal(true)} onRefresh={refreshData} role={currentRole} />
          ) : activeTab === 'users' ? (
            <UsersTab 
              users={appUsers}
              roles={appRoles}
              branches={branches}
              activeAppUser={activeAppUser}
              onSelectActiveUser={handleSelectActiveUser}
              onRefresh={refreshData}
              role={currentRole}
            />
          ) : activeTab === 'reports' ? (
            <ReportsTab machines={machines} branches={branches} logs={allLogs} parts={spareParts} role={currentRole} />
          ) : activeTab === 'history' ? (
            <HistoryTab 
              logs={activityLogs} 
              machines={machines} 
              branches={branches} 
              parts={spareParts} 
              maintenanceLogs={allLogs} 
              role={currentRole}
            />
          ) : null}

        </div>

        {/* Desktop Status Bar Footer */}
        <footer className="hidden lg:flex h-8 whitespace-nowrap overflow-hidden gap-4 bg-[#007acc] text-white items-center px-4 text-[11px] font-medium shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>БАЗА ДАННЫХ: ПОДКЛЮЧЕНО (POSTGRESQL)</span>
            </div>
            <div className="h-4 w-px bg-white/20"></div>
            <span>ПОСЛЕДНЯЯ СИНХРОНИЗАЦИЯ: {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="ml-auto flex gap-4 shrink-0">
            <span>v1.2.4-stable</span>
            <span className="uppercase tracking-tighter italic opacity-80">Cloud-Native Runtime</span>
          </div>
        </footer>
      </main>

      {/* Detail Panel / Modal Context */}
      <AnimatePresence>
        {selectedMachine && canOpenMachineManagement && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMachine(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm shadow-inner"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col"
            >
              <div className="p-4 sm:p-6 md:p-8 border-b border-slate-100 flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2 bg-slate-50/50">
                <div className="min-w-0 order-last sm:order-none w-full sm:w-auto sm:flex-1 sm:mr-2">
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-1 line-clamp-2 break-words">{selectedMachine.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                     <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white ${getStatusColor(selectedMachine.status)}`}>
                      {getStatusLabel(selectedMachine.status)}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-slate-400 truncate">
                      {selectedMachine.manufacturer ? `${selectedMachine.manufacturer} • ` : ''}Модель: {selectedMachine.model}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {(canPerformAction(currentRole, 'machines.catalog', 'edit') || canPerformAction(currentRole, 'machines.cards', 'edit')) && (
                    <button 
                      onClick={() => {
                        const nextStatus = selectedMachine.status === 'active' ? 'maintenance' : 'active';
                        machineService.updateMachine(selectedMachine.id, {
                          status: nextStatus
                        }).then(() => setSelectedMachine(prev => prev ? {...prev, status: nextStatus} : null));
                      }}
                      className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                      title="Сменить статус"
                    >
                      <Cog className="w-4 h-4" />
                    </button>
                  )}
                  {(canPerformAction(currentRole, 'machines.transfers', 'create') || canPerformAction(currentRole, 'machines.transfers', 'edit')) && (
                    <button 
                      onClick={() => {
                        setMachineToTransfer(selectedMachine);
                        setTransferTargetBranchId(selectedMachine.branchId || (branches[0]?.id ?? ''));
                      }}
                      className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                      title="Переместить станок в другой филиал"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}
                  {selectedMachine.status !== 'retired' && (canPerformAction(currentRole, 'machines.decommission', 'create') || canPerformAction(currentRole, 'machines.decommission', 'edit')) && (
                    <button 
                      onClick={() => setMachineToDecommission(selectedMachine)}
                      className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-all"
                      title="Списать оборудование"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                  {(canPerformAction(currentRole, 'machines.catalog', 'edit') || canPerformAction(currentRole, 'machines.cards', 'edit')) && (
                    <button 
                      onClick={() => setIsEditingMachine(true)}
                      className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canPerformAction(currentRole, 'machines.catalog', 'delete') && (
                    <button 
                      disabled={refreshing}
                      onClick={() => {
                        if (selectedMachine) setMachineToDeleteId(selectedMachine.id);
                      }}
                      className={`min-h-10 min-w-10 flex items-center justify-center p-1.5 transition-all rounded-lg ${refreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button 
                    onClick={() => setSelectedMachine(null)}
                    className="min-h-10 min-w-10 flex items-center justify-center p-1.5 sm:p-2 hover:bg-slate-200/50 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 md:space-y-8 custom-scrollbar">
                {/* Photo Gallery Component */}
                <MachineDetailPhotoGallery 
                  machine={selectedMachine} 
                  onOpenManage={() => setShowPhotoModal(true)} 
                  onOpenFiles={() => setFilesModalMachine(selectedMachine)}
                  onOpenLightbox={(idx) => setLightboxState({
                    images: getMachineImages(selectedMachine).map(imgSrc),
                    initialIndex: idx,
                    title: selectedMachine.name
                  })}
                  canManagePhoto={canPerformAction(currentRole, 'machines.catalog', 'edit') || canPerformAction(currentRole, 'machines.cards', 'edit')}
                />

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2">
                       <Clock className="w-3 h-3" />
                       Амортизация (текущая цена)
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-slate-900 wrap-anywhere">
                      {machineService.calculateCurrentValue(selectedMachine).toLocaleString()} ₽
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase">Закупка: {(selectedMachine.purchasePrice || 0).toLocaleString()} ₽</p>
                  </div>
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2">
                       <Building2 className="w-3 h-3" />
                       Текущий филиал
                    </p>
                    <p className="text-base sm:text-lg font-bold text-indigo-600 break-words">
                      {branches.find(b => b.id === selectedMachine.branchId)?.name || 'Неизвестно'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2">
                       <CheckCircle2 className="w-3 h-3" />
                       Последнее ТО
                    </p>
                    <p className="text-lg font-bold text-emerald-600">
                      {new Date(selectedMachine.lastMaintenanceDate).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2">
                       <Calendar className="w-3 h-3" />
                       След. ТО
                    </p>
                    <p className="text-lg font-bold text-amber-600">
                      {new Date(selectedMachine.nextMaintenanceDate).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>

                {/* Details Section */}
                <section>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-indigo-500" />
                    Технические данные
                  </h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 sm:gap-x-8 px-1 sm:px-2">
                    {[
                      { label: 'Производитель', value: selectedMachine.manufacturer || 'Не указан' },
                      { label: 'Модель', value: selectedMachine.model },
                      { label: 'Серийный номер', value: selectedMachine.serialNumber },
                      { label: 'Расположение', value: branches.find(b => b.id === selectedMachine.branchId)?.name || 'Не указан' },
                      { label: 'Дата закупки', value: selectedMachine.purchaseDate ? new Date(selectedMachine.purchaseDate).toLocaleDateString('ru-RU') : 'Не указана' },
                      { label: 'Годовая амортизация', value: selectedMachine.purchasePrice > 0 && selectedMachine.purchaseDate ? `${machineService.calculateYearlyDepreciation(selectedMachine).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽/год` : 'Не указана' },
                      { label: 'Дата установки', value: selectedMachine.installationDate ? new Date(selectedMachine.installationDate).toLocaleDateString('ru-RU') : 'Не указана' },
                      { label: 'Дневная амортизация', value: selectedMachine.purchasePrice > 0 && selectedMachine.purchaseDate ? `${machineService.calculateDailyDepreciation(selectedMachine).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽/день` : 'Не указана' },
                      { label: 'Срок службы', value: `${selectedMachine.usefulLifeYears || 10} лет`, fullWidth: true },
                    ].map((item, idx) => (
                      <div key={idx} className={`min-w-0 ${item.fullWidth ? 'col-span-2' : ''}`}>
                        <p className="text-xs text-slate-400 font-medium truncate mb-1">{item.label}</p>
                        <p className="font-semibold text-slate-900 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50">
                    <p className="text-xs text-slate-400 font-medium mb-2">Описание</p>
                    <p className="text-sm text-slate-600 leading-relaxed italic">{selectedMachine.description || 'Описание отсутствует'}</p>
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-500" />
                    График амортизации
                  </h4>
                  <div className="bg-slate-50 p-3 sm:p-6 rounded-2xl border border-slate-100">
                    <DepreciationChart machine={selectedMachine} />
                  </div>
                </section>

                <ScheduleList machineId={selectedMachine.id} parts={spareParts} machines={machines} branches={branches} onRefresh={refreshData} role={currentRole} />

                <LogsList machineId={selectedMachine.id} parts={spareParts} machines={machines} branches={branches} onRefresh={refreshData} role={currentRole} />
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Database Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 text-rose-600 mb-4">
                  <div className="p-2 bg-rose-50 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">Очистка базы данных</h3>
                </div>
                
                <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                  Вы собираетесь полностью **очистить базу данных**!
                </p>
                <p className="text-sm text-rose-600 font-medium mb-4 leading-relaxed">
                  Будут навсегда удалены все станки, филиалы, запчасти, периодические задачи, записи техобслуживания и история изменений. Это действие абсолютно необратимо.
                </p>

                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Пароль администратора:
                  </label>
                  <input
                    type="password"
                    value={clearPassword}
                    onChange={(e) => {
                      setClearPassword(e.target.value);
                      setClearPasswordError(false);
                    }}
                    placeholder="Введите пароль"
                    className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all ${
                      clearPasswordError ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white focus:border-rose-500'
                    }`}
                  />
                  {clearPasswordError && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">Неверный пароль администратора.</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Введите пароль <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700 border border-slate-300/30">admin</code> для подтверждения сброса.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isClearingDb}
                    onClick={() => {
                      setShowClearConfirm(false);
                      setClearPassword('');
                      setClearPasswordError(false);
                    }}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    disabled={isClearingDb}
                    onClick={handleClearDatabase}
                    className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isClearingDb ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Очистка...
                      </>
                    ) : (
                      'Да, очистить всё'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!machineToDeleteId} onClose={() => setMachineToDeleteId(null)} title="Подтверждение удаления">
        <div className="p-2">
          <p className="text-slate-600 mb-6 font-medium">Вы действительно хотите удалить это оборудование? Это действие необратимо и удалит все связанные данные.</p>
          <div className="flex gap-3">
            <button 
              onClick={() => setMachineToDeleteId(null)}
              className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Отмена
            </button>
            <button 
              onClick={async () => {
                if (machineToDeleteId) {
                  setRefreshing(true);
                  try {
                    await machineService.deleteMachine(machineToDeleteId);
                    setMachineToDeleteId(null);
                    setSelectedMachine(null);
                  } catch (e) {
                    alert('Ошибка: ' + (e instanceof Error ? e.message : 'Unknown error'));
                  } finally {
                    setRefreshing(false);
                  }
                }
              }}
              disabled={refreshing}
              className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
            >
              {refreshing ? 'Удаление...' : 'Да, удалить'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Machine Transfer Modal */}
      <Modal 
        isOpen={!!machineToTransfer} 
        onClose={() => setMachineToTransfer(null)} 
        title="Перемещение станка между филиалами"
      >
        {machineToTransfer && (
          <div className="p-2 space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs text-slate-500 font-medium">Оборудование:</p>
              <p className="text-sm font-bold text-slate-900">{machineToTransfer.name} ({machineToTransfer.model})</p>
              <p className="text-xs text-slate-500 mt-1">
                Текущий филиал: <span className="font-semibold text-slate-800">{branches.find(b => b.id === machineToTransfer.branchId)?.name || 'Не назначен'}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Выберите филиал назначения:
              </label>
              <select
                value={transferTargetBranchId}
                onChange={(e) => setTransferTargetBranchId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id} disabled={b.id === machineToTransfer.branchId}>
                    {b.name} {b.id === machineToTransfer.branchId ? '(текущий)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setMachineToTransfer(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button 
                type="button"
                disabled={refreshing || !transferTargetBranchId || transferTargetBranchId === machineToTransfer.branchId}
                onClick={async () => {
                  if (!machineToTransfer || !transferTargetBranchId) return;
                  setRefreshing(true);
                  try {
                    await machineService.transferMachine(
                      machineToTransfer.id, 
                      machineToTransfer.branchId || '', 
                      transferTargetBranchId
                    );
                    setSelectedMachine(prev => prev ? { ...prev, branchId: transferTargetBranchId } : null);
                    setMachineToTransfer(null);
                  } catch (err) {
                    alert('Ошибка перемещения: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setRefreshing(false);
                  }
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 cursor-pointer"
              >
                {refreshing ? 'Перемещение...' : 'Переместить'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Machine Decommission Modal */}
      <Modal 
        isOpen={!!machineToDecommission} 
        onClose={() => setMachineToDecommission(null)} 
        title="Списание оборудования (Вывод из эксплуатации)"
      >
        {machineToDecommission && (
          <div className="p-2 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              Внимание: списание переведет станок в статус <strong>«Списан»</strong> с фиксацией в журнале истории.
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs text-slate-500 font-medium">Оборудование к списанию:</p>
              <p className="text-sm font-bold text-slate-900">{machineToDecommission.name} ({machineToDecommission.model})</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">SN: {machineToDecommission.serialNumber}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Причина списания:
              </label>
              <input 
                type="text"
                value={decommissionReason}
                onChange={(e) => setDecommissionReason(e.target.value)}
                placeholder="Например: Полный физический износ, не подлежит ремонту"
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setMachineToDecommission(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button 
                type="button"
                disabled={refreshing}
                onClick={async () => {
                  if (!machineToDecommission) return;
                  setRefreshing(true);
                  try {
                    await machineService.updateMachine(machineToDecommission.id, {
                      status: 'retired',
                      description: `${machineToDecommission.description ? machineToDecommission.description + ' | ' : ''}Списан: ${decommissionReason} (${new Date().toLocaleDateString('ru-RU')})`
                    });
                    setSelectedMachine(prev => prev ? { ...prev, status: 'retired' } : null);
                    setMachineToDecommission(null);
                  } catch (err) {
                    alert('Ошибка списания: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setRefreshing(false);
                  }
                }}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50 cursor-pointer"
              >
                {refreshing ? 'Списание...' : 'Подтвердить списание'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Machine Modal */}
      <Modal isOpen={isEditingMachine} onClose={() => setIsEditingMachine(false)} title="Редактировать оборудование">
        {selectedMachine && (
          <EditMachineForm 
            machine={selectedMachine} 
            branches={branches} 
            onComplete={(updatedData) => {
              setIsEditingMachine(false);
              if (updatedData) {
                // Manually patch selectedMachine for immediate UI feedback
                setSelectedMachine(prev => prev ? { ...prev, ...updatedData } : null);
              }
              // refreshData(); // Machines are updated via onSnapshot subscription
            }} 
          />
        )}
      </Modal>

      {/* Add Machine Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Добавить новое оборудование">
        <AddMachineForm branches={branches} onComplete={() => { setShowAddModal(false); refreshData(); }} />
      </Modal>

      {/* Schedule Modal */}
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Запланировать обслуживание">
        {selectedMachine && (
          <AddScheduleForm 
            machineId={selectedMachine.id} 
            onComplete={() => setShowScheduleModal(false)} 
          />
        )}
      </Modal>

      {/* Branch Modal */}
      <Modal isOpen={showBranchModal} onClose={() => setShowBranchModal(false)} title="Создать филиал">
        <AddBranchForm onComplete={() => { setShowBranchModal(false); refreshData(); }} />
      </Modal>

      {/* Units Manager Modal */}
      <UnitsManagerModal 
        isOpen={showUnitsModal} 
        onClose={() => setShowUnitsModal(false)} 
        units={units} 
        onRefresh={refreshData} 
      />

      {/* Part Modal */}
      <Modal isOpen={showPartModal} onClose={() => setShowPartModal(false)} title="Оприходовать запчасть">
        <AddPartForm 
          units={units}
          branches={branches}
          machines={machines}
          onOpenUnitsModal={() => setShowUnitsModal(true)}
          onComplete={() => { setShowPartModal(false); refreshData(); }} 
        />
      </Modal>

      {/* Photo Upload Modal for selectedMachine */}
      {selectedMachine && (
        <PhotoUploadModal 
          isOpen={showPhotoModal} 
          onClose={() => setShowPhotoModal(false)} 
          title={`Фото оборудования: ${selectedMachine.name}`}
          initialImageUrls={getMachineImages(selectedMachine)}
          initialImageUrl={selectedMachine.imageUrl}
          onSave={async (imageUrls, mainImageUrl) => {
            await machineService.updateMachine(selectedMachine.id, { 
              imageUrls, 
              imageUrl: mainImageUrl 
            });
            setSelectedMachine(prev => prev ? { ...prev, imageUrls, imageUrl: mainImageUrl } : null);
          }}
          onDelete={async () => {
            await machineService.updateMachine(selectedMachine.id, { 
              imageUrls: [], 
              imageUrl: '' 
            });
            setSelectedMachine(prev => prev ? { ...prev, imageUrls: [], imageUrl: '' } : null);
          }}
        />
      )}

      {/* Machine Files & Media Modal (папка для видео, фото, документов, схем) */}
      {filesModalMachine && (
        <MachineFilesModal
          isOpen={!!filesModalMachine}
          onClose={() => setFilesModalMachine(null)}
          machine={filesModalMachine}
          role={currentRole}
          currentUser={activeAppUser}
          onMachineUpdated={(updatedMachine) => {
            setFilesModalMachine(updatedMachine);
            if (selectedMachine?.id === updatedMachine.id) {
              setSelectedMachine(updatedMachine);
            }
            setMachines(prev => prev.map(m => m.id === updatedMachine.id ? updatedMachine : m));
          }}
        />
      )}

      {/* Lightbox Modal */}
      <LightboxModal 
        isOpen={!!lightboxState} 
        onClose={() => setLightboxState(null)} 
        images={lightboxState?.images || []} 
        initialIndex={lightboxState?.initialIndex || 0}
        title={lightboxState?.title} 
      />
    </div>
  );
}

function ScheduleList({ machineId, parts, machines, branches, onRefresh, role }: { machineId: string, parts: SparePart[], machines?: Machine[], branches?: Branch[], onRefresh: () => void, role?: Role | null }) {
  const canCreateSchedule = canPerformAction(role, 'maintenance.schedules', 'create');
  const canEditSchedule = canPerformAction(role, 'maintenance.schedules', 'edit');
  const canDeleteSchedule = canPerformAction(role, 'maintenance.schedules', 'delete');

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<MaintenanceSchedule | null>(null);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const s = await machineService.getSchedules(machineId);
      setSchedules(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [machineId]);

  const handleDelete = async (id: string) => {
    try {
      await machineService.deleteSchedule(id);
      setDeletingScheduleId(null);
      loadSchedules();
      onRefresh();
    } catch (e) {
      alert('Ошибка при удалении');
    }
  };

  const handleQuickComplete = async (schedule: MaintenanceSchedule) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const interval = schedule.intervalDays || 30;
    const newNextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    try {
      await machineService.addLog({
        machineId,
        date: dateStr,
        technicianName: schedule.assignedTechnician || 'Дежурный мастер',
        type: (schedule.taskType as LogType) || 'routine',
        taskType: schedule.taskType || 'routine',
        notes: `Выполнено ТО: ${schedule.taskName}`,
        cost: 0,
        partsUsed: [],
        scheduleId: schedule.id,
        nextMaintenanceDate: newNextDue
      });
      await machineService.updateSchedule(schedule.id, {
        lastPerformed: dateStr,
        nextDue: newNextDue
      });
      await machineService.updateMachine(machineId, {
        lastMaintenanceDate: dateStr,
        nextMaintenanceDate: newNextDue,
        status: 'active'
      });
      loadSchedules();
      onRefresh();
    } catch (e) {
      alert('Ошибка при выполнении задачи');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          График регламентных работ (ТОиР)
        </h4>
        {canCreateSchedule && (
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="min-h-10 whitespace-nowrap shrink-0 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all"
          >
            {showAddForm ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddForm ? 'Скрыть форму' : '+ Новая задача'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <AddScheduleForm machineId={machineId} onComplete={() => { setShowAddForm(false); loadSchedules(); onRefresh(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : schedules.length > 0 ? (
        <div className="space-y-2.5">
          {schedules.map(schedule => {
            const cat = getToirCategory(schedule.taskType);
            const deadline = calculateDeadlineInfo(schedule.nextDue);
            return (
              <div 
                key={schedule.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all bg-white gap-3 shadow-xs ${
                  deadline.isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${cat.colorClasses.iconBg}`}>
                    {getToirIcon(schedule.taskType, "w-4 h-4 text-white")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${cat.colorClasses.badgeBorder} ${cat.colorClasses.badgeBg}`}>
                        {cat.badgeLabel}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${deadline.badgeClass}`}>
                        {deadline.label}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-900 leading-tight text-xs sm:text-sm break-words">{schedule.taskName}</h5>
                    {schedule.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{schedule.description}</p>
                    )}
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-2">
                      <span>Каждые {schedule.intervalDays} дн.</span>
                      <span>•</span>
                      <span>Мастер: {schedule.assignedTechnician || 'Дежурный'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Срок</div>
                    <div className={`text-xs font-mono font-bold ${deadline.isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                      {schedule.nextDue ? new Date(schedule.nextDue).toLocaleDateString('ru-RU') : '---'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEditSchedule && (
                      <button 
                        onClick={() => setEditingSchedule(schedule)}
                        className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteSchedule && (
                      deletingScheduleId === schedule.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-200">
                          <button 
                            onClick={() => handleDelete(schedule.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded hover:bg-rose-700"
                          >
                            Да
                          </button>
                          <button 
                            onClick={() => setDeletingScheduleId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingScheduleId(schedule.id)}
                          className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
          <p className="text-xs text-slate-400 italic">Задачи ТОиР для этого оборудования пока не назначены</p>
        </div>
      )}

      {/* Edit modal */}
      {editingSchedule && (
        <EditToirScheduleModal 
          schedule={editingSchedule} 
          isOpen={!!editingSchedule} 
          parts={parts}
          machines={machines}
          branches={branches}
          onClose={() => setEditingSchedule(null)} 
          onUpdated={() => {
            setEditingSchedule(null);
            loadSchedules();
            onRefresh();
          }} 
        />
      )}

      {/* Complete modal */}
      <Modal size="md" isOpen={!!completingTask} onClose={() => setCompletingTask(null)} title="Выполнение регламентных работ">
        {completingTask && (
          <AddLogForm 
            machineId={machineId} 
            parts={parts} 
            machines={machines}
            branches={branches}
            defaultNotes={completingTask.taskName}
            scheduleId={completingTask.id}
            onComplete={() => {
              setCompletingTask(null);
              loadSchedules();
              onRefresh();
            }} 
          />
        )}
      </Modal>
    </section>
  );
}

function EditScheduleForm({ schedule, onComplete }: { schedule: MaintenanceSchedule, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ToirTaskType>(schedule.taskType || 'routine');
  const [formData, setFormData] = useState({
    taskName: schedule.taskName,
    description: schedule.description || '',
    intervalDays: schedule.intervalDays,
    lastPerformed: schedule.lastPerformed,
    assignedTechnician: schedule.assignedTechnician || '',
    priority: schedule.priority || 'medium'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const nextDueDate = new Date(new Date(formData.lastPerformed).getTime() + formData.intervalDays * 24 * 60 * 60 * 1000);
    
    await machineService.updateSchedule(schedule.id, {
      ...formData,
      taskType: selectedType,
      nextDue: nextDueDate.toISOString().split('T')[0]
    });
    
    setLoading(false);
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-slate-900 text-xs">
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Тип задачи ТОиР</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {Object.values(TOIR_CATEGORIES).map(cat => (
            <button
              key={cat.type}
              type="button"
              onClick={() => setSelectedType(cat.type)}
              className={`min-h-10 p-2 rounded-xl border text-center transition-all ${
                selectedType === cat.type ? `${cat.colorClasses.badgeBg} border-2 ${cat.colorClasses.border} font-bold text-slate-900` : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span className="text-[10px]">{cat.shortName}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Название задачи *</label>
        <input required type="text" className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold" value={formData.taskName} onChange={e => setFormData({...formData, taskName: e.target.value})} />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Описание / Регламент</label>
        <textarea rows={2} className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Интервал (дней)</label>
          <input required type="number" min="1" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 text-xs font-mono font-bold" value={formData.intervalDays} onChange={e => setFormData({...formData, intervalDays: Number(e.target.value)})} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Дата прошлого ТО</label>
          <input required type="date" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 text-xs font-mono" value={formData.lastPerformed} onChange={e => setFormData({...formData, lastPerformed: e.target.value})} />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Ответственный мастер</label>
        <input type="text" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 text-xs" value={formData.assignedTechnician} onChange={e => setFormData({...formData, assignedTechnician: e.target.value})} />
      </div>

      <button disabled={loading} type="submit" className="w-full min-h-10 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-md hover:bg-blue-600 transition-all">
        {loading ? 'Обновление...' : 'Обновить задачу'}
      </button>
    </form>
  );
}

function AddScheduleForm({ machineId, onComplete }: { machineId: string, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ToirTaskType>('routine');
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [intervalDays, setIntervalDays] = useState(30);
  const [lastPerformed, setLastPerformed] = useState(new Date().toISOString().split('T')[0]);
  const [assignedTechnician, setAssignedTechnician] = useState('');

  const activeCategory = TOIR_CATEGORIES[selectedType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    setLoading(true);

    const nextDueDate = new Date(new Date(lastPerformed).getTime() + intervalDays * 24 * 60 * 60 * 1000);
    
    await machineService.addSchedule({
      machineId,
      taskName: taskName.trim(),
      taskType: selectedType,
      description: description.trim(),
      intervalDays: Number(intervalDays) || 30,
      lastPerformed,
      nextDue: nextDueDate.toISOString().split('T')[0],
      assignedTechnician: assignedTechnician.trim(),
      priority: 'medium'
    });
    
    // Очищаем все поля после сохранения
    setTaskName('');
    setDescription('');
    setIntervalDays(30);
    setAssignedTechnician('');
    setSelectedType('routine');

    setLoading(false);
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-slate-800">
      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">1. Категория ТОиР</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {Object.values(TOIR_CATEGORIES).map(cat => {
            const isSel = selectedType === cat.type;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => setSelectedType(cat.type)}
                className={`min-h-10 p-2 rounded-xl border text-center transition-all ${
                  isSel ? `${cat.colorClasses.badgeBg} border-2 ${cat.colorClasses.border} font-bold text-slate-900 shadow-xs` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  {getToirIcon(cat.type, "w-3 h-3")}
                  <span className="text-[10px]">{cat.shortName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">2. Шаблоны типовых задач</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {activeCategory.examples.slice(0, 4).map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTaskName(ex)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                taskName === ex ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
              }`}
            >
              + {ex}
            </button>
          ))}
        </div>
        <input 
          required 
          type="text" 
          placeholder="Название задачи по ТОиР..." 
          className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-900" 
          value={taskName} 
          onChange={e => setTaskName(e.target.value)} 
        />
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Описание / Регламентные указания</label>
        <textarea 
          rows={2} 
          placeholder="Технологические требования, смазочные материалы..." 
          className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-xs resize-none" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Интервал (дней)</label>
          <input required type="number" min="1" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold" value={intervalDays} onChange={e => setIntervalDays(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Дата прошлого ТО</label>
          <input required type="date" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 bg-white text-xs font-mono" value={lastPerformed} onChange={e => setLastPerformed(e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Мастер</label>
          <input type="text" placeholder="Инженер" className="w-full min-h-10 p-2 rounded-xl border border-slate-200 bg-white text-xs" value={assignedTechnician} onChange={e => setAssignedTechnician(e.target.value)} />
        </div>
      </div>

      <button disabled={loading} type="submit" className="w-full min-h-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-50">
        {loading ? 'Добавление...' : 'Запланировать задачу ТОиР'}
      </button>
    </form>
  );
}

function LogsList({ machineId, parts, machines, branches, onRefresh, role }: { machineId: string, parts: SparePart[], machines?: Machine[], branches?: Branch[], onRefresh: () => void, role?: Role | null }) {
  const canEditLog = canPerformAction(role, 'maintenance.journal', 'edit');
  const canDeleteLog = canPerformAction(role, 'maintenance.journal', 'delete');

  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<MaintenanceLog | null>(null);
  const [viewImage, setViewImage] = useState<{ url: string; title: string } | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    const l = await machineService.getLogs(machineId);
    setLogs(l);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [machineId]);

  const handleDelete = async (logId: string) => {
    try {
      await machineService.deleteLog(logId);
      setDeletingLogId(null);
      loadLogs();
      onRefresh();
    } catch (e) {
      alert('Ошибка при удалении');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 min-w-0">
          <HistoryIcon className="w-4 h-4 text-indigo-500" />
          История обслуживания
        </h4>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-slate-100 rounded-xl w-full" />
            <div className="h-20 bg-slate-100 rounded-xl w-full" />
          </div>
        ) : logs.length > 0 ? (
          logs.map(log => (
            <div key={log.id} className="p-3 sm:p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex items-start gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className={`p-2 rounded-lg shrink-0 ${log.type === 'repair' ? 'bg-rose-50 text-rose-500' : log.type === 'routine' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                {log.type === 'repair' ? <Wrench className="w-4 h-4" /> : <Hammer className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-start gap-x-2 mb-1">
                  <p className="font-bold text-slate-900">
                    {log.type === 'routine' ? 'Плановое ТО' : log.type === 'repair' ? 'Ремонт' : 'Инспекция'}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <span className="text-xs text-slate-400 font-mono mr-2">{new Date(log.date).toLocaleDateString('ru-RU')}</span>
                    {canEditLog && (
                      <button 
                        onClick={() => setEditingLog(log)}
                        className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                        title="Редактировать запись"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteLog && (
                      deletingLogId === log.id ? (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleDelete(log.id)}
                            className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600"
                          >
                            Да
                          </button>
                          <button 
                            onClick={() => setDeletingLogId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingLogId(log.id)}
                          className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                          title="Удалить запись"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500 mb-2">Мистер {log.technicianName || 'Техник'}</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{log.notes}</p>
                
                {log.imageUrl && (
                  <div className="mt-2.5">
                    <button 
                      type="button" 
                      onClick={() => setViewImage({ url: log.imageUrl!, title: `Фото ТО: ${new Date(log.date).toLocaleDateString('ru-RU')}` })}
                      className="inline-flex items-center gap-2 p-1.5 pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-xs font-bold text-slate-700 shadow-sm group"
                    >
                      <img src={log.imageUrl} alt="Фото работ" className="w-8 h-8 object-cover rounded-lg border border-slate-200 shrink-0" />
                      <span className="flex items-center gap-1 group-hover:text-blue-600">
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        Просмотреть фото
                      </span>
                    </button>
                  </div>
                )}

                {log.cost > 0 && <p className="mt-2 text-xs font-bold text-slate-900">Стоимость: {(log.cost || 0).toLocaleString()} ₽</p>}
                
                {log.partsUsed && log.partsUsed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {log.partsUsed.map((p, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200">
                        {p.name} (x{p.quantity})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400 font-medium">Записей пока нет</p>
          </div>
        )}
      </div>

      <LightboxModal 
        isOpen={!!viewImage} 
        onClose={() => setViewImage(null)} 
        imageUrl={viewImage?.url || ''} 
        title={viewImage?.title} 
      />

      <Modal isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Редактировать запись обслуживания">
        {editingLog && (
          <EditLogForm 
            log={editingLog} 
            parts={parts}
            machines={machines}
            branches={branches}
            onComplete={() => { setEditingLog(null); loadLogs(); onRefresh(); }} 
          />
        )}
      </Modal>
    </section>
  );
}

/** Tracks the element's real pixel size, so charts can be given concrete numeric
 * width/height instead of percentages - Recharts' ResponsiveContainer always starts
 * from an internal -1/-1 state when sized by percentage (even once its parent already
 * has a real size), which is what produces the "-1" console warning. Feeding it real
 * numbers instead bypasses that internal auto-measurement pass entirely. */
function useMeasuredSize<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function DepreciationChart({ machine }: { machine: Machine }) {
  const data = machineService.getDepreciationData(machine);
  const [containerRef, size] = useMeasuredSize<HTMLDivElement>();
  const ready = size.width > 0 && size.height > 0;

  if (data.length === 0 || machine.purchasePrice <= 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 gap-2">
        <AlertCircle className="w-8 h-8 opacity-20" />
        <p className="text-xs font-medium">Нет данных для расчета амортизации</p>
        <p className="text-[10px] opacity-60">Укажите цену и дату закупки в данных оборудования</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[250px] w-full">
      {ready && (
      <ResponsiveContainer width={size.width} height={size.height} debounce={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="year" 
            axisLine={false} 
            tickLine={false} 
            tick={{fontSize: 10, fill: '#94a3b8'}}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{fontSize: 10, fill: '#94a3b8'}}
            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(val: number) => [`${val.toLocaleString()} ₽`, 'Стоимость']}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}

function TotalDepreciationChart({ machines }: { machines: Machine[] }) {
  const data = machineService.getTotalDepreciationData(machines);
  const [containerRef, size] = useMeasuredSize<HTMLDivElement>();
  const ready = size.width > 0 && size.height > 0;

  if (data.length === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 gap-2">
        <BarChart3 className="w-8 h-8 opacity-20" />
        <p className="text-xs font-medium">Нет данных для амортизационного отчета</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[300px] w-full">
      {ready && (
      <ResponsiveContainer width={size.width} height={size.height} debounce={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotalValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="year" 
            axisLine={false} 
            tickLine={false} 
            tick={{fontSize: 10, fill: '#94a3b8'}}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{fontSize: 10, fill: '#94a3b8'}}
            tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(val: number) => [`${val.toLocaleString()} ₽`, 'Общая стоимость']}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTotalValue)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}

function Modal({ isOpen, onClose, title, children, size = 'xl' }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' }) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden`}
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 text-slate-900">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight min-w-0 break-words">{title}</h3>
              <button onClick={onClose} className="p-2.5 shrink-0 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function getMachineImages(machine?: Machine | null): string[] {
  if (!machine) return [];
  const list: string[] = [];
  if (machine.imageUrl && typeof machine.imageUrl === 'string' && machine.imageUrl.trim()) {
    list.push(machine.imageUrl.trim());
  }
  if (machine.imageUrls && Array.isArray(machine.imageUrls)) {
    machine.imageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.trim() && !list.includes(url.trim())) {
        list.push(url.trim());
      }
    });
  }
  if (machine.attachments && Array.isArray(machine.attachments)) {
    machine.attachments.forEach(att => {
      if (att && att.type === 'image' && att.url && typeof att.url === 'string' && att.url.trim() && !list.includes(att.url.trim())) {
        list.push(att.url.trim());
      }
    });
  }
  return list;
}

function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function getLogImages(log?: MaintenanceLog | null): string[] {
  if (!log) return [];
  if (log.imageUrls && Array.isArray(log.imageUrls) && log.imageUrls.length > 0) {
    return log.imageUrls;
  }
  if (log.imageUrl) {
    return [log.imageUrl];
  }
  return [];
}

function MultiPhotoPicker({
  images = [],
  onChange,
  maxPhotos = 10,
  label = "Фотографии оборудования",
  compact = false
}: {
  images?: string[];
  onChange: (images: string[]) => void;
  maxPhotos?: number;
  label?: string;
  compact?: boolean;
}) {
  const safeImages = Array.isArray(images) ? images : [];
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        validFiles.push(files[i]);
      }
    }
    if (validFiles.length === 0) {
      setError('Выберите файлы изображений (JPG, PNG, WebP)');
      return;
    }
    setLoading(true);
    try {
      const compressedList: string[] = [];
      for (const file of validFiles) {
        const comp = await compressImage(file, 1200, 1200, 0.82);
        compressedList.push(comp);
      }
      const updated = [...safeImages, ...compressedList].slice(0, maxPhotos);
      onChange(updated);
    } catch (err) {
      console.error(err);
      setError('Ошибка при сжатии и обработке изображений');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    const updated = safeImages.filter((_, i) => i !== index);
    onChange(updated);
  };

  const makeMainPhoto = (index: number) => {
    if (index === 0) return;
    const target = safeImages[index];
    const rest = safeImages.filter((_, i) => i !== index);
    onChange([target, ...rest]);
  };

  return (
    <div className={compact ? "space-y-1.5 text-slate-900" : "space-y-3 text-slate-900"}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label className={compact ? "text-[9px] font-black uppercase tracking-wider text-slate-400 block px-0.5 min-w-0 break-words" : "text-xs font-bold uppercase tracking-wider text-slate-400 block min-w-0 break-words"}>{label}</label>
        <span className={compact ? "text-[9px] font-bold text-slate-400 font-mono whitespace-nowrap shrink-0 ml-auto" : "text-[11px] font-semibold text-slate-400 whitespace-nowrap shrink-0 ml-auto"}>{safeImages.length} из {maxPhotos} фото</span>
      </div>

      {error && (
        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-rose-100">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid of uploaded images */}
      {safeImages.length > 0 && (
        <div className={compact ? "grid grid-cols-4 sm:grid-cols-5 gap-1.5" : "grid grid-cols-3 sm:grid-cols-4 gap-3"}>
          {safeImages.map((url, idx) => (
            <div key={idx} className={`relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-900 shadow-xs ${compact ? 'rounded-lg' : 'rounded-xl'}`}>
              <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" />
              {idx === 0 && (
                <span className={`absolute top-1 left-1 bg-blue-600 text-white font-bold uppercase rounded shadow-xs ${compact ? 'px-1 py-0.2 text-[7px]' : 'px-2 py-0.5 text-[9px]'}`}>
                  Обложка
                </span>
              )}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-0.5 backdrop-blur-[1px]">
                {idx > 0 && (
                  <button 
                    type="button" 
                    onClick={() => makeMainPhoto(idx)}
                    title="Сделать главным фото"
                    className="p-1 bg-white/90 hover:bg-white text-slate-800 rounded shadow-xs transition-all"
                  >
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => removePhoto(idx)}
                  title="Удалить фото"
                  className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {safeImages.length < maxPhotos && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center aspect-square text-slate-400 hover:text-blue-600 transition-all group ${compact ? 'rounded-lg border' : 'rounded-xl border-2'}`}
            >
              <Plus className={compact ? "w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" : "w-6 h-6 mb-1 group-hover:scale-110 transition-transform"} />
              <span className={compact ? "text-[8px] font-bold uppercase" : "text-[10px] font-bold uppercase"}>Фото</span>
            </button>
          )}
        </div>
      )}

      {/* File input / Dropzone if 0 images */}
      {safeImages.length === 0 && (
        compact ? (
          <div 
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
            className={`rounded-xl border border-dashed transition-all p-2 flex items-center justify-between gap-2 ${
              dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-700 truncate">Прикрепить фото работ</p>
                <p className="text-[8px] text-slate-400">до {maxPhotos} шт (JPG, PNG)</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shadow-xs transition-all shrink-0 active:scale-95"
            >
              {loading ? '...' : '+ Выбрать'}
            </button>
          </div>
        ) : (
          <div 
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
            className={`rounded-2xl border-2 border-dashed transition-all p-5 text-center flex flex-col items-center justify-center min-h-[160px] ${
              dragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center mb-2 shadow-inner">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">Загрузите фото (можно выбрать сразу несколько)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">поддерживаются JPG, PNG, WebP</p>
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              {loading ? 'Обработка...' : 'Выбрать файлы'}
            </button>
          </div>
        )
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        multiple 
        className="hidden" 
        onChange={e => e.target.files && handleFiles(e.target.files)} 
      />
    </div>
  );
}

function PhotoUploadModal({ 
  isOpen, 
  onClose, 
  title = "Добавить фото оборудования", 
  initialImageUrls,
  initialImageUrl, 
  onSave, 
  onDelete 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title?: string; 
  initialImageUrls?: string[];
  initialImageUrl?: string; 
  onSave: (imageUrls: string[], mainImageUrl: string) => Promise<void> | void; 
  onDelete?: () => Promise<void> | void; 
}) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialImageUrls && initialImageUrls.length > 0) {
      setImages(initialImageUrls);
    } else if (initialImageUrl) {
      setImages([initialImageUrl]);
    } else {
      setImages([]);
    }
    setError(null);
  }, [initialImageUrls, initialImageUrl, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave(images, images[0] || '');
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      setLoading(true);
      try {
        await onDelete();
        setImages([]);
        onClose();
      } catch (err) {
        console.error(err);
        setError('Ошибка при удалении');
      } finally {
        setLoading(false);
      }
    } else {
      setImages([]);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-5 text-slate-900">
        {error && (
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold border border-rose-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <MultiPhotoPicker 
          images={images} 
          onChange={setImages} 
          maxPhotos={10} 
          label="Загруженные фото" 
        />

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            {(initialImageUrls?.length || initialImageUrl) && onDelete && (
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={loading}
                className="px-3.5 py-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить все фото
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Отмена
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              disabled={loading}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-100 flex items-center gap-2 ${
                loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function LightboxModal({ 
  isOpen, 
  onClose, 
  images = [], 
  imageUrl = "", 
  initialIndex = 0, 
  title 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  images?: string[]; 
  imageUrl?: string; 
  initialIndex?: number; 
  title?: string; 
}) {
  const allImages = images.length > 0 ? images : imageUrl ? [imageUrl] : [];
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight') {
        setIndex(prev => (prev + 1) % allImages.length);
      } else if (e.key === 'ArrowLeft') {
        setIndex(prev => (prev - 1 + allImages.length) % allImages.length);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allImages.length, onClose]);

  if (!isOpen || allImages.length === 0) return null;

  const currentImg = allImages[index] || allImages[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          onClick={e => e.stopPropagation()}
          className="relative max-w-5xl w-full max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white bg-slate-950/80">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="w-4 h-4 text-blue-400 shrink-0" />
              <h4 className="font-bold text-sm truncate">{title || 'Просмотр фотографий'}</h4>
              {allImages.length > 1 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
                  {index + 1} / {allImages.length}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image & Controls view */}
          <div className="relative flex-1 p-4 flex items-center justify-center bg-black/50 min-h-[350px] overflow-hidden select-none">
            {allImages.length > 1 && (
              <button 
                type="button" 
                onClick={() => setIndex((index - 1 + allImages.length) % allImages.length)}
                className="absolute left-4 z-10 p-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md transition-all active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img 
              key={index}
              src={currentImg} 
              alt="" 
              className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all" 
            />

            {allImages.length > 1 && (
              <button 
                type="button" 
                onClick={() => setIndex((index + 1) % allImages.length)}
                className="absolute right-4 z-10 p-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md transition-all active:scale-90"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Thumbnail strip at bottom */}
          {allImages.length > 1 && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto custom-scrollbar">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    i === index ? 'border-blue-500 scale-105 shadow-md' : 'border-slate-800 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function MachineDetailPhotoGallery({ 
  machine, 
  onOpenManage, 
  onOpenLightbox,
  onOpenFiles,
  canManagePhoto = true
}: { 
  machine: Machine; 
  onOpenManage: () => void; 
  onOpenLightbox: (index: number) => void; 
  onOpenFiles?: () => void;
  canManagePhoto?: boolean;
}) {
  const rawImages = getMachineImages(machine);
  const [activeIdx, setActiveIdx] = useState(0);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveIdx(0);
  }, [machine.id]);

  // Attachment download links need an auth header a plain <img> can't send - resolve
  // to blob URLs so the banner/thumbnails don't render as broken/black images.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const entries: Record<string, string> = {};
      for (const url of rawImages) {
        if (resolved[url]) continue;
        try {
          const r = await machineService.resolveImageUrl(url);
          if (r) entries[url] = r;
        } catch (e) {
          console.error('Error resolving machine image URL:', e);
        }
      }
      if (isMounted && Object.keys(entries).length > 0) {
        setResolved(prev => ({ ...prev, ...entries }));
      }
    })();
    return () => { isMounted = false; };
  }, [machine.id, rawImages.join('|')]);

  const images = rawImages.map(u => resolved[u] || u);

  if (images.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 shadow-inner">
          <FolderOpen className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">Материалы и фото оборудования</p>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">Загрузите видео работы, фото узлов, паспорта, инструкции или схемы</p>
        <div className="flex items-center gap-2">
          {onOpenFiles && (
            <button 
              onClick={onOpenFiles}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-100 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Папка файлов
            </button>
          )}
          {canManagePhoto && (
            <button 
              onClick={onOpenManage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              Добавить фото
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentImage = images[activeIdx] || images[0];

  return (
    <div className="space-y-3">
      {/* Main Banner */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-200 overflow-hidden shadow-md group">
        <div className="relative h-56 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
          <img 
            src={currentImage} 
            alt={machine.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
          
          {/* Navigation Arrows if > 1 image */}
          {images.length > 1 && (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(prev => (prev - 1 + images.length) % images.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md transition-all shadow-md active:scale-90 opacity-80 hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(prev => (prev + 1) % images.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md transition-all shadow-md active:scale-90 opacity-80 hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Badge & Buttons Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onOpenLightbox(activeIdx)}
                className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold shadow-lg backdrop-blur-sm transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                Увеличить
              </button>
              {images.length > 1 && (
                <span className="px-2.5 py-1 bg-slate-900/80 text-white rounded-xl font-mono text-[11px] font-bold backdrop-blur-sm border border-white/10">
                  {activeIdx + 1} / {images.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {canManagePhoto && (
                <button 
                  onClick={onOpenManage}
                  className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg backdrop-blur-sm transition-all flex items-center gap-1.5 border border-white/10 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Фото ({images.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnails Row if > 1 image */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto p-1 custom-scrollbar">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                i === activeIdx ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105 shadow-sm' : 'border-slate-200 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          <button
            onClick={onOpenManage}
            className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex flex-col items-center justify-center transition-all shrink-0"
            title="Добавить ещё фото"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// <input type="date"> needs YYYY-MM-DD; the API returns full ISO timestamps.
// Uses local date parts so the value matches what the detail view displays.
function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function EditMachineForm({ machine, branches, onComplete }: { machine: Machine, branches: Branch[], onComplete: (data: Partial<Machine>) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: machine.name,
    manufacturer: machine.manufacturer || '',
    model: machine.model,
    serialNumber: machine.serialNumber,
    branchId: machine.branchId || '',
    purchasePrice: machine.purchasePrice || 0,
    purchaseDate: toDateInputValue(machine.purchaseDate),
    usefulLifeYears: machine.usefulLifeYears || 10,
    status: machine.status,
    installationDate: toDateInputValue(machine.installationDate),
    lastMaintenanceDate: machine.lastMaintenanceDate || new Date().toISOString().split('T')[0],
    nextMaintenanceDate: machine.nextMaintenanceDate || new Date().toISOString().split('T')[0],
    description: machine.description || '',
    imageUrl: machine.imageUrl || '',
    imageUrls: machine.imageUrls && machine.imageUrls.length > 0 ? machine.imageUrls : machine.imageUrl ? [machine.imageUrl] : [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branchId) {
      setError('Пожалуйста, выберите филиал');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await machineService.updateMachine(machine.id, formData);
      onComplete(formData);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-slate-900">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Наименование</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Филиал</label>
          <select 
            required
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.branchId}
            onChange={e => setFormData({...formData, branchId: e.target.value})}
          >
            <option value="">Выберите филиал</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Статус</label>
          <select 
            required
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value as MachineStatus})}
          >
            <option value="active">Активен</option>
            <option value="maintenance">Обслуживание</option>
            <option value="repair">В ремонте</option>
            <option value="retired">Списан</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Производитель / Бренд</label>
          <input 
            type="text" 
            placeholder="Например: Haas, Trumpf, DMG MORI..."
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.manufacturer}
            onChange={e => setFormData({...formData, manufacturer: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Модель</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.model}
            onChange={e => setFormData({...formData, model: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Серийный номер</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.serialNumber}
            onChange={e => setFormData({...formData, serialNumber: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Цена закупки (₽)</label>
          <input 
            type="number" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.purchasePrice}
            onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Дата закупки</label>
          <input
            type="date"
            lang="ru"
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.purchaseDate}
            onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Дата установки</label>
          <input
            type="date"
            lang="ru"
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.installationDate}
            onChange={e => setFormData({...formData, installationDate: e.target.value})}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Описание</label>
          <textarea
            className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            rows={3}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>
        <div className="sm:col-span-2">
          <MultiPhotoPicker 
            images={formData.imageUrls} 
            onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
            maxPhotos={10} 
            label="Фотографии оборудования" 
          />
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-5 text-white rounded-xl font-bold transition-all shadow-lg ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 sm:hover:scale-[1.01]'}`}
      >
        {loading ? 'Сохранение...' : 'Обновить данные оборудования'}
      </button>
    </form>
  );
}

function AddMachineForm({ branches, onComplete }: { branches: Branch[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    branchId: '',
    purchasePrice: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    usefulLifeYears: 10,
    status: 'active' as MachineStatus,
    installationDate: new Date().toISOString().split('T')[0],
    lastMaintenanceDate: new Date().toISOString().split('T')[0],
    nextMaintenanceDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: '',
    imageUrl: '',
    imageUrls: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branchId) {
      alert('Пожалуйста, выберите филиал');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await machineService.addMachine(formData);
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-slate-900">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Наименование</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            placeholder="Токарный станок CNC..."
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Производитель / Бренд</label>
          <input 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            placeholder="Например: Haas, Trumpf, DMG MORI..."
            value={formData.manufacturer}
            onChange={e => setFormData({...formData, manufacturer: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Филиал</label>
          <select 
            required
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.branchId}
            onChange={e => setFormData({...formData, branchId: e.target.value})}
          >
            <option value="">Выберите филиал</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Модель</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.model}
            onChange={e => setFormData({...formData, model: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Серийный номер</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.serialNumber}
            onChange={e => setFormData({...formData, serialNumber: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Цена закупки (₽)</label>
          <input 
            type="number" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.purchasePrice}
            onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Дата закупки</label>
          <input
            type="date"
            lang="ru"
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.purchaseDate}
            onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Срок службы (лет)</label>
          <input 
            type="number" 
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.usefulLifeYears}
            onChange={e => setFormData({...formData, usefulLifeYears: Number(e.target.value)})}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Дата установки</label>
          <input
            type="date"
            lang="ru"
            className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.installationDate}
            onChange={e => setFormData({...formData, installationDate: e.target.value})}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Описание/Заметки</label>
          <textarea 
            rows={3}
            className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>
        <div className="sm:col-span-2">
          <MultiPhotoPicker 
            images={formData.imageUrls} 
            onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
            maxPhotos={10} 
            label="Фотографии оборудования" 
          />
        </div>
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-5 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-100 active:scale-[0.98] ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Сохранение...' : 'Сохранить оборудование'}
      </button>
    </form>
  );
}

function AddLogForm({ machineId: initialMachineId, parts, onComplete, defaultNotes, scheduleId, machines, branches }: { machineId?: string, parts: SparePart[], onComplete: () => void, defaultNotes?: string, scheduleId?: string, machines?: Machine[], branches?: Branch[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [formData, setFormData] = useState({
    machineId: initialMachineId || '',
    date: new Date().toISOString().split('T')[0],
    technicianName: '',
    type: 'routine' as LogType,
    notes: defaultNotes || '',
    cost: 0,
    partsUsed: [] as { partId: string, quantity: number, name: string }[],
    nextMaintenanceDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    imageUrl: '',
    imageUrls: [] as string[],
  });

  const [lastLog, setLastLog] = useState<MaintenanceLog | null>(null);
  const [selectedPart, setSelectedPart] = useState('');
  const [partQty, setPartQty] = useState<number | string>(1);
  const [showAllWarehouseParts, setShowAllWarehouseParts] = useState(false);

  const selectedPartObj = useMemo(() => {
    return parts.find(p => p.id === selectedPart);
  }, [parts, selectedPart]);

  const recommendedParts = useMemo(() => {
    const currentMachine = machines?.find(m => m.id === formData.machineId);
    const targetBranchId = currentMachine?.branchId || selectedBranchId;
    if (!formData.machineId && !targetBranchId) return [];

    return parts.filter(p => {
      const isForMachine = Boolean(p.machineId && formData.machineId && p.machineId === formData.machineId);
      const isForBranch = Boolean(p.branchId && targetBranchId && p.branchId === targetBranchId && (!p.machineId || p.machineId === formData.machineId));
      return isForMachine || isForBranch;
    }).sort((a, b) => {
      const aIsMachine = a.machineId === formData.machineId ? 1 : 0;
      const bIsMachine = b.machineId === formData.machineId ? 1 : 0;
      if (bIsMachine !== aIsMachine) return bIsMachine - aIsMachine;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [parts, formData.machineId, selectedBranchId, machines]);

  const relevantParts = useMemo(() => {
    if (showAllWarehouseParts) {
      return [...parts].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return recommendedParts;
  }, [showAllWarehouseParts, parts, recommendedParts]);

  useEffect(() => {
    let active = true;
    const fetchLastLog = async () => {
      if (!formData.machineId) {
        setLastLog(null);
        return;
      }
      try {
        const logs = await machineService.getLogs(formData.machineId);
        if (active) {
          if (logs && logs.length > 0) {
            const last = logs[0];
            setLastLog(last);
            const recommendedNext = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            setFormData(prev => ({
              ...prev,
              type: last.type || 'routine',
              partsUsed: last.partsUsed || [],
              nextMaintenanceDate: last.nextMaintenanceDate || recommendedNext
            }));
          } else {
            setLastLog(null);
          }
        }
      } catch (err) {
        console.error("Error fetching last log:", err);
      }
    };
    fetchLastLog();
    return () => { active = false; };
  }, [formData.machineId]);

  useEffect(() => {
    if (!scheduleId || !formData.machineId) return;
    let active = true;
    const fetchScheduleDetails = async () => {
      try {
        const schedules = await machineService.getSchedules(formData.machineId);
        const sched = schedules.find(s => s.id === scheduleId);
        if (active && sched) {
          const nextDue = new Date(new Date(formData.date).getTime() + sched.intervalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          setFormData(prev => ({
            ...prev,
            technicianName: prev.technicianName || sched.assignedTechnician || '',
            cost: prev.cost || sched.laborCost || 0,
            partsUsed: prev.partsUsed.length === 0 && sched.partsUsed ? sched.partsUsed : prev.partsUsed,
            imageUrls: (prev.imageUrls && prev.imageUrls.length > 0) ? prev.imageUrls : (sched.imageUrls || (sched.imageUrl ? [sched.imageUrl] : [])),
            nextMaintenanceDate: nextDue
          }));
        }
      } catch (err) {
        console.error("Error fetching schedule:", err);
      }
    };
    fetchScheduleDetails();
    return () => { active = false; };
  }, [scheduleId, formData.machineId, formData.date]);

  const filteredMachines = machines?.filter(m => {
    const matchesBranch = !selectedBranchId || m.branchId === selectedBranchId;
    return matchesBranch;
  });

  const addPart = () => {
    if (!selectedPart) return;
    const part = parts.find(p => p.id === selectedPart);
    if (!part) return;

    const parsed = parseFloat(String(partQty).replace(',', '.'));
    const qtyToAdd = Math.round((Number.isFinite(parsed) ? parsed : 0) * 1000) / 1000;
    
    if (qtyToAdd <= 0) {
      alert('Укажите количество больше 0 (например, 0.3, 0.5, 1)');
      return;
    }

    const existingIndex = formData.partsUsed.findIndex(p => p.partId === selectedPart);
    if (existingIndex >= 0) {
      const current = formData.partsUsed[existingIndex].quantity || 0;
      const totalDesired = Math.round((current + qtyToAdd) * 1000) / 1000;
      if (totalDesired > part.quantity) {
        alert(`Недостаточно на складе! В наличии всего ${part.quantity} ${part.unit || 'ед.'}, а запрошено ${totalDesired} ${part.unit || 'ед.'}`);
        return;
      }
      const updated = [...formData.partsUsed];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: totalDesired
      };
      setFormData({
        ...formData,
        partsUsed: updated
      });
    } else {
      if (qtyToAdd > part.quantity) {
        alert(`Недостаточно на складе! В наличии всего ${part.quantity} ${part.unit || 'ед.'}, а запрошено ${qtyToAdd} ${part.unit || 'ед.'}`);
        return;
      }
      setFormData({
        ...formData,
        partsUsed: [...formData.partsUsed, { partId: part.id, quantity: qtyToAdd, name: part.name }]
      });
    }
    
    setSelectedPart('');
    setPartQty(1);
  };

  const partsCostSum = Math.round(formData.partsUsed.reduce((acc, p) => {
    const matchedPart = parts.find(spare => spare.id === p.partId);
    return acc + (matchedPart ? (matchedPart.unitPrice || 0) * p.quantity : 0);
  }, 0) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machineId) {
       setError('Пожалуйста, выберите оборудование');
       return;
    }
    setLoading(true);
    setError(null);
    try {
      await machineService.addLog({
        ...formData,
        scheduleId: scheduleId || '',
        cost: formData.cost > 0 ? formData.cost : partsCostSum
      });
      
      // If this corresponds to a schedule, update it
      if (scheduleId) {
        const schedules = await machineService.getSchedules(formData.machineId);
         const schedule = schedules.find(s => s.id === scheduleId);
        if (schedule) {
          const nextDue = new Date(new Date(formData.date).getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          await machineService.updateSchedule(scheduleId, { nextDue });
        }
      }

      await machineService.updateMachine(formData.machineId, { 
        lastMaintenanceDate: formData.date,
        nextMaintenanceDate: formData.nextMaintenanceDate
      });

      // Очищаем все поля формы
      setFormData({
        machineId: initialMachineId || '',
        date: new Date().toISOString().split('T')[0],
        technicianName: '',
        type: 'routine',
        notes: defaultNotes || '',
        cost: 0,
        partsUsed: [],
        nextMaintenanceDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        imageUrl: '',
        imageUrls: [],
      });
      setSelectedPart('');
      setPartQty(1);
      setShowAllWarehouseParts(false);

      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-slate-900 text-[11px]">
      {error && (
        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] border border-rose-100 font-bold">
          {error}
        </div>
      )}
      
      {!initialMachineId && machines && (
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 px-0.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Оборудование</label>
            {filteredMachines && <span className="text-[9px] font-bold text-slate-400">Доступно: {filteredMachines.length}</span>}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <select 
              className="min-h-10 w-full px-2 py-1 bg-white rounded-lg border border-slate-200 text-[11px] font-medium h-7 focus:ring-1 focus:ring-blue-500 outline-none"
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
            >
              <option value="">Все филиалы</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <select 
              required
              className="min-h-10 w-full px-2 py-1 bg-white rounded-lg border border-slate-200 text-[11px] font-bold text-slate-800 shadow-xs h-7 focus:ring-1 focus:ring-blue-500 outline-none"
              value={formData.machineId}
              onChange={e => setFormData({...formData, machineId: e.target.value})}
            >
              <option value="">-- Выберите станок --</option>
              {filteredMachines?.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.model || 'SN:' + m.serialNumber})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Параметры ТО: тип, дата, след. ТО */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
        <div className="font-bold text-blue-700 flex items-center gap-1.5 uppercase tracking-wider text-[9px]">
          <span className="w-1.5 h-1.5 rounded-full inline-block bg-blue-500 animate-pulse"></span>
          Параметры выполнения ТО
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400 block text-[8px] uppercase tracking-wider mb-0.5 font-bold">Категория ТОиР</span>
            <select 
              className="min-h-10 w-full px-2 py-1 bg-white rounded-lg border border-slate-200 text-[11px] font-bold h-7 focus:ring-1 focus:ring-blue-500 outline-none"
              value={formData.type}
              onChange={e => {
                const val = e.target.value as LogType;
                setFormData({...formData, type: val});
              }}
            >
              <option value="routine">🔧 Регламентные (ЕО и ТО)</option>
              <option value="diagnostic">📊 Диагностика / Замеры</option>
              <option value="ppr">🛡️ ППР (Предупредительный)</option>
              <option value="emergency">⚡ Внеплановый / Аварийный</option>
              <option value="inspection">🔍 Инспекция / Осмотр</option>
              <option value="repair">🩹 Текущий ремонт</option>
            </select>
          </div>

          <div>
            <span className="text-slate-400 block text-[8px] uppercase tracking-wider mb-0.5 font-bold">Дата проведения</span>
            <input 
              type="date" 
              className="min-h-10 w-full px-2 py-1 bg-white rounded-lg border border-slate-200 text-[11px] font-bold h-7 focus:ring-1 focus:ring-blue-500 outline-none"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div className="col-span-2 bg-indigo-50/60 border border-indigo-100 rounded-lg p-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-indigo-600 text-[9px] uppercase tracking-wider font-bold shrink-0">След. ТО:</span>
            <input 
              type="date" 
              className="min-h-10 px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-[11px] font-bold h-6 text-indigo-900 focus:ring-1 focus:ring-indigo-500 outline-none flex-1 max-w-[180px]"
              value={formData.nextMaintenanceDate}
              onChange={e => setFormData({...formData, nextMaintenanceDate: e.target.value})}
            />
          </div>
        </div>

        {/* Задействованные запчасти */}
        <div className="pt-1.5 border-t border-slate-200/60 space-y-1.5">
          <span className="text-slate-400 block text-[8px] uppercase tracking-wider font-bold">Запчасти со склада</span>
          
          <div className="flex gap-1.5">
            <select 
              className="min-h-10 flex-1 px-2 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-medium h-7 focus:ring-1 focus:ring-blue-500 outline-none"
              value={selectedPart}
              onChange={e => setSelectedPart(e.target.value)}
            >
              <option value="">
                {relevantParts.length === 0 
                  ? (!formData.machineId 
                      ? 'Сначала выберите станок' 
                      : 'Нет рекомендованных запчастей') 
                  : showAllWarehouseParts
                    ? `Выбрать деталь (${relevantParts.length} со склада)...`
                    : `Выбрать деталь (${relevantParts.length} рекомендовано)...`}
              </option>
              {relevantParts.map(p => {
                const currentMachine = machines?.find(m => m.id === formData.machineId);
                const targetBranchId = currentMachine?.branchId || selectedBranchId;
                const isForMachine = Boolean(formData.machineId && p.machineId === formData.machineId);
                const isForBranch = Boolean(p.branchId && targetBranchId && p.branchId === targetBranchId && !p.machineId);
                const prefix = isForMachine ? '[🎯 Станок] ' : isForBranch ? '[🏢 Филиал] ' : '[📦 Склад] ';
                return (
                  <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                    {prefix}{p.name} ({p.quantity} {p.unit || 'шт'}){p.quantity <= 0 ? ' — нет на складе' : ''}
                  </option>
                );
              })}
            </select>
            <div className="relative flex items-center">
              <input 
                type="number" 
                step="any"
                min="0.001" 
                placeholder="Кол-во"
                className="min-h-10 w-16 px-1.5 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-bold h-7 text-center focus:ring-1 focus:ring-blue-500 outline-none"
                value={partQty}
                onChange={e => setPartQty(e.target.value)}
                title="Можно вводить дробное количество (например: 0.3, 0.5, 0.7)"
              />
            </div>
            <button 
              type="button" 
              onClick={addPart}
              disabled={!selectedPart}
              className="px-2.5 bg-slate-900 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-slate-900 text-white rounded-lg transition-colors h-7 flex items-center justify-center shrink-0 text-[10px] font-bold active:scale-95"
            >
              +
            </button>
          </div>

          {selectedPart && selectedPartObj && (
            <div className="flex flex-wrap items-center gap-1 p-1.5 bg-blue-50/80 border border-blue-200/70 rounded-md text-[9px] text-blue-900">
              <span className="font-semibold text-blue-800">Быстрый расход:</span>
              {[0.1, 0.2, 0.25, 0.3, 0.5, 0.7, 1].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPartQty(String(preset))}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                    Number(partQty) === preset 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white border-blue-200 hover:bg-blue-100 text-blue-900'
                  }`}
                >
                  {preset} {selectedPartObj.unit || ''}
                </button>
              ))}
              <span className="ml-auto text-blue-700">Остаток: <b>{selectedPartObj.quantity} {selectedPartObj.unit || 'ед.'}</b></span>
            </div>
          )}

          {parts.length > 0 && (
            <div className="flex items-center justify-between text-[9px] pt-0.5 px-0.5 text-slate-500">
              <span>
                {showAllWarehouseParts 
                  ? `Все со склада (${parts.length})` 
                  : `Только рекомендованные (${recommendedParts.length})`}
              </span>
              {parts.length > recommendedParts.length && (
                <button
                  type="button"
                  onClick={() => setShowAllWarehouseParts(!showAllWarehouseParts)}
                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                >
                  {showAllWarehouseParts ? 'Только рекомендованные' : `Показать все со склада (+${parts.length - recommendedParts.length})`}
                </button>
              )}
            </div>
          )}

          {formData.partsUsed.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {formData.partsUsed.map((p, idx) => (
                <div key={idx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                  <span>⚙️ {p.name} × {p.quantity}</span>
                  <button 
                    type="button" 
                    onClick={() => setFormData({
                      ...formData,
                      partsUsed: formData.partsUsed.filter((_, i) => i !== idx)
                    })}
                    className="text-rose-500 hover:text-rose-700 font-bold ml-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                Итого: {partsCostSum.toLocaleString()} ₽
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={initialMachineId ? "col-span-1" : "col-span-1"}>
          <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Исполнитель / Мастер</label>
          <input required type="text" className="min-h-10 w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none" placeholder="ФИО исполнителя" value={formData.technicianName} onChange={e => setFormData({...formData, technicianName: e.target.value})} />
        </div>
        <div className="col-span-1">
          <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Стоимость работ (₽)</label>
          <input type="number" className="min-h-10 w-full px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0 ₽" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Заметки / Описание работ</label>
        <textarea 
          rows={2}
          className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500 text-[11px] font-medium min-h-[40px] max-h-[70px] resize-y bg-white"
          placeholder="Опишите выполненные регламентные или ремонтные работы..."
          value={formData.notes}
          onChange={e => setFormData({...formData, notes: e.target.value})}
        />
      </div>

      <div>
        <MultiPhotoPicker 
          images={formData.imageUrls} 
          onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
          maxPhotos={5} 
          label="Фото проведенных работ" 
          compact={true}
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-2 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-blue-100 active:scale-[0.99] ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Сохранение...' : 'Записать ТО'}
      </button>
    </form>
  );
}

function EditLogForm({ log, parts, machines, branches, onComplete }: { log: MaintenanceLog, parts: SparePart[], machines?: Machine[], branches?: Branch[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState(log.nextMaintenanceDate || '');
  const [formData, setFormData] = useState({
    date: (log.date || new Date().toISOString()).split('T')[0],
    type: log.type || 'routine',
    notes: log.notes || '',
    cost: log.cost || 0,
    partsUsed: log.partsUsed || [],
    imageUrl: log.imageUrl || '',
    imageUrls: log.imageUrls && log.imageUrls.length > 0 ? log.imageUrls : log.imageUrl ? [log.imageUrl] : []
  });

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(log.scheduleId || '');
  const [selectedPart, setSelectedPart] = useState('');
  const [partQty, setPartQty] = useState<number | string>(1);
  const [showAllWarehouseParts, setShowAllWarehouseParts] = useState(false);

  const selectedPartObj = useMemo(() => {
    return parts.find(p => p.id === selectedPart);
  }, [parts, selectedPart]);

  const recommendedParts = useMemo(() => {
    const currentMachine = machines?.find(m => m.id === log.machineId);
    const targetBranchId = currentMachine?.branchId;
    if (!log.machineId && !targetBranchId) return [];

    return parts.filter(p => {
      const isForMachine = Boolean(p.machineId && log.machineId && p.machineId === log.machineId);
      const isForBranch = Boolean(p.branchId && targetBranchId && p.branchId === targetBranchId && (!p.machineId || p.machineId === log.machineId));
      return isForMachine || isForBranch;
    }).sort((a, b) => {
      const aIsMachine = a.machineId === log.machineId ? 1 : 0;
      const bIsMachine = b.machineId === log.machineId ? 1 : 0;
      if (bIsMachine !== aIsMachine) return bIsMachine - aIsMachine;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [parts, log.machineId, machines]);

  const relevantParts = useMemo(() => {
    if (showAllWarehouseParts) {
      return [...parts].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return recommendedParts;
  }, [showAllWarehouseParts, parts, recommendedParts]);

  useEffect(() => {
    let active = true;
    const fetchSchedules = async () => {
      try {
        const scheds = await machineService.getSchedules(log.machineId);
        if (active) {
          setSchedules(scheds);
          if (!log.scheduleId && scheds.length > 0) {
            const matched = scheds.find(s => 
              s.taskName.toLowerCase() === log.notes.toLowerCase() || 
              log.notes.toLowerCase().includes(s.taskName.toLowerCase()) || 
              s.taskName.toLowerCase().includes(log.notes.toLowerCase())
            ) || (scheds.length === 1 ? scheds[0] : null);
            if (matched) {
              setSelectedScheduleId(matched.id);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSchedules();
    return () => { active = false; };
  }, [log.machineId, log.scheduleId, log.notes]);

  useEffect(() => {
    let active = true;
    if (!nextMaintenanceDate) {
      const fetchInitialDate = async () => {
        try {
          if (log.scheduleId) {
            const schedules = await machineService.getSchedules(log.machineId);
            const sched = schedules.find(s => s.id === log.scheduleId);
            if (sched && sched.nextDue && active) {
              setNextMaintenanceDate(sched.nextDue);
              return;
            }
          }

          const schedules = await machineService.getSchedules(log.machineId);
          if (schedules.length > 0) {
            const matched = schedules.find(s => 
              s.taskName.toLowerCase() === log.notes.toLowerCase() || 
              log.notes.toLowerCase().includes(s.taskName.toLowerCase()) || 
              s.taskName.toLowerCase().includes(log.notes.toLowerCase())
            ) || schedules[0];
            
            if (matched && matched.nextDue && active) {
              setNextMaintenanceDate(matched.nextDue);
              return;
            }
          }

          const machines = await machineService.getMachines();
          const m = machines.find(mach => mach.id === log.machineId);
          if (m && active) {
            setNextMaintenanceDate(m.nextMaintenanceDate || '');
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchInitialDate();
    }
    return () => { active = false; };
  }, [log.machineId, log.scheduleId, log.notes, nextMaintenanceDate]);

  const partsCostSum = Math.round(formData.partsUsed.reduce((acc, p) => {
    const matchedPart = parts.find(spare => spare.id === p.partId);
    return acc + (matchedPart ? (matchedPart.unitPrice || 0) * p.quantity : 0);
  }, 0) * 100) / 100;

  const addPart = () => {
    if (!selectedPart) return;
    const part = parts.find(p => p.id === selectedPart);
    if (!part) return;

    const parsed = parseFloat(String(partQty).replace(',', '.'));
    const qtyToAdd = Math.round((Number.isFinite(parsed) ? parsed : 0) * 1000) / 1000;
    
    if (qtyToAdd <= 0) {
      alert('Укажите количество больше 0 (например, 0.3, 0.5, 1)');
      return;
    }

    const previouslyAllocated = log.partsUsed?.find(p => p.partId === selectedPart)?.quantity || 0;
    const maxAvailable = Math.round((part.quantity + previouslyAllocated) * 1000) / 1000;

    const existingIndex = formData.partsUsed.findIndex(p => p.partId === selectedPart);
    if (existingIndex >= 0) {
      const current = formData.partsUsed[existingIndex].quantity || 0;
      const totalDesired = Math.round((current + qtyToAdd) * 1000) / 1000;
      if (totalDesired > maxAvailable) {
        alert(`Недостаточно на складе! В наличии доступно ${part.quantity} ${part.unit || 'ед.'}, а суммарно запрошено ${totalDesired} ${part.unit || 'ед.'}`);
        return;
      }
      const updated = [...formData.partsUsed];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: totalDesired
      };
      setFormData({
        ...formData,
        partsUsed: updated
      });
    } else {
      if (qtyToAdd > maxAvailable) {
        alert(`Недостаточно на складе! В наличии доступно ${part.quantity} ${part.unit || 'ед.'}, а запрошено ${qtyToAdd} ${part.unit || 'ед.'}`);
        return;
      }
      setFormData({
        ...formData,
        partsUsed: [...formData.partsUsed, { partId: part.id, quantity: qtyToAdd, name: part.name }]
      });
    }
    
    setSelectedPart('');
    setPartQty(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const finalCost = formData.cost > 0 ? formData.cost : partsCostSum;
      await machineService.updateLog(log.id, {
        ...formData,
        cost: finalCost,
        nextMaintenanceDate: nextMaintenanceDate,
        scheduleId: selectedScheduleId
      });
      if (nextMaintenanceDate) {
        await machineService.updateMachine(log.machineId, {
          nextMaintenanceDate: nextMaintenanceDate,
          lastMaintenanceDate: formData.date
        });
        if (selectedScheduleId) {
          await machineService.updateSchedule(selectedScheduleId, {
            nextDue: nextMaintenanceDate
          });
        } else {
          // Fallback matching if they didn't explicitly select/link schedule, but notes match
          const matched = schedules.find(s => 
            s.taskName.toLowerCase() === log.notes.toLowerCase() || 
            log.notes.toLowerCase().includes(s.taskName.toLowerCase()) || 
            s.taskName.toLowerCase().includes(log.notes.toLowerCase())
          );
          if (matched) {
            await machineService.updateSchedule(matched.id, {
              nextDue: nextMaintenanceDate
            });
          }
        }
      }
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-slate-900 text-[11px]">
      {error && (
        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold border border-rose-100">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        <div className="col-span-1">
          <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Тип работ</label>
          <select 
            className="min-h-10 w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={formData.type}
            onChange={e => setFormData({...formData, type: e.target.value as LogType})}
          >
            <option value="routine">🔧 Плановое ТО</option>
            <option value="repair">🩹 Ремонт</option>
            <option value="inspection">🔍 Инспекция</option>
          </select>
        </div>
        <div className="col-span-1">
          <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Дата проведения</label>
          <input required type="date" className="min-h-10 w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
        </div>
        <div className="col-span-1">
          <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Стоимость (₽)</label>
          <input type="number" className="min-h-10 w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0 ₽" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
        </div>
      </div>

      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 block px-0.5">Запчасти со склада</label>
        <div className="flex gap-1.5">
          <select 
            className="min-h-10 flex-1 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-medium bg-white h-7 focus:ring-1 focus:ring-blue-500 outline-none" 
            value={selectedPart} 
            onChange={e => setSelectedPart(e.target.value)}
          >
            <option value="">
              {relevantParts.length === 0 
                ? (!log.machineId 
                    ? 'Сначала выберите станок' 
                    : 'Нет рекомендованных запчастей') 
                : showAllWarehouseParts
                  ? `Выбрать деталь (${relevantParts.length} со склада)...`
                  : `Выбрать деталь (${relevantParts.length} рекомендовано)...`}
            </option>
            {relevantParts.map(p => {
              const currentMachine = machines?.find(m => m.id === log.machineId);
              const targetBranchId = currentMachine?.branchId;
              const isForMachine = Boolean(log.machineId && p.machineId === log.machineId);
              const isForBranch = Boolean(targetBranchId && p.branchId === targetBranchId && !p.machineId);
              const prefix = isForMachine ? '[🎯 Станок] ' : isForBranch ? '[🏢 Филиал] ' : '[📦 Склад] ';
              return (
                <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                  {prefix}{p.name} ({p.quantity} {p.unit || 'шт'}){p.quantity <= 0 ? ' — нет на складе' : ''}
                </option>
              );
            })}
          </select>
          <input type="number" min="1" className="min-h-10 w-12 px-1 py-1 rounded-lg border border-slate-200 text-[10px] font-bold bg-white h-7 text-center" value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
          <button type="button" onClick={addPart} className="px-2.5 bg-slate-900 text-white rounded-lg hover:bg-blue-600 transition-colors h-7 flex items-center justify-center shrink-0 font-bold active:scale-95 text-[10px]">
            +
          </button>
        </div>

        {parts.length > 0 && (
          <div className="flex items-center justify-between text-[9px] pt-0.5 px-0.5 text-slate-500">
            <span>
              {showAllWarehouseParts 
                ? `Все со склада (${parts.length})` 
                : `Только рекомендованные (${recommendedParts.length})`}
            </span>
            {parts.length > recommendedParts.length && (
              <button
                type="button"
                onClick={() => setShowAllWarehouseParts(!showAllWarehouseParts)}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
              >
                {showAllWarehouseParts ? 'Только рекомендованные' : `Показать все со склада (+${parts.length - recommendedParts.length})`}
              </button>
            )}
          </div>
        )}
        {formData.partsUsed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {formData.partsUsed.map((p, i) => (
              <div key={i} className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-[9px] font-bold">
                <span>⚙️ {p.name} × {p.quantity}</span>
                <button 
                  type="button" 
                  onClick={() => setFormData({
                    ...formData,
                    partsUsed: formData.partsUsed.filter((_, idx) => idx !== i)
                  })}
                  className="text-rose-500 hover:text-rose-700 font-bold ml-0.5"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
              Итого: {partsCostSum.toLocaleString()} ₽
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Описание / Заметки</label>
        <textarea 
          rows={2}
          className="w-full p-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none text-[11px] font-medium min-h-[36px] max-h-[64px] resize-y bg-white"
          value={formData.notes}
          onChange={e => setFormData({...formData, notes: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-0.5 block px-0.5">Связь с регламентом</label>
          <select 
            className="min-h-10 w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-medium h-7 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
            value={selectedScheduleId}
            onChange={e => setSelectedScheduleId(e.target.value)}
          >
            <option value="">Общие регламентные работы</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>{s.taskName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[8px] font-black uppercase tracking-wider text-indigo-500 mb-0.5 block px-0.5">След. ТО</label>
          <input 
            required 
            type="date" 
            className="min-h-10 w-full px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50/40 text-[11px] font-bold h-7 focus:ring-1 focus:ring-indigo-500 outline-none text-indigo-900" 
            value={nextMaintenanceDate} 
            onChange={e => setNextMaintenanceDate(e.target.value)} 
          />
        </div>
      </div>

      <div>
        <MultiPhotoPicker 
          images={formData.imageUrls} 
          onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
          maxPhotos={5} 
          label="Фото проведенных работ" 
          compact={true}
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-2 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-blue-100 active:scale-[0.99] ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Сохранение...' : 'Обновить запись'}
      </button>
    </form>
  );
}

function AddBranchForm({ onComplete }: { onComplete: () => void }) {
  const [formData, setFormData] = useState({ name: '', location: '', contactPerson: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await machineService.addBranch(formData);
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">
          {error}
        </div>
      )}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Название филиала</label>
        <input 
          required 
          type="text" 
          className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
          placeholder="Например: Цех №1"
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Адрес / Локация</label>
        <input 
          type="text" 
          className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
          placeholder="Город, улица..."
          value={formData.location} 
          onChange={e => setFormData({...formData, location: e.target.value})} 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-4 text-white rounded-xl font-bold transition-all shadow-lg ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
      >
        {loading ? 'Создание...' : 'Создать филиал'}
      </button>
    </form>
  );
}

function UnitsManagerModal({ 
  isOpen, 
  onClose, 
  units = [], 
  onRefresh 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  units?: UnitOfMeasure[]; 
  onRefresh: () => void; 
}) {
  const safeUnits = Array.isArray(units) ? units : [];
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<UnitOfMeasure | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await machineService.addUnitOfMeasure({ code: code.trim(), name: name.trim() });
      setCode('');
      setName('');
      onRefresh();
    } catch (err) {
      console.error(err);
      setError('Ошибка при добавлении единицы измерения');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (u: UnitOfMeasure) => {
    setEditingUnitId(u.id);
    setEditCode(u.code);
    setEditName(u.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingUnitId(null);
    setEditCode('');
    setEditName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editCode.trim() || !editName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await machineService.updateUnitOfMeasure(id, {
        code: editCode.trim(),
        name: editName.trim()
      });
      setEditingUnitId(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      setError('Ошибка при обновлении единицы измерения' + (err instanceof Error ? `: ${err.message}` : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (unit: UnitOfMeasure) => {
    try {
      setDeletingId(unit.id);
      await machineService.deleteUnitOfMeasure(unit.id);
      setConfirmDeleteUnit(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      setConfirmDeleteUnit(null);
      setError('Ошибка при удалении единицы измерения' + (err instanceof Error ? `: ${err.message}` : ''));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Управление единицами измерения">
      <div className="space-y-6 text-slate-900">
        <form onSubmit={handleAdd} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue-600" />
            Добавить новую единицу измерения
          </h4>
          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Код / Обозначение
              </label>
              <input 
                required 
                type="text" 
                placeholder="Напр.: м³" 
                value={code} 
                onChange={e => setCode(e.target.value)}
                className="min-h-10 w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Полное наименование
              </label>
              <div className="flex items-center gap-2">
                <input 
                  required 
                  type="text" 
                  placeholder="Напр.: Кубический метр" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="min-h-10 flex-1 p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {loading ? '...' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Список единиц измерения ({safeUnits.length})
            </h4>
            <span className="text-[11px] text-slate-400">Можно редактировать или удалять</span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {safeUnits.map(u => (
              <div 
                key={u.id} 
                className={`p-3 bg-white border rounded-xl transition-all shadow-sm ${
                  editingUnitId === u.id ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {editingUnitId === u.id ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input 
                      type="text" 
                      value={editCode} 
                      onChange={e => setEditCode(e.target.value)} 
                      placeholder="Код (напр. шт)" 
                      className="min-h-10 w-24 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      placeholder="Полное наименование" 
                      className="min-h-10 flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      <button 
                        type="button" 
                        onClick={() => handleSaveEdit(u.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Сохранить
                      </button>
                      <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-all"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-black font-mono">
                        {u.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{u.name}</span>
                    </div>
                    
                    {u.isSystem ? (
                      // The backend rejects edit/delete of system units (403), so no buttons for them.
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1" title="Системная единица измерения не редактируется и не удаляется">
                        Системная
                      </span>
                    ) : confirmDeleteUnit?.id === u.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-lg border border-rose-200">
                        <span className="text-[11px] font-bold text-rose-700 px-1">Удалить?</span>
                        <button 
                          type="button" 
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id}
                          className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded hover:bg-rose-700 transition-all"
                        >
                          {deletingId === u.id ? '...' : 'Да'}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setConfirmDeleteUnit(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 text-[11px] font-bold rounded hover:bg-slate-300 transition-all"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button 
                          type="button" 
                          onClick={() => handleStartEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Редактировать единицу измерения"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setConfirmDeleteUnit(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Удалить единицу измерения"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {safeUnits.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs font-medium border border-dashed rounded-xl">
                Нет добавленных единиц измерения. Добавьте новую форму выше.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AddPartForm({ 
  units = [], 
  branches = [],
  machines = [],
  onOpenUnitsModal, 
  onComplete 
}: { 
  units?: UnitOfMeasure[]; 
  branches?: Branch[];
  machines?: Machine[];
  onOpenUnitsModal: () => void; 
  onComplete: () => void; 
}) {
  const safeUnits = Array.isArray(units) ? units : [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>('');
  const [machineId, setMachineId] = useState<string>('');
  const [formData, setFormData] = useState({ 
    name: '', 
    sku: '', 
    quantity: 1, 
    minQuantity: 1, 
    unitPrice: 0, 
    unit: 'шт',
    imageUrl: '',
    imageUrls: [] as string[]
  });

  const totalSum = useMemo(() => {
    const qty = Number(formData.quantity) || 0;
    const price = Number(formData.unitPrice) || 0;
    return Math.max(0, qty * price);
  }, [formData.quantity, formData.unitPrice]);

  const filteredMachines = useMemo(() => {
    if (!branchId) return machines;
    return machines.filter(m => !m.branchId || m.branchId === branchId);
  }, [machines, branchId]);

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    if (machineId) {
      const currentMachine = machines.find(m => m.id === machineId);
      if (currentMachine && currentMachine.branchId && currentMachine.branchId !== newBranchId) {
        setMachineId('');
      }
    }
  };

  const handleMachineChange = (newMachineId: string) => {
    setMachineId(newMachineId);
    if (newMachineId) {
      const selectedM = machines.find(m => m.id === newMachineId);
      if (selectedM && selectedM.branchId && (!branchId || branchId !== selectedM.branchId)) {
        setBranchId(selectedM.branchId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await machineService.addSparePart({
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        quantity: Number(formData.quantity) || 0,
        minQuantity: Number(formData.minQuantity) || 0,
        unitPrice: Number(formData.unitPrice) || 0,
        unit: formData.unit || 'шт',
        branchId: branchId || undefined,
        machineId: machineId || undefined,
        imageUrl: formData.imageUrl || (formData.imageUrls && formData.imageUrls[0]) || '',
        imageUrls: formData.imageUrls || []
      });
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">Наименование запчасти</label>
        <input 
          required 
          type="text" 
          className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" 
          placeholder="Например: Фильтр масляный гидравлический" 
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">Артикул / SKU</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono transition-all uppercase" 
            placeholder="SKU-12345" 
            value={formData.sku} 
            onChange={e => setFormData({...formData, sku: e.target.value})} 
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5 sm:mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Ед. измерения</label>
            <button 
              type="button" 
              onClick={onOpenUnitsModal}
              className="-my-3 py-3 text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              Добавить ЕИ
            </button>
          </div>
          <select 
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold transition-all cursor-pointer"
            value={formData.unit || 'шт'}
            onChange={e => setFormData({ ...formData, unit: e.target.value })}
          >
            {safeUnits.map(u => (
              <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Привязка к филиалу и оборудованию */}
      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 min-w-0 break-words">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            Привязка к филиалу и станку (по выбору)
          </span>
          {(branchId || machineId) && (
            <button
              type="button"
              onClick={() => { setBranchId(''); setMachineId(''); }}
              className="-my-3 py-3 text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors whitespace-nowrap shrink-0"
            >
              Сбросить
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Филиал
            </label>
            <select
              value={branchId}
              onChange={e => handleBranchChange(e.target.value)}
              className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="">Для всех филиалов (общая)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  🏢 {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Оборудование / Станок
            </label>
            <select
              value={machineId}
              onChange={e => handleMachineChange(e.target.value)}
              className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="">Для любого оборудования (универсальная)</option>
              {filteredMachines.map(m => (
                <option key={m.id} value={m.id}>
                  🎯 {m.name} ({m.model || 'б/м'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {(branchId || machineId) && (
          <p className="text-[10px] text-blue-700 bg-blue-50/70 p-2 rounded-lg border border-blue-100 flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>
              Деталь будет доступна только для:
              {branchId && <strong> {branches.find(b => b.id === branchId)?.name}</strong>}
              {branchId && machineId && ' → '}
              {machineId && <strong> {machines.find(m => m.id === machineId)?.name}</strong>}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
            Количество к оприходованию ({formData.unit || 'шт'})
          </label>
          <input 
            required 
            type="number" 
            min="0"
            step="any"
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
            value={formData.quantity} 
            onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} 
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
            Мин. запас ({formData.unit || 'шт'})
          </label>
          <input 
            required 
            type="number" 
            min="0"
            step="any"
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
            value={formData.minQuantity} 
            onChange={e => setFormData({...formData, minQuantity: parseFloat(e.target.value) || 0})} 
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
          Цена за 1 {formData.unit || 'ед.'} (₽)
        </label>
        <input 
          required 
          type="number" 
          min="0"
          step="any"
          className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
          value={formData.unitPrice} 
          onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} 
          placeholder="0.00"
        />
      </div>

      {/* Фото запчасти */}
      <div className="pt-1">
        <MultiPhotoPicker 
          images={formData.imageUrls} 
          onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
          maxPhotos={5} 
          label="Фотография запчасти (оприходование)" 
          compact={false}
        />
      </div>

      {/* Итоговая расчетная сумма оприходования */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/70 border-2 border-blue-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-700">Итого сумма оприходования</p>
              <p className="text-sm text-slate-500 font-mono mt-0.5 font-semibold">
                {formData.quantity || 0} {formData.unit || 'шт'} × {(Number(formData.unitPrice) || 0).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
          <div className="ml-auto text-right min-w-0">
            <div className="text-2xl sm:text-3xl md:text-4xl wrap-anywhere font-black font-mono text-blue-900 tracking-tight">
              {totalSum.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-1">
              Сумма партии
            </div>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-4 sm:py-4.5 text-white rounded-xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
      >
        <Plus className="w-5 h-5" />
        {loading ? 'Сохранение...' : `Оприходовать запчасть • ${totalSum.toLocaleString('ru-RU')} ₽`}
      </button>
    </form>
  );
}

function EditPartForm({
  part,
  units = [],
  branches = [],
  machines = [],
  onOpenUnitsModal,
  onComplete
}: {
  part: SparePart;
  units?: UnitOfMeasure[];
  branches?: Branch[];
  machines?: Machine[];
  onOpenUnitsModal: () => void;
  onComplete: () => void;
}) {
  const safeUnits = Array.isArray(units) ? units : [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>(part.branchId || '');
  const [machineId, setMachineId] = useState<string>(part.machineId || '');
  const [formData, setFormData] = useState({
    name: part.name || '',
    sku: part.sku || '',
    quantity: part.quantity ?? 0,
    minQuantity: part.minQuantity ?? 0,
    unitPrice: part.unitPrice ?? 0,
    unit: part.unit || 'шт',
    imageUrl: part.imageUrl || (part.imageUrls && part.imageUrls[0]) || '',
    imageUrls: (part.imageUrls && part.imageUrls.length > 0) ? part.imageUrls : (part.imageUrl ? [part.imageUrl] : [])
  });

  const totalSum = useMemo(() => {
    const qty = Number(formData.quantity) || 0;
    const price = Number(formData.unitPrice) || 0;
    return Math.max(0, qty * price);
  }, [formData.quantity, formData.unitPrice]);

  const filteredMachines = useMemo(() => {
    if (!branchId) return machines;
    return machines.filter(m => !m.branchId || m.branchId === branchId);
  }, [machines, branchId]);

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    if (machineId) {
      const currentMachine = machines.find(m => m.id === machineId);
      if (currentMachine && currentMachine.branchId && currentMachine.branchId !== newBranchId) {
        setMachineId('');
      }
    }
  };

  const handleMachineChange = (newMachineId: string) => {
    setMachineId(newMachineId);
    if (newMachineId) {
      const selectedM = machines.find(m => m.id === newMachineId);
      if (selectedM && selectedM.branchId && (!branchId || branchId !== selectedM.branchId)) {
        setBranchId(selectedM.branchId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await machineService.updateSparePart(part.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        quantity: Number(formData.quantity) || 0,
        minQuantity: Number(formData.minQuantity) || 0,
        unitPrice: Number(formData.unitPrice) || 0,
        unit: formData.unit || 'шт',
        branchId: branchId || undefined,
        machineId: machineId || undefined,
        imageUrl: formData.imageUrl || (formData.imageUrls && formData.imageUrls[0]) || '',
        imageUrls: formData.imageUrls || []
      });
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">Наименование запчасти</label>
        <input 
          required 
          type="text" 
          className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" 
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">Артикул / SKU</label>
          <input 
            required 
            type="text" 
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono transition-all uppercase" 
            value={formData.sku} 
            onChange={e => setFormData({...formData, sku: e.target.value})} 
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5 sm:mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Ед. измерения</label>
            <button 
              type="button" 
              onClick={onOpenUnitsModal}
              className="-my-3 py-3 text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              Добавить ЕИ
            </button>
          </div>
          <select 
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold transition-all cursor-pointer"
            value={formData.unit || 'шт'}
            onChange={e => setFormData({ ...formData, unit: e.target.value })}
          >
            {safeUnits.map(u => (
              <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Привязка к филиалу и оборудованию */}
      <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 min-w-0 break-words">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            Привязка к филиалу и станку (по выбору)
          </span>
          {(branchId || machineId) && (
            <button
              type="button"
              onClick={() => { setBranchId(''); setMachineId(''); }}
              className="-my-3 py-3 text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors whitespace-nowrap shrink-0"
            >
              Сбросить
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Филиал
            </label>
            <select
              value={branchId}
              onChange={e => handleBranchChange(e.target.value)}
              className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="">Для всех филиалов (общая)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  🏢 {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Оборудование / Станок
            </label>
            <select
              value={machineId}
              onChange={e => handleMachineChange(e.target.value)}
              className="w-full min-h-10 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="">Для любого оборудования (универсальная)</option>
              {filteredMachines.map(m => (
                <option key={m.id} value={m.id}>
                  🎯 {m.name} ({m.model || 'б/м'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {(branchId || machineId) && (
          <p className="text-[10px] text-blue-700 bg-blue-50/70 p-2 rounded-lg border border-blue-100 flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>
              Деталь привязана к:
              {branchId && <strong> {branches.find(b => b.id === branchId)?.name}</strong>}
              {branchId && machineId && ' → '}
              {machineId && <strong> {machines.find(m => m.id === machineId)?.name}</strong>}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
            Количество на складе ({formData.unit || 'шт'})
          </label>
          <input 
            required 
            type="number" 
            min="0"
            step="any"
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
            value={formData.quantity} 
            onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} 
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
            Мин. запас ({formData.unit || 'шт'})
          </label>
          <input 
            required 
            type="number" 
            min="0"
            step="any"
            className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
            value={formData.minQuantity} 
            onChange={e => setFormData({...formData, minQuantity: parseFloat(e.target.value) || 0})} 
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2 block break-words">
          Цена за 1 {formData.unit || 'ед.'} (₽)
        </label>
        <input 
          required 
          type="number" 
          min="0"
          step="any"
          className="min-h-10 w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all font-mono" 
          value={formData.unitPrice} 
          onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} 
        />
      </div>

      {/* Фото запчасти */}
      <div className="pt-1">
        <MultiPhotoPicker 
          images={formData.imageUrls} 
          onChange={(imgs) => setFormData({ ...formData, imageUrls: imgs, imageUrl: imgs[0] || '' })} 
          maxPhotos={5} 
          label="Фотография запчасти" 
          compact={false}
        />
      </div>

      {/* Итоговая стоимость складского остатка */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/70 border-2 border-blue-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-700">Итого стоимость остатка</p>
              <p className="text-sm text-slate-500 font-mono mt-0.5 font-semibold">
                {formData.quantity || 0} {formData.unit || 'шт'} × {(Number(formData.unitPrice) || 0).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
          <div className="ml-auto text-right min-w-0">
            <div className="text-2xl sm:text-3xl md:text-4xl wrap-anywhere font-black font-mono text-blue-900 tracking-tight">
              {totalSum.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-1">
              Стоимость на складе
            </div>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-4 sm:py-4.5 text-white rounded-xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
      >
        <Check className="w-5 h-5" />
        {loading ? 'Сохранение...' : `Сохранить изменения • ${totalSum.toLocaleString('ru-RU')} ₽`}
      </button>
    </form>
  );
}

function MaintenanceScheduleTab({ machines, schedules, logs, branches, parts, onRefresh, role }: { machines: Machine[], schedules: MaintenanceSchedule[], logs: MaintenanceLog[], branches: Branch[], parts: SparePart[], onRefresh: () => void, role?: Role | null }) {
  const canCreateSchedule = canPerformAction(role, 'maintenance.schedules', 'create');
  const canEditSchedule = canPerformAction(role, 'maintenance.schedules', 'edit');
  const canDeleteSchedule = canPerformAction(role, 'maintenance.schedules', 'delete');
  const canCreateLog = canPerformAction(role, 'maintenance.journal', 'create');
  const canEditLog = canPerformAction(role, 'maintenance.journal', 'edit');
  const canDeleteLog = canPerformAction(role, 'maintenance.journal', 'delete');

  const [subTab, setSubTab] = useState<'schedule' | 'history' | 'pending'>('schedule');
  const [toirCategoryFilter, setToirCategoryFilter] = useState<'all' | ToirTaskType>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);

  const [completingTask, setCompletingTask] = useState<{ machineId: string, taskName: string, scheduleId: string } | null>(null);
  const [confirmCompleteSchedule, setConfirmCompleteSchedule] = useState<ToirScheduleItem | null>(null);
  const [isExecutingComplete, setIsExecutingComplete] = useState(false);
  const [showManualLog, setShowManualLog] = useState(false);
  const [editingLog, setEditingLog] = useState<MaintenanceLog | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [confirmDeleteScheduleId, setConfirmDeleteScheduleId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<'schedule' | 'history' | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [logLightbox, setLogLightbox] = useState<{ images: string[]; initialIndex: number; title: string } | null>(null);

  const handleDeleteLog = async (logId: string) => {
    try {
      await machineService.deleteLog(logId);
      setDeletingLogId(null);
      onRefresh();
    } catch (e) {
      alert('Ошибка при удалении');
    }
  };

  const handleDeleteSchedule = async (schedule: ToirScheduleItem) => {
    try {
      if (schedule.isManual) {
        await machineService.updateMachine(schedule.machineId, { nextMaintenanceDate: '' });
      } else {
        await machineService.deleteSchedule(schedule.id);
      }
      setConfirmDeleteScheduleId(null);
      onRefresh();
    } catch (e) {
      alert(schedule.isManual ? 'Ошибка при очистке даты ТО' : 'Ошибка при удалении задачи');
    }
  };

  const handleConfirmExecution = async () => {
    if (!confirmCompleteSchedule) return;
    setIsExecutingComplete(true);
    try {
      const schedule = confirmCompleteSchedule;
      const todayStr = new Date().toISOString().split('T')[0];
      const category = getToirCategory(schedule.taskType);

      // Create log entry in maintenance history
      await machineService.addLog({
        machineId: schedule.machineId,
        date: todayStr,
        technicianName: schedule.assignedTechnician || 'Дежурный специалист',
        type: (schedule.taskType === 'ppr' ? 'repair' : schedule.taskType === 'diagnostic' ? 'inspection' : 'routine') as LogType,
        taskType: schedule.taskType || 'routine',
        notes: `Выполнено ТО: ${schedule.taskName}${schedule.description ? ` (${schedule.description})` : ` — ${category.goal}`}`,
        cost: schedule.laborCost || 0,
        partsUsed: schedule.partsUsed || [],
        nextMaintenanceDate: '',
        imageUrl: schedule.imageUrl || (schedule.imageUrls && schedule.imageUrls[0]) || '',
        scheduleId: schedule.isManual ? '' : schedule.id
      });

      // Remove from active schedule so the card disappears
      if (!schedule.isManual) {
        await machineService.deleteSchedule(schedule.id);
      }

      await machineService.updateMachine(schedule.machineId, {
        lastMaintenanceDate: todayStr,
        nextMaintenanceDate: '',
        status: 'active'
      });

      setConfirmCompleteSchedule(null);
      onRefresh();
    } catch (err) {
      console.error("Execute error:", err);
      alert('Ошибка при выполнении задачи');
    } finally {
      setIsExecutingComplete(false);
    }
  };

  const handleClearAllSchedules = async () => {
    setIsClearing(true);
    try {
      for (const s of schedules) {
        await machineService.deleteSchedule(s.id);
      }
      for (const m of machines) {
        if (m.nextMaintenanceDate) {
          await machineService.updateMachine(m.id, { nextMaintenanceDate: '' });
        }
      }
      setShowClearConfirm(null);
      onRefresh();
    } catch (e) {
      alert('Ошибка при очистке графика');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllLogs = async () => {
    setIsClearing(true);
    try {
      for (const log of logs) {
        await machineService.deleteLog(log.id);
      }
      setShowClearConfirm(null);
      onRefresh();
    } catch (e) {
      alert('Ошибка при очистке истории');
    } finally {
      setIsClearing(false);
    }
  };

  // Combine scheduled tasks (manual nextMaintenanceDate cards removed — they had no working edit)
  const combinedSchedules: ToirScheduleItem[] = schedules
    .map(s => {
      const machine = machines.find(m => m.id === s.machineId);
      const branch = branches.find(b => b.id === machine?.branchId);
      return {
        ...s,
        isManual: false,
        machineName: machine?.name || 'Оборудование',
        model: machine?.model,
        serialNumber: machine?.serialNumber,
        branchName: branch?.name
      };
    })
    .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime());

  // Filtered schedules for dashboard
  const filteredSchedules = useMemo(() => {
    return combinedSchedules.filter(s => {
      // Category filter
      if (toirCategoryFilter !== 'all') {
        const itemType = s.taskType || 'routine';
        if (itemType !== toirCategoryFilter) return false;
      }

      // Branch filter
      if (branchFilter !== 'all') {
        const machine = machines.find(m => m.id === s.machineId);
        if (machine?.branchId !== branchFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.taskName.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q) || false;
        const matchMachine = s.machineName?.toLowerCase().includes(q) || false;
        const matchModel = s.model?.toLowerCase().includes(q) || false;
        const matchSn = s.serialNumber?.toLowerCase().includes(q) || false;
        if (!matchName && !matchDesc && !matchMachine && !matchModel && !matchSn) return false;
      }

      return true;
    });
  }, [combinedSchedules, toirCategoryFilter, branchFilter, searchQuery, machines]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts = {
      all: combinedSchedules.length,
      routine: 0,
      diagnostic: 0,
      ppr: 0,
      emergency: 0
    };
    combinedSchedules.forEach(s => {
      const type = (s.taskType || 'routine') as ToirTaskType;
      if (counts[type] !== undefined) counts[type]++;
    });
    return counts;
  }, [combinedSchedules]);

  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Overdue schedules or schedules due today or in the past
  const pendingSchedules = combinedSchedules.filter(s => {
    if (!s.nextDue) return false;
    return new Date(s.nextDue) <= now || s.nextDue <= todayStr;
  });

  // Machines currently in maintenance/repair status or due for maintenance
  const pendingMachines = machines.filter(m => {
    if (m.status === 'maintenance' || m.status === 'repair') return true;
    if (m.nextMaintenanceDate && (new Date(m.nextMaintenanceDate) <= now || m.nextMaintenanceDate <= todayStr)) return true;
    return false;
  });

  const totalPendingCount = pendingSchedules.length + pendingMachines.length;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      {/* Top Controls Panel */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            onClick={() => setShowGuideModal(true)}
            className="min-h-10 px-3.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 shrink-0 shadow-2xs"
            title="Справочник по 4 типам ТОиР"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Справочник ТОиР</span>
          </button>

          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="min-h-10 flex-1 sm:flex-none min-w-0 max-w-full sm:max-w-60 truncate px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="all">Все филиалы</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {canCreateSchedule && (
            <button
              onClick={() => setShowCreateScheduleModal(true)}
              className="flex-1 sm:flex-none min-h-10 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-200 shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Задача ТОиР</span>
            </button>
          )}
        </div>
      </div>

      {/* ТОиР 4 Categories Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 sm:pb-0">
          <button
            onClick={() => setToirCategoryFilter('all')}
            className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              toirCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Все задачи</span>
            <span className="text-[10px] opacity-75 font-mono">({categoryCounts.all})</span>
          </button>

          {Object.values(TOIR_CATEGORIES).map((cat) => {
            const isSelected = toirCategoryFilter === cat.type;
            const count = categoryCounts[cat.type] || 0;
            return (
              <button
                key={cat.type}
                onClick={() => setToirCategoryFilter(cat.type)}
                className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? `${cat.colorClasses.badgeBg} border-2 ${cat.colorClasses.border} text-slate-900 shadow-sm`
                    : `bg-white ${cat.colorClasses.border} text-slate-700 hover:bg-slate-50`
                }`}
              >
                {getToirIcon(cat.type, "w-3 h-3")}
                <span>{cat.shortName}</span>
                <span className="text-[10px] opacity-80 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards container */}
      <div className="flex-1 min-h-0">
        {subTab === 'schedule' ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
              <AnimatePresence mode="popLayout">
                {filteredSchedules.map((schedule) => {
                  const machine = machines.find(m => m.id === schedule.machineId);
                  const branch = branches.find(b => b.id === machine?.branchId);
                  
                  return (
                    <ToirScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      machine={machine}
                      branch={branch}
                      canEdit={canEditSchedule}
                      canDelete={canDeleteSchedule}
                      canExecute={canCreateLog}
                      onCompleteModal={(s) => setCompletingTask({ 
                        machineId: s.machineId, 
                        taskName: s.taskName, 
                        scheduleId: s.isManual ? '' : s.id 
                      })}
                      onQuickComplete={(s) => setConfirmCompleteSchedule(s)}
                      onEdit={(s) => setEditingSchedule(s)}
                      onDelete={handleDeleteSchedule}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : subTab === 'history' ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              <AnimatePresence mode="popLayout">
                {sortedLogs.map((log) => {
                  const machine = machines.find(m => m.id === log.machineId);
                  const branch = branches.find(b => b.id === machine?.branchId);
                  const cardPartsCostSum = log.partsUsed?.reduce((acc, p) => {
                    const matched = parts.find(spare => spare.id === p.partId);
                    return acc + (matched ? (matched.unitPrice || 0) * p.quantity : 0);
                  }, 0) || 0;

                  const logTaskCategory = log.taskType ? getToirCategory(log.taskType) : null;

                  return (
                    <motion.div 
                      key={log.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      exit={{ opacity: 0 }}
                      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {logTaskCategory ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight border ${logTaskCategory.colorClasses.badgeBorder} ${logTaskCategory.colorClasses.badgeBg}`}>
                                {getToirIcon(log.taskType, "w-3 h-3 shrink-0")}
                                <span>{logTaskCategory.badgeLabel}</span>
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-bold border ${
                                log.type === 'routine' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {log.type === 'routine' ? '🔧 ТО' : '🩹 Ремонт'}
                              </span>
                            )}

                            {branch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight text-indigo-800 bg-indigo-50 border border-indigo-200/80">
                                <MapPin className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                <span>{branch.name}</span>
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">
                            {machine?.name || '---'}
                          </h4>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
                            Модель: {machine?.model || '---'} • SN: {machine?.serialNumber || '---'}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                           <div className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                             {new Date(log.date).toLocaleDateString('ru-RU')}
                           </div>
                           <div className="flex items-center gap-1 mt-1 justify-end">
                             {canEditLog && (
                               <button 
                                 onClick={() => setEditingLog(log)}
                                 className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                 title="Редактировать запись"
                                >
                                 <Pencil className="w-3 h-3" />
                               </button>
                             )}
                             {canDeleteLog && (
                               deletingLogId === log.id ? (
                                 <div className="flex items-center gap-1">
                                   <button 
                                     onClick={() => handleDeleteLog(log.id)}
                                     className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded hover:bg-rose-600"
                                   >
                                     Да
                                   </button>
                                   <button 
                                     onClick={() => setDeletingLogId(null)}
                                     className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded hover:bg-slate-300"
                                   >
                                     Нет
                                   </button>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => setDeletingLogId(log.id)}
                                   className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                                   title="Удалить запись"
                                 >
                                   <Trash2 className="w-3 h-3" />
                                 </button>
                               )
                             )}
                           </div>
                           {log.technicianName && (
                             <div className="text-[9px] text-slate-500 font-medium italic mt-0.5">{log.technicianName}</div>
                           )}
                        </div>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                        <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">{log.notes}</p>
                        
                        {getLogImages(log).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                            {getLogImages(log).map((img, i) => (
                              <button 
                                key={i} 
                                type="button" 
                                onClick={() => setLogLightbox({ 
                                  images: getLogImages(log), 
                                  initialIndex: i, 
                                  title: `Фото ТО: ${machine?.name || 'Оборудование'}` 
                                })}
                                className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0 group hover:ring-2 hover:ring-blue-500 transition-all shadow-sm"
                              >
                                <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Maximize2 className="w-3 h-3 text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {log.partsUsed && log.partsUsed.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                            {log.partsUsed.map((p, pIdx) => (
                              <span key={pIdx} className="px-2 py-0.5 bg-white text-slate-600 text-[9px] rounded-md border border-slate-200 font-bold uppercase">
                                {p.name} <span className="text-slate-400 ml-0.5">x{p.quantity}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center px-0.5 pt-0.5 text-[10px]">
                         <div className="flex items-center gap-1 text-slate-400 font-semibold">
                            <History className="w-3 h-3" />
                            <span>Архивная запись</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                               Запчасти: <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-0.5">{cardPartsCostSum.toLocaleString()} ₽</span>
                            </div>
                            {log.cost !== undefined && log.cost !== null && log.cost !== cardPartsCostSum && log.cost > 0 && (
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Всего: <span className="text-slate-800 font-bold">{(log.cost || 0).toLocaleString()} ₽</span>
                                </div>
                            )}
                         </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* Subtab === 'pending' (Ожидание ТО) */
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
              <AnimatePresence mode="popLayout">
                {/* Render overdue schedules */}
                {pendingSchedules.map((schedule) => {
                  const machine = machines.find(m => m.id === schedule.machineId);
                  const branch = branches.find(b => b.id === machine?.branchId);
                  const nextDueDate = new Date(schedule.nextDue);
                  const isOverdue = nextDueDate < new Date();
                  const category = getToirCategory(schedule.taskType);

                  return (
                    <motion.div 
                      key={`pending-sched-${schedule.id}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-rose-50/30 border border-rose-200 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight border ${category.colorClasses.badgeBorder} ${category.colorClasses.badgeBg}`}>
                              {getToirIcon(schedule.taskType, "w-3 h-3 shrink-0")}
                              <span>{category.badgeLabel}</span>
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-bold uppercase tracking-tight shadow-xs animate-pulse">
                            {isOverdue ? 'Просрочено ТО' : 'Срок сегодня'}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors line-clamp-2" title={schedule.taskName}>
                          {schedule.taskName}
                        </h3>

                        {/* Middle Section: Branch & Equipment */}
                        <div className="bg-white rounded-xl p-2.5 border border-rose-100/90 mb-2.5 space-y-1.5 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg truncate">
                            <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="truncate font-black tracking-tight">{branch?.name || 'Филиал не указан'}</span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between gap-1.5 truncate pt-0.5">
                            <span className="truncate">{machine?.name || 'Оборудование'}</span>
                            {machine?.serialNumber && (
                              <span className="text-slate-400 font-mono text-[10px] font-medium shrink-0">SN: {machine.serialNumber}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 py-2 px-2.5 border border-rose-100 mb-3 bg-white rounded-xl shadow-2xs">
                          <div className="flex-1 min-w-0">
                            <div className="text-[8px] text-slate-400 font-bold uppercase">Срок выполнения</div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="text-xs font-bold text-rose-600 font-mono truncate">
                                {nextDueDate.toLocaleDateString('ru-RU')}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-5 bg-rose-100" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[8px] text-slate-400 font-bold uppercase">Статус</div>
                            <div className="text-[11px] font-bold text-rose-700 uppercase truncate">Требует ТО</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1.5 w-full shrink-0 items-center">
                        <button 
                          onClick={() => setCompletingTask({ machineId: schedule.machineId, taskName: schedule.taskName, scheduleId: schedule.isManual ? '' : schedule.id })}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Выполнить ТО
                        </button>
                        <button
                          onClick={() => setConfirmCompleteSchedule(schedule)}
                          className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                          title="Выполнить задачу ТО"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Выполнить</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Render machines needing maintenance or repair */}
                {pendingMachines.map((machine) => {
                  const branch = branches.find(b => b.id === machine.branchId);
                  const isRepair = machine.status === 'repair';
                  const isMaint = machine.status === 'maintenance';

                  return (
                    <motion.div 
                      key={`pending-mach-${machine.id}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight shadow-2xs ${
                            isRepair ? 'bg-rose-100 text-rose-700' : isMaint ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isRepair ? 'В ремонте' : isMaint ? 'На обслуживании' : 'Ожидает ТО'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {machine.id.slice(0, 6)}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors truncate" title={machine.name}>
                          {machine.name}
                        </h3>

                        {/* Middle Section: Branch & Equipment Specs */}
                        <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 mb-2.5 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg truncate">
                              <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate font-black tracking-tight">{branch?.name || 'Филиал не указан'}</span>
                            </div>
                            {machine.model && (
                              <span className="text-slate-600 font-medium text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                                {machine.model}
                              </span>
                            )}
                          </div>
                          {machine.serialNumber && (
                            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between gap-1 pt-0.5">
                              <span className="text-slate-400 text-[10px]">Серийный номер:</span>
                              <span className="font-mono text-[10px] text-slate-700 font-bold">SN: {machine.serialNumber}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 py-2 px-2.5 border border-slate-100 mb-3 bg-slate-50/80 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <div className="text-[8px] text-slate-400 font-bold uppercase">Запланировано</div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="text-xs font-bold text-slate-800 font-mono truncate">
                                {machine.nextMaintenanceDate ? new Date(machine.nextMaintenanceDate).toLocaleDateString('ru-RU') : 'Не указана'}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-5 bg-slate-200" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[8px] text-slate-400 font-bold uppercase">Пред. ТО</div>
                            <div className="text-[11px] font-semibold text-slate-600 truncate">
                              {machine.lastMaintenanceDate ? new Date(machine.lastMaintenanceDate).toLocaleDateString('ru-RU') : '---'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1.5 w-full shrink-0 items-center">
                        <button 
                          onClick={() => setCompletingTask({ machineId: machine.id, taskName: 'Техническое обслуживание (ЕО/ТО)', scheduleId: '' })}
                          className="flex-1 bg-slate-900 hover:bg-blue-600 text-white py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Провести ТО
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {((subTab === 'schedule' && filteredSchedules.length === 0) || (subTab === 'history' && sortedLogs.length === 0) || (subTab === 'pending' && totalPendingCount === 0)) && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <Cog className="w-16 h-16 mb-4 opacity-10 animate-spin-slow" />
            <p className="text-base font-bold text-slate-700">
              {subTab === 'schedule' 
                ? (toirCategoryFilter !== 'all' ? 'Нет задач в выбранной категории ТОиР' : 'Задач по обслуживанию пока нет') 
                : subTab === 'pending' 
                  ? 'Все станки обслужены, просроченных задач нет!' 
                  : 'История обслуживания пуста'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {subTab === 'schedule' ? 'Нажмите "+ Задача ТОиР" вверху для добавления регламентных или диагностических работ' : 'Записи сохраняются при выполнении ТО'}
            </p>
            {subTab === 'schedule' && (
              <button
                onClick={() => setShowCreateScheduleModal(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать первую задачу ТОиР</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TOIR Guide Modal */}
      <ToirGuideModal 
        isOpen={showGuideModal} 
        onClose={() => setShowGuideModal(false)} 
      />

      {/* Create TOIR Schedule Modal */}
      {showCreateScheduleModal && (
        <CreateToirScheduleModal
          isOpen={showCreateScheduleModal}
          onClose={() => setShowCreateScheduleModal(false)}
          machines={machines}
          branches={branches}
          parts={parts}
          onCreated={() => {
            setShowCreateScheduleModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Edit TOIR Schedule Modal */}
      {editingSchedule && (
        <EditToirScheduleModal
          schedule={editingSchedule}
          isOpen={!!editingSchedule}
          machines={machines}
          branches={branches}
          parts={parts}
          onClose={() => setEditingSchedule(null)}
          onUpdated={() => {
            setEditingSchedule(null);
            onRefresh();
          }}
        />
      )}

      {/* Execute Task Confirmation Modal (OK - ОТМЕНА) */}
      <AnimatePresence>
        {confirmCompleteSchedule && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-100">
                    <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      Подтверждение выполнения ТО
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Задача будет завершена и перенесена в историю
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium">Задача:</span>
                    <span className="text-xs font-bold text-slate-800 text-right truncate max-w-[240px]">
                      {confirmCompleteSchedule.taskName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium">Оборудование:</span>
                    <span className="text-xs font-bold text-slate-800 text-right truncate max-w-[240px]">
                      {confirmCompleteSchedule.machineName || 'Оборудование'}
                    </span>
                  </div>
                  {confirmCompleteSchedule.branchName && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 font-medium">Филиал:</span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                        {confirmCompleteSchedule.branchName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    <span className="text-xs text-slate-500 font-medium">Категория ТО:</span>
                    <span className="text-xs font-bold text-slate-700">
                      {getToirCategory(confirmCompleteSchedule.taskType).shortName || getToirCategory(confirmCompleteSchedule.taskType).title}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-5">
                  После подтверждения все данные сохранятся в журнале истории обслуживания, а карточка исчезнет из текущего графика.
                </p>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmCompleteSchedule(null)}
                    disabled={isExecutingComplete}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    ОТМЕНА
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExecution}
                    disabled={isExecutingComplete}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-200 flex items-center gap-1.5 active:scale-95"
                  >
                    {isExecutingComplete ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Выполнение...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ОК</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {completingTask && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[84vh] flex flex-col border border-slate-100"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/75 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">Выполнение работ ТОиР</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{completingTask.taskName}</p>
                  </div>
                </div>
                <button onClick={() => setCompletingTask(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3.5 sm:p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                <AddLogForm 
                  machineId={completingTask.machineId} 
                  parts={parts} 
                  machines={machines}
                  branches={branches}
                  defaultNotes={completingTask.taskName}
                  scheduleId={completingTask.scheduleId}
                  onComplete={() => {
                    setCompletingTask(null);
                    onRefresh();
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualLog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[84vh] flex flex-col border border-slate-100"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/75 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">Новая запись ТО</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ручной ввод обслуживания</p>
                  </div>
                </div>
                <button onClick={() => setShowManualLog(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3.5 sm:p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                <AddLogForm 
                  parts={parts} 
                  machines={machines}
                  branches={branches}
                  onComplete={() => {
                    setShowManualLog(false);
                    onRefresh();
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Entry Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[84vh] flex flex-col border border-slate-100"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/75 shrink-0">
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">Редактировать запись ТО</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Изменение параметров и запчастей</p>
                </div>
                <button onClick={() => setEditingLog(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3.5 sm:p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
                <EditLogForm 
                  log={editingLog} 
                  parts={parts}
                  machines={machines}
                  branches={branches}
                  onComplete={() => {
                    setEditingLog(null);
                    onRefresh();
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal 
        isOpen={showClearConfirm === 'schedule'} 
        onClose={() => setShowClearConfirm(null)} 
        title="Подтверждение очистки графика"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Вы действительно хотите <strong className="text-rose-600">очистить весь график работ</strong>? Все запланированные задачи и даты обслуживания будут удалены.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={() => setShowClearConfirm(null)}
              disabled={isClearing}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
            >
              Отмена
            </button>
            <button 
              type="button"
              onClick={handleClearAllSchedules}
              disabled={isClearing}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-rose-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isClearing ? 'Очистка...' : 'Да, очистить всё'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showClearConfirm === 'history'} 
        onClose={() => setShowClearConfirm(null)} 
        title="Подтверждение очистки истории"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Вы действительно хотите <strong className="text-rose-600">очистить всю историю ТО</strong>? Все записи о выполненном обслуживании будут удалены.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={() => setShowClearConfirm(null)}
              disabled={isClearing}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
            >
              Отмена
            </button>
            <button 
              type="button"
              onClick={handleClearAllLogs}
              disabled={isClearing}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-rose-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isClearing ? 'Очистка...' : 'Да, очистить историю'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lightbox Modal for Log photos */}
      <LightboxModal 
        isOpen={!!logLightbox} 
        onClose={() => setLogLightbox(null)} 
        images={logLightbox?.images || []} 
        initialIndex={logLightbox?.initialIndex || 0}
        title={logLightbox?.title} 
      />
    </div>
  );
}

function BranchesTab({ branches, machines, onRefresh, role }: { branches: Branch[], machines: Machine[], onRefresh: () => void, role?: Role | null }) {
  const canEditBranch = canPerformAction(role, 'branches.branch_list', 'edit');
  const canDeleteBranch = canPerformAction(role, 'branches.branch_list', 'delete');

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewingMachinesBranch, setViewingMachinesBranch] = useState<Branch | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    
    // Reset any previous messages
    setErrorMessage(null);
    setSuccessMessage(null);
    
    const branchMachines = machines.filter(m => m.branchId === id);
    if (branchMachines.length > 0) {
      // Close the dialog, otherwise the error banner stays hidden behind it and the button looks dead.
      setConfirmDelete(null);
      setErrorMessage(`Нельзя удалить филиал "${name}", пока в нем числится оборудование (${branchMachines.length} шт). Сначала переместите или удалите оборудование филиала.`);
      return;
    }
    
    // Close confirmation dialog before starting
    setConfirmDelete(null);
    setDeletingId(id);
    
    try {
      console.log('Attempting to delete branch:', id);
      await machineService.deleteBranch(id);
      console.log('Successfully deleted branch:', id);
      setSuccessMessage(`Филиал "${name}" успешно удален`);
      // Automatically clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error('Delete error details:', e);
      setErrorMessage('Ошибка при удалении: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {(errorMessage || successMessage) && (
        <div className={`mb-6 p-4 border rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${errorMessage ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${errorMessage ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {errorMessage ? '!' : '✓'}
            </span>
            <span className="text-sm font-medium">{errorMessage || successMessage}</span>
          </div>
          <button onClick={() => { setErrorMessage(null); setSuccessMessage(null); }} className={`p-1 rounded-lg transition-colors ${errorMessage ? 'hover:bg-rose-100' : 'hover:bg-emerald-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="lg:max-h-[600px] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 text-slate-800">
          {branches.map(branch => (
            <div 
              key={branch.id} 
              onClick={() => setViewingMachinesBranch(branch)}
              className={`bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer hover:border-blue-300 ${deletingId === branch.id ? 'opacity-50 grayscale scale-95' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-8 h-8 shrink-0 text-blue-500 group-hover:scale-110 transition-transform" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 break-words">{branch.name}</h3>
                    <p className="text-xs text-slate-400 break-words">{branch.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canEditBranch && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setErrorMessage(null);
                        setEditingBranch(branch);
                      }}
                      disabled={deletingId === branch.id}
                      className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                      title="Редактировать филиал"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canDeleteBranch && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setErrorMessage(null);
                        setConfirmDelete({id: branch.id, name: branch.name});
                      }}
                      disabled={deletingId === branch.id}
                      className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                      title="Удалить филиал"
                    >
                      <Trash2 className={`w-5 h-5 ${deletingId === branch.id ? 'animate-pulse text-rose-600' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Оборудование</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-mono">
                  {machines.filter(m => m.branchId === branch.id).length}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно подтверждения удаления */}
      <Modal 
        isOpen={!!confirmDelete} 
        onClose={() => setConfirmDelete(null)} 
        title="Подтверждение удаления"
      >
        <div className="text-center p-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить филиал?</h3>
          <p className="text-slate-500 mb-8">
            Вы действительно хотите удалить филиал <span className="font-bold text-slate-800">"{confirmDelete?.name}"</span>? 
            Это действие невозможно отменить.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmDelete(null)}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Отмена
            </button>
            <button 
              onClick={handleDelete}
              className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewingMachinesBranch}
        onClose={() => setViewingMachinesBranch(null)}
        title={`Оборудование в филиале: ${viewingMachinesBranch?.name}`}
      >
        {viewingMachinesBranch && (
          <div className="space-y-6">
            {machines.filter(m => m.branchId === viewingMachinesBranch.id).length === 0 ? (
              <div className="text-center py-12">
                <LayoutDashboard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 italic">В этом филиале пока нет зарегистрированного оборудования.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b pb-2">Список объектов ({machines.filter(m => m.branchId === viewingMachinesBranch.id).length})</div>
                {machines.filter(m => m.branchId === viewingMachinesBranch.id).map(machine => (
                  <div key={machine.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                    <div>
                      <h4 className="font-bold text-slate-900">{machine.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400 uppercase">{machine.manufacturer ? `${machine.manufacturer} • ` : ''}{machine.model} / {machine.serialNumber}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase text-white ${getStatusColor(machine.status)}`}>
                      {getStatusLabel(machine.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button 
              onClick={() => setViewingMachinesBranch(null)}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all mt-4"
            >
              Закрыть
            </button>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={!!editingBranch} 
        onClose={() => setEditingBranch(null)} 
        title="Редактировать филиал"
      >
        {editingBranch && (
          <EditBranchForm 
            branch={editingBranch} 
            onComplete={() => {
              setEditingBranch(null);
              onRefresh();
            }} 
          />
        )}
      </Modal>
    </>
  );
}

function EditBranchForm({ branch, onComplete }: { branch: Branch, onComplete: () => void }) {
  const [formData, setFormData] = useState({ 
    name: branch.name, 
    location: branch.location || '', 
    contactPerson: branch.contactPerson || '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await machineService.updateBranch(branch.id, formData);
      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-100">
          {error}
        </div>
      )}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Название филиала</label>
        <input 
          required 
          type="text" 
          className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
          placeholder="Например: Цех №1"
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Адрес / Локация</label>
        <input 
          type="text" 
          className="min-h-10 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
          placeholder="Город, улица..."
          value={formData.location} 
          onChange={e => setFormData({...formData, location: e.target.value})} 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-4 text-white rounded-xl font-bold transition-all shadow-lg ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
      >
        {loading ? 'Сохранение...' : 'Обновить филиал'}
      </button>
    </form>
  );
}

function InventoryTab({ 
  parts = [], 
  units = [], 
  branches = [],
  machines = [],
  onOpenUnitsModal, 
  onRefresh,
  role
}: { 
  parts?: SparePart[]; 
  units?: UnitOfMeasure[]; 
  branches?: Branch[];
  machines?: Machine[];
  onOpenUnitsModal?: () => void; 
  onRefresh: () => void; 
  role?: Role | null;
}) {
  const canCreatePart = canPerformAction(role, 'inventory.parts_catalog', 'create');
  const canEditPart = canPerformAction(role, 'inventory.parts_catalog', 'edit');
  const canDeletePart = canPerformAction(role, 'inventory.parts_catalog', 'delete');
  const canExportInventory = canPerformAction(role, 'inventory.parts_catalog', 'export') || canPerformAction(role, 'inventory.balances', 'export');

  const safeParts = Array.isArray(parts) ? parts : [];
  const safeUnits = Array.isArray(units) ? units : [];
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [partLightbox, setPartLightbox] = useState<{ images: string[]; initialIndex: number; title?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const lowStockParts = safeParts.filter(p => (p.quantity || 0) <= (p.minQuantity || 0));

  // Warehouse wide totals
  const totalWarehouseSum = safeParts.reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
  const totalWarehouseQty = safeParts.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const lowStockRestockSum = lowStockParts.reduce((acc, p) => acc + (Math.max(0, (p.minQuantity * 2) - p.quantity) * (p.unitPrice || 0)), 0);
  const avgUnitPrice = totalWarehouseQty > 0 ? Math.round(totalWarehouseSum / totalWarehouseQty) : 0;

  // Filtered parts
  const filteredParts = safeParts.filter(part => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      part.name.toLowerCase().includes(q) || 
      (part.sku && part.sku.toLowerCase().includes(q));
    
    // Filter by branch
    let matchesBranch = true;
    if (branchFilter !== 'all') {
      const partMachine = part.machineId ? machines.find(m => m.id === part.machineId) : null;
      matchesBranch = part.branchId === branchFilter || (partMachine?.branchId === branchFilter);
    }

    return matchesSearch && matchesBranch;
  });

  const filteredSum = filteredParts.reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitPrice || 0)), 0);
  const filteredQty = filteredParts.reduce((acc, p) => acc + (p.quantity || 0), 0);

  const handleDelete = async (id: string) => {
    try {
      await machineService.deleteSparePart(id);
      setConfirmDeleteId(null);
      onRefresh();
    } catch (e) {
      alert('Ошибка при удалении' + (e instanceof Error ? `: ${e.message}` : ''));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:max-h-[700px] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
      {/* Top Metrics Banner - Total Warehouse Value & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Total Warehouse Sum */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-3.5 py-2.5 rounded-xl shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-10 pointer-events-none">
            <Receipt className="w-12 h-12" />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1">
                <CircleDollarSign className="w-3 h-3" />
                Общая сумма склада
              </span>
              <span className="bg-white/20 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                Итого
              </span>
            </div>
            <div className="text-lg lg:text-xl font-mono font-black tracking-tight leading-snug">
              {totalWarehouseSum.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <p className="text-[10px] text-blue-100/90 font-medium mt-1 border-t border-white/10 pt-1 flex items-center justify-between">
            <span>Баланс остатков</span>
            <span className="font-bold">{safeParts.length} наим.</span>
          </p>
        </div>

        {/* KPI 2: Total Items Quantity */}
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Boxes className="w-3 h-3 text-blue-600" />
                Всего позиций
              </span>
              <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                Номенклатура
              </span>
            </div>
            <div className="text-lg lg:text-xl font-mono font-bold text-slate-800 leading-snug">
              {safeParts.length}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1 border-t border-slate-100 pt-1 flex items-center justify-between">
            <span>Физический объем:</span>
            <span className="font-bold text-slate-700">{totalWarehouseQty.toLocaleString('ru-RU')} ед.</span>
          </p>
        </div>

        {/* KPI 3: Average Unit Cost */}
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Tag className="w-3 h-3 text-emerald-600" />
                Средняя цена ед.
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                Расчетная
              </span>
            </div>
            <div className="text-lg lg:text-xl font-mono font-bold text-slate-800 leading-snug">
              {avgUnitPrice.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1 border-t border-slate-100 pt-1 flex items-center justify-between">
            <span>Средневзвешенная</span>
            <span className="font-bold text-emerald-600">на складе</span>
          </p>
        </div>

        {/* KPI 4: Low Stock Alert & Sum to order */}
        <div className={`px-3.5 py-2.5 rounded-xl border shadow-xs flex flex-col justify-between transition-all ${
          lowStockParts.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                lowStockParts.length > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}>
                <AlertCircle className={`w-3 h-3 ${lowStockParts.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                Критический запас
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                lowStockParts.length > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {lowStockParts.length > 0 ? 'Требует заказа' : 'В норме'}
              </span>
            </div>
            <div className={`text-lg lg:text-xl font-mono font-bold leading-snug ${
              lowStockParts.length > 0 ? 'text-rose-700' : 'text-slate-800'
            }`}>
              {lowStockParts.length} <span className="text-[11px] font-normal text-slate-500">поз.</span>
            </div>
          </div>
          <div className="mt-1 border-t border-rose-200/60 pt-1 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">К закупке:</span>
            <span className="font-bold font-mono text-rose-700">{lowStockRestockSum.toLocaleString('ru-RU')} ₽</span>
          </div>
        </div>
      </div>

      {/* Top action bar and filter controls */}
      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2 w-full min-w-0">
          <div className="relative flex-1 basis-40 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск запчасти по наименованию или артикулу SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-10 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-auto min-w-0">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-auto min-w-0 min-h-10 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[130px] truncate"
              title="Фильтр по филиалу"
            >
              <option value="all">🏢 Все филиалы</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>🏢 {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase font-black tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Наименование</th>
                <th className="px-4 py-4">Артикул / SKU</th>
                <th className="px-4 py-4">В наличии</th>
                <th className="px-4 py-4">Мин. запас</th>
                <th className="px-4 py-4">Цена / ЕД</th>
                <th className="px-5 py-4 bg-blue-50/60 text-blue-900">Итого сумма (₽)</th>
                <th className="px-4 py-4">Статус</th>
                <th className="px-6 py-4 text-right">Управление</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredParts.map(part => {
                const rowTotalSum = (part.quantity || 0) * (part.unitPrice || 0);
                const isLow = (part.quantity || 0) <= (part.minQuantity || 0);
                const isOut = (part.quantity || 0) <= 0;
                const partImages = (part.imageUrls && part.imageUrls.length > 0)
                  ? part.imageUrls
                  : (part.imageUrl ? [part.imageUrl] : []);

                return (
                  <tr key={part.id} className="hover:bg-blue-50/30 group transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {partImages.length > 0 ? (
                          <div 
                            onClick={() => setPartLightbox({ images: partImages, initialIndex: 0, title: `Запчасть: ${part.name}` })}
                            className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 shrink-0 cursor-pointer group/img hover:ring-2 hover:ring-blue-500 transition-all"
                            title="Нажмите для просмотра фото"
                          >
                            <img 
                              src={partImages[0]} 
                              alt={part.name} 
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform" 
                              referrerPolicy="no-referrer"
                            />
                            {partImages.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-black px-1 rounded-sm leading-tight">
                                +{partImages.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                            <Boxes className="w-5 h-5 opacity-40" />
                          </div>
                        )}
                        <div className="min-w-48">
                          <p className="font-bold text-slate-800 break-words">{part.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">ЕИ: {part.unit || 'шт'}</span>
                            {part.machineId ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold" title="Привязана к оборудованию">
                                🎯 {machines.find(m => m.id === part.machineId)?.name || 'Станок'}
                              </span>
                            ) : part.branchId ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold" title="Привязана к филиалу">
                                🏢 {branches.find(b => b.id === part.branchId)?.name || 'Филиал'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-mono text-xs font-semibold whitespace-nowrap">
                      {part.sku || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black font-mono whitespace-nowrap ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                          {part.quantity} {part.unit || 'шт'}
                        </span>
                        {isLow && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-bold font-mono whitespace-nowrap">
                      {part.minQuantity} {part.unit || 'шт'}
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-xs font-mono font-medium whitespace-nowrap">
                      {(part.unitPrice || 0).toLocaleString('ru-RU')} ₽
                    </td>
                    {/* Итого сумма по позиции */}
                    <td className="px-5 py-4 bg-blue-50/30 font-mono font-black text-sm text-blue-900 whitespace-nowrap">
                      {rowTotalSum.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-4">
                      {isOut ? (
                        <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-xs border border-rose-200 whitespace-nowrap">
                          Нет на складе
                        </span>
                      ) : isLow ? (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-xs border border-amber-200 whitespace-nowrap">
                          Низкий запас
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-200 whitespace-nowrap">
                          В норме
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {confirmDeleteId === part.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleDelete(part.id)}
                            className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg hover:bg-rose-700 transition-all cursor-pointer"
                          >
                            Да, удалить
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {canEditPart && (
                            <button 
                              onClick={() => setEditingPart(part)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="Редактировать запчасть"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDeletePart && (
                            <button 
                              onClick={() => setConfirmDeleteId(part.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Удалить запчасть"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!canEditPart && !canDeletePart && (
                            <span className="text-[11px] text-slate-400 italic">Только просмотр</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredParts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Boxes className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-bold text-slate-600">Запчастей не найдено</p>
                    <p className="text-xs text-slate-400 mt-1">Попробуйте изменить параметры поиска или фильтров</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Итоговая строка таблицы (Table Footer) */}
            {filteredParts.length > 0 && (
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-xs text-slate-700">
                <tr>
                  <td className="px-6 py-4 uppercase font-black tracking-wider text-slate-800">
                    ИТОГО ({filteredParts.length} поз.):
                  </td>
                  <td className="px-4 py-4 text-slate-400">—</td>
                  <td className="px-4 py-4 font-mono font-black text-slate-900">
                    {filteredQty.toLocaleString('ru-RU')} ед.
                  </td>
                  <td className="px-4 py-4 text-slate-400">—</td>
                  <td className="px-4 py-4 text-slate-500 font-mono text-[11px]">
                    Ср. {Math.round(filteredQty > 0 ? filteredSum / filteredQty : 0).toLocaleString('ru-RU')} ₽
                  </td>
                  {/* Главная общая итоговая сумма */}
                  <td className="px-5 py-4 bg-blue-100/80 font-mono font-black text-base text-blue-950 border-l border-r border-blue-200">
                    {filteredSum.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-4 py-4 text-slate-400">—</td>
                  <td className="px-6 py-4 text-right text-[11px] text-slate-400 uppercase tracking-widest">
                    Всего на складе
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Edit Part Modal */}
      <Modal 
        isOpen={!!editingPart} 
        onClose={() => setEditingPart(null)} 
        title={editingPart ? `Редактировать запчасть: ${editingPart.name}` : 'Редактировать запчасть'}
      >
        {editingPart && (
          <EditPartForm 
            part={editingPart}
            units={safeUnits}
            branches={branches}
            machines={machines}
            onOpenUnitsModal={() => {
              if (onOpenUnitsModal) onOpenUnitsModal();
            }}
            onComplete={() => {
              setEditingPart(null);
              onRefresh();
            }}
          />
        )}
      </Modal>

      {/* Part Lightbox Modal */}
      <LightboxModal 
        isOpen={!!partLightbox} 
        onClose={() => setPartLightbox(null)} 
        images={partLightbox?.images || []} 
        initialIndex={partLightbox?.initialIndex || 0}
        title={partLightbox?.title} 
      />
    </div>
  );
}

function ReportsTab({ machines, branches, logs, parts, role }: { machines: Machine[], branches: Branch[], logs: MaintenanceLog[], parts: SparePart[], role: Role | null }) {
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [filterMachineId, setFilterMachineId] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });

  const canEquipment = canPerformAction(role, 'reports.equipment_report', 'view');
  const canToir = canPerformAction(role, 'reports.toir_report', 'view');
  const canInventory = canPerformAction(role, 'reports.inventory_report', 'view');
  const canSummary = canPerformAction(role, 'reports.summary_report', 'view');
  const canExport = canPerformAction(role, 'reports.equipment_report', 'export') || 
                    canPerformAction(role, 'reports.summary_report', 'export') ||
                    canPerformAction(role, 'reports.toir_report', 'export') ||
                    canPerformAction(role, 'reports.inventory_report', 'export');

  const hasAnyReport = canEquipment || canToir || canInventory || canSummary;

  if (!hasAnyReport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">
          Доступ к аналитическим отчетам отключен
        </h3>
        <p className="text-xs text-slate-500 max-w-md mb-2 leading-relaxed">
          В матрице прав для роли «<strong className="text-slate-800 font-bold">{role?.name || 'Пользователь'}</strong>» отключены все галочки в разделе «Отчеты».
        </p>
        <p className="text-[11px] text-slate-400 max-w-md">
          Для включения доступа администратор должен активировать необходимые права в окне «Пользователи и роли» → «Матрица прав».
        </p>
      </div>
    );
  }

  const filteredMachines = machines.filter(m => filterBranchId === 'all' || m.branchId === filterBranchId);
  
  const relevantLogs = logs.filter(log => {
    const machine = machines.find(m => m.id === log.machineId);
    const matchesBranch = filterBranchId === 'all' || machine?.branchId === filterBranchId;
    const matchesMachine = filterMachineId === 'all' || log.machineId === filterMachineId;
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesDate = (!dateRange.start || log.date >= dateRange.start) && (!dateRange.end || log.date <= dateRange.end);
    return matchesBranch && matchesMachine && matchesType && matchesDate;
  });

  const totalValue = filteredMachines.reduce((acc, m) => acc + machineService.calculateCurrentValue(m), 0);
  const totalMaintenanceCost = relevantLogs.reduce((acc, l) => acc + (l.cost || 0), 0);

  const totalPartsUsedCost = relevantLogs.reduce((acc, l) => {
    const partsCost = l.partsUsed?.reduce((pAcc, p) => {
      const matched = parts.find(sp => sp.id === p.partId || sp.name?.trim().toLowerCase() === p.name?.trim().toLowerCase());
      const price = matched?.unitPrice || 0;
      return pAcc + ((p.quantity || 0) * price);
    }, 0) || 0;
    return acc + partsCost;
  }, 0);

  const totalPartsUsedQty = relevantLogs.reduce((acc, l) => {
    return acc + (l.partsUsed?.reduce((pAcc, p) => pAcc + (p.quantity || 0), 0) || 0);
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-8 overflow-auto pb-20 px-1 custom-scrollbar">
      {/* Search & Filter Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Панель управления отчетом
          </h3>
          {canExport && (
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 min-h-10 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4" />
              Печать отчета
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Филиал</label>
            <select 
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
              value={filterBranchId}
              onChange={(e) => { setFilterBranchId(e.target.value); setFilterMachineId('all'); }}
            >
              <option value="all">Все филиалы</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Станок</label>
            <select 
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
              value={filterMachineId}
              onChange={(e) => setFilterMachineId(e.target.value)}
            >
              <option value="all">Все оборудование</option>
              {machines
                .filter(m => filterBranchId === 'all' || m.branchId === filterBranchId)
                .map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Тип работ</label>
             <select 
               className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value)}
             >
               <option value="all">Любые работы</option>
               <option value="routine">Плановое ТО</option>
               <option value="repair">Ремонт</option>
               <option value="inspection">Инспекция</option>
             </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Начало периода</label>
            <input 
              type="date" 
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Конец периода</label>
            <input 
              type="date" 
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 sm:gap-6">
        {canEquipment && (
          <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl min-w-0">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Стоимость активов</p>
            <p className="text-xl sm:text-2xl font-mono font-black wrap-anywhere">{totalValue.toLocaleString()} ₽</p>
            <p className="text-[10px] text-slate-500 mt-2">На основе текущих фильтров</p>
          </div>
        )}
        {canToir && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Затраты на ТО / Ремонт</p>
            <p className="text-xl sm:text-2xl font-mono font-black text-rose-600 wrap-anywhere">{totalMaintenanceCost.toLocaleString()} ₽</p>
            <p className="text-[10px] text-slate-400 mt-2 uppercase">{relevantLogs.length} операций проведено</p>
          </div>
        )}
        {canInventory && (
          <>
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Баланс склада (Общий)</p>
              <p className="text-xl sm:text-2xl font-mono font-black text-blue-600 wrap-anywhere">
                {parts.reduce((acc, p) => acc + (p.quantity * (p.unitPrice || 0)), 0).toLocaleString()} ₽
              </p>
              <p className="text-[10px] text-slate-400 mt-2 uppercase">{parts.length} наименований</p>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Расход запчастей</p>
              <p className="text-xl sm:text-2xl font-mono font-black text-amber-600 wrap-anywhere">
                {totalPartsUsedCost.toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-[10px] text-slate-400 mt-2 uppercase">Использовано {totalPartsUsedQty} ед. запчастей</p>
            </div>
          </>
        )}
      </div>

      {canEquipment && (
        filterMachineId !== 'all' ? (
          <div className="bg-white p-4 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 min-w-0 break-words">
                <TrendingDown className="w-5 h-5 text-blue-600 shrink-0" />
                Прогноз амортизационной стоимости: {machines.find(m => m.id === filterMachineId)?.name}
              </h3>
            </div>
            <div className="h-64 sm:h-80 w-full">
              <DepreciationChart machine={machines.find(m => m.id === filterMachineId)!} />
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 min-w-0 break-words">
                <TrendingDown className="w-5 h-5 text-indigo-600 shrink-0" />
                Сводный прогноз амортизации активов
              </h3>
            </div>
            <div className="h-64 sm:h-80 w-full">
              <TotalDepreciationChart machines={filteredMachines} />
            </div>
          </div>
        )
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-8">
        <div className="xl:col-span-2 space-y-4 sm:space-y-8 min-w-0">
           {/* Branch Performance Summary */}
           {canSummary && (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Сводка по подразделениям
                </h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50/20">
                      <th className="px-6 py-4">Филиал</th>
                      <th className="px-6 py-4">Оборудование</th>
                      <th className="px-6 py-4">Исправность</th>
                      <th className="px-6 py-4 text-right">Общие расходы</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {branches.map(branch => {
                      const branchMachines = machines.filter(m => m.branchId === branch.id);
                      const branchLogs = logs.filter(l => branchMachines.some(m => m.id === l.machineId));
                      const branchSpending = branchLogs.reduce((acc, l) => acc + (l.cost || 0), 0);
                      const uptime = branchMachines.length > 0 ? (branchMachines.filter(m => m.status === 'active').length / branchMachines.length * 100) : 0;
                      
                      return (
                        <tr key={branch.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800 min-w-40">{branch.name}</td>
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{branchMachines.length} шт</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${uptime > 90 ? 'bg-emerald-500' : uptime > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{width: `${uptime}%`}} />
                              </div>
                              <span className="text-[10px] font-mono font-bold">{uptime.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{branchSpending.toLocaleString()} ₽</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
           )}

          {/* Machine Cost Analysis Table */}
          {canToir && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4 text-blue-500" />
                  Журнал обслуживания и ремонтов
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Выборка: {relevantLogs.length} событий</span>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Дата / Станок</th>
                      <th className="px-6 py-4">Вид работ</th>
                      <th className="px-6 py-4">Запчасти</th>
                      <th className="px-6 py-4 text-right">Стоимость</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {relevantLogs.map(log => {
                      const machine = machines.find(m => m.id === log.machineId);
                      return (
                        <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-xs font-mono text-slate-400 mb-0.5">{new Date(log.date).toLocaleDateString('ru-RU')}</p>
                            <p className="font-bold text-slate-800 leading-tight min-w-40">{machine?.name || '—'}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase">{machine?.model}</p>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block mb-1 ${
                               log.type === 'repair' ? 'bg-rose-100 text-rose-700' : 
                               log.type === 'routine' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                             }`}>
                               {log.type === 'routine' ? 'Плановое ТО' : log.type === 'repair' ? 'Аварийный ремонт' : 'Инспекция'}
                             </span>
                             <p className="text-xs text-slate-600 italic line-clamp-1 truncate w-40">"{log.notes}"</p>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1">
                               {log.partsUsed?.map((p: any, i: number) => (
                                 <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                   {p.name} (x{p.quantity})
                                 </span>
                               )) || '—'}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900 whitespace-nowrap">{(log.cost || 0).toLocaleString()} ₽</td>
                        </tr>
                      );
                    })}
                    {relevantLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400 italic">Нет данных по заданным условиям</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Top 5 Most Expensive Machines */}
          {canToir && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Самые затратные станки
              </h3>
              <div className="space-y-4">
                {(() => {
                  const machineSpending: { [key: string]: { name: string, model?: string, cost: number } } = {};
                  logs.forEach(l => {
                    const m = machines.find(x => x.id === l.machineId);
                    // Exclude deleted machines that no longer exist in the system
                    if (!m) return;
                    if (filterBranchId !== 'all' && m.branchId !== filterBranchId) return;

                    if (!machineSpending[l.machineId]) {
                      machineSpending[l.machineId] = { name: m.name, model: m.model, cost: 0 };
                    }
                    machineSpending[l.machineId].cost += (l.cost || 0);
                  });

                  const topMachines = Object.entries(machineSpending)
                    .filter(([_, data]) => data.cost > 0)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .slice(0, 5);

                  if (topMachines.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 text-xs italic">
                        Нет данных по затратам на действующие станки
                      </div>
                    );
                  }

                  return topMachines.map(([id, data]) => (
                    <div key={id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <div className="min-w-0 pr-4">
                          <p className="text-xs font-bold text-slate-800 truncate">{data.name}</p>
                          {data.model && <p className="text-[10px] text-slate-400 font-mono truncate">{data.model}</p>}
                        </div>
                        <p className="text-xs font-mono font-black text-rose-600 shrink-0">{data.cost.toLocaleString()} ₽</p>
                      </div>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, data.cost / 100000 * 100)}%` }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Spare Parts Usage Ranking */}
          {canInventory && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-500" />
                Расход запчастей (ТОП-5)
              </h3>
              <div className="space-y-4">
                {(() => {
                  const partsFreq: { [key: string]: { name: string, qty: number, unitPrice: number, totalCost: number, unit: string, sku?: string } } = {};
                  logs.forEach(l => {
                    const m = machines.find(x => x.id === l.machineId);
                    if (!m) return;
                    if (filterBranchId !== 'all' && m.branchId !== filterBranchId) return;

                    l.partsUsed?.forEach((p: any) => {
                      if (!p || (!p.partId && !p.name)) return;
                      const key = p.partId || p.name;
                      const matchedPart = parts.find(sp => sp.id === p.partId || sp.name?.trim().toLowerCase() === p.name?.trim().toLowerCase());
                      const unitPrice = matchedPart?.unitPrice || 0;
                      const unit = matchedPart?.unit || 'шт';
                      const sku = matchedPart?.sku || '';

                      if (!partsFreq[key]) {
                        partsFreq[key] = {
                          name: p.name || matchedPart?.name || 'Запчасть',
                          qty: 0,
                          unitPrice,
                          totalCost: 0,
                          unit,
                          sku
                        };
                      }
                      partsFreq[key].qty += (p.quantity || 0);
                      partsFreq[key].totalCost += (p.quantity || 0) * unitPrice;
                    });
                  });

                  const topParts = Object.entries(partsFreq)
                    .filter(([_, data]) => data.qty > 0)
                    .sort((a, b) => b[1].qty - a[1].qty || b[1].totalCost - a[1].totalCost)
                    .slice(0, 5);

                  if (topParts.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 text-xs italic">
                        Нет данных по расходу запчастей
                      </div>
                    );
                  }

                  const maxCost = Math.max(...topParts.map(p => p[1].totalCost), 1);

                  return topParts.map(([id, data]) => {
                    const costPercent = Math.min(100, Math.round((data.totalCost / maxCost) * 100));

                    return (
                      <div key={id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate" title={data.name}>
                              {data.name}
                            </p>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-slate-500 font-medium">
                              <span>Расход: <strong className="text-slate-800 font-bold">{data.qty} {data.unit}</strong></span>
                              {data.unitPrice > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Цена: <strong className="text-slate-700">{data.unitPrice.toLocaleString('ru-RU')} ₽/{data.unit}</strong></span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono font-black text-blue-600">
                              {data.totalCost > 0 ? `${data.totalCost.toLocaleString('ru-RU')} ₽` : '—'}
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Сумма
                            </span>
                          </div>
                        </div>
                        {data.totalCost > 0 && (
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all" 
                              style={{ width: `${Math.max(5, costPercent)}%` }} 
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface HistoryTabProps {
  logs: ActivityLog[];
  machines: Machine[];
  branches: Branch[];
  parts: SparePart[];
  maintenanceLogs: MaintenanceLog[];
  role?: Role | null;
}

function HistoryTab({ logs, machines, branches, parts, maintenanceLogs, role }: HistoryTabProps) {
  const canViewActivity = canPerformAction(role, 'history.activity_log', 'view');
  const canViewTransfers = canPerformAction(role, 'history.equipment_history', 'view');
  const canViewDeletions = canPerformAction(role, 'history.audit_deletions', 'view');
  const canExportHistory = canPerformAction(role, 'history.activity_log', 'export') || canPerformAction(role, 'history.audit_deletions', 'export');

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return <PlusCircle className="w-5 h-5 text-emerald-600" />;
      case 'update':
        return <Wrench className="w-5 h-5 text-amber-600" />;
      case 'delete':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'transfer':
        return <MoveHorizontal className="w-5 h-5 text-indigo-600" />;
      default:
        return <History className="w-5 h-5 text-blue-600" />;
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'update':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'delete':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'transfer':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'create': return 'Создание';
      case 'update': return 'Изменение';
      case 'delete': return 'Удаление';
      case 'transfer': return 'Перемещение';
      default: return 'Прочее';
    }
  };

  const getEntityLabel = (entityType: string) => {
    switch (entityType) {
      case 'machine': return 'Станок';
      case 'branch': return 'Филиал';
      case 'part': return 'Запчасть';
      case 'schedule': return 'Период. ТО';
      case 'log': return 'Обслуживание';
      case 'transfer': return 'Перемещение';
      default: return 'Объект';
    }
  };

  const filteredLogs = logs.filter(log => {
    // Permission checks by action type
    if (log.actionType === 'delete' && !canViewDeletions) return false;
    if (log.actionType === 'transfer' && !canViewTransfers) return false;
    if ((log.actionType === 'create' || log.actionType === 'update') && !canViewActivity) return false;

    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.entityName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;
    return matchesSearch && matchesAction && matchesEntity;
  });

  return (
    <div className="flex flex-col h-full space-y-4 sm:space-y-6 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Поиск по истории изменений или объекту..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-10 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        <div className="flex gap-2 sm:gap-4 w-full lg:w-auto min-w-0">
          <select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
            className="flex-1 lg:flex-none min-w-0 min-h-10 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все действия</option>
            <option value="create">Создание</option>
            <option value="update">Изменение</option>
            <option value="delete">Удаление</option>
            <option value="transfer">Перемещение</option>
          </select>
          <select 
            value={entityFilter} 
            onChange={(e) => setEntityFilter(e.target.value)}
            className="flex-1 lg:flex-none min-w-0 min-h-10 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все объекты</option>
            <option value="machine">Станки</option>
            <option value="branch">Филиалы</option>
            <option value="part">Запчасти</option>
            <option value="schedule">Период. ТО</option>
            <option value="log">Обслуживание</option>
          </select>
          {canExportHistory && (
            <button
              onClick={() => window.print()}
              className="min-h-10 min-w-10 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs active:scale-95"
              title="Печать журнала действий"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Печать</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <History className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg font-bold">Записей в истории не найдено</p>
              <p className="text-sm mt-1">Попробуйте изменить параметры поиска или действия.</p>
            </div>
          ) : (
            <div className="relative border-l border-slate-200 ml-3 md:ml-6 pl-6 md:pl-8 space-y-8 py-3">
              {filteredLogs.map((log) => {
                // Determine small additional context to display inline
                let extraInfo = null;
                if (log.entityType === 'machine') {
                  const m = machines.find(x => x.id === log.entityId);
                  if (m) {
                    const br = branches.find(b => b.id === m.branchId);
                    extraInfo = (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        {br && <span>📍 Филиал: <strong className="text-slate-700">{br.name}</strong></span>}
                        {m.manufacturer && <span>• Производитель: <strong className="text-slate-700">{m.manufacturer}</strong></span>}
                        {m.model && <span>• Модель: <strong className="text-slate-700">{m.model}</strong></span>}
                        {m.status && (
                          <span>
                            • Статус: <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {m.status === 'active' ? 'в работе' : m.status === 'maintenance' ? 'на ТО' : m.status === 'repair' ? 'в ремонте' : 'списан'}
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  }
                } else if (log.entityType === 'branch') {
                  const b = branches.find(x => x.id === log.entityId);
                  if (b) {
                    extraInfo = (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        {b.location && <span>📍 Адрес: <strong className="text-slate-700">{b.location}</strong></span>}
                        {b.contactPerson && <span>• Контакт: <strong className="text-slate-700">{b.contactPerson}</strong></span>}
                      </div>
                    );
                  }
                } else if (log.entityType === 'part') {
                  const p = parts.find(x => x.id === log.entityId);
                  if (p) {
                    extraInfo = (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        {p.sku && <span>📦 SKU: <strong className="text-slate-700">{p.sku}</strong></span>}
                        <span>• На складе: <strong className="text-slate-700">{p.quantity} шт.</strong></span>
                        {p.unitPrice !== undefined && <span>• Цена: <strong className="text-slate-700">{p.unitPrice.toLocaleString('ru-RU')} ₽</strong></span>}
                      </div>
                    );
                  }
                } else if (log.entityType === 'log') {
                  const ml = maintenanceLogs.find(x => x.id === log.entityId);
                  if (ml) {
                    const machine = machines.find(m => m.id === ml.machineId);
                    const br = machine ? branches.find(b => b.id === machine.branchId) : null;
                    const partsStr = ml.partsUsed && ml.partsUsed.length > 0
                      ? ml.partsUsed.map(p => `${p.name} (x${p.quantity})`).join(', ')
                      : null;
                    extraInfo = (
                      <div className="mt-2 text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {machine && <span>⚙️ Станок: <strong className="text-slate-700">{machine.name}</strong></span>}
                          {br && <span>• Филиал: <strong className="text-slate-700">{br.name}</strong></span>}
                          {ml.technicianName && <span>• Мастер: <strong className="text-slate-700">{ml.technicianName}</strong></span>}
                          {ml.cost !== undefined && (
                            <span>• Затраты: <strong className="text-emerald-700 font-bold">{ml.cost.toLocaleString('ru-RU')} ₽</strong></span>
                          )}
                        </div>
                        {partsStr && (
                          <div className="text-[11px] text-slate-500">
                            📦 Запчасти: <span className="font-semibold text-slate-700">{partsStr}</span>
                          </div>
                        )}
                        {ml.notes && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 italic w-fit mt-1">
                            "{ml.notes}"
                          </div>
                        )}
                      </div>
                    );
                  }
                }

                return (
                  <div key={log.id} className="relative group">
                    <div className="absolute -left-[37px] md:-left-[45px] top-1 bg-white p-1 rounded-full border border-slate-200 shadow-sm group-hover:scale-110 transition-transform flex items-center justify-center">
                      {getActionIcon(log.actionType)}
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-lg hover:bg-slate-100/50 transition-colors min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getActionBadgeColor(log.actionType)}`}>
                            {getActionLabel(log.actionType)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300 uppercase">
                            {getEntityLabel(log.entityType)}
                          </span>
                          <span className="font-semibold text-slate-800 text-sm min-w-0 break-words">{log.entityName}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium break-words">{log.details}</p>

                      {extraInfo}

                      {log.userEmail && (
                        <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex flex-wrap items-center gap-1 border-t border-slate-100 pt-1.5">
                          <span>Администратор:</span>
                          <span className="text-slate-500 font-mono lowercase break-all">{log.userEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


