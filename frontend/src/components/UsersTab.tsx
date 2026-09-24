import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  ShieldCheck, 
  Search,
  Filter,
  Copy,
  Check,
  Pencil,
  Trash2,
  Building2,
  Briefcase,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { AppUser, Role, Branch } from '../types';
import { userService, canPerformAction, canAccessTab } from '../services/userService';
import { RolePermissionModal } from './RolePermissionModal';
import { UserModal } from './UserModal';

interface UsersTabProps {
  users: AppUser[];
  roles: Role[];
  branches: Branch[];
  activeAppUser: AppUser | null;
  onSelectActiveUser: (user: AppUser | null) => void;
  onRefresh?: () => void;
  role?: Role | null;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  users,
  roles,
  branches,
  activeAppUser,
  onSelectActiveUser,
  onRefresh,
  role
}) => {
  const canCreateUser = canPerformAction(role, 'users.user_list', 'create');
  const canEditUser = canPerformAction(role, 'users.user_list', 'edit');
  const canDeleteUser = canPerformAction(role, 'users.user_list', 'delete');
  const canCreateRole = canPerformAction(role, 'users.roles_matrix', 'create');
  const canEditRole = canPerformAction(role, 'users.roles_matrix', 'edit');
  const canDeleteRole = canPerformAction(role, 'users.roles_matrix', 'delete');
  const canEditCredentials = canPerformAction(role, 'users.credentials', 'edit');

  const [activeSection, setActiveSection] = useState<'users' | 'roles'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.position && u.position.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = selectedRoleFilter === 'all' || u.roleId === selectedRoleFilter;
    const matchesBranch = selectedBranchFilter === 'all' || u.branchId === selectedBranchFilter;
    const matchesStatus = selectedStatusFilter === 'all' || u.status === selectedStatusFilter;

    return matchesSearch && matchesRole && matchesBranch && matchesStatus;
  });

  // User save handler
  const handleSaveUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    if (editingUser) {
      await userService.updateUser(editingUser.id, userData);
      if (activeAppUser?.id === editingUser.id) {
        onSelectActiveUser({ ...editingUser, ...userData });
      }
    } else {
      await userService.createUser(userData);
    }
    setEditingUser(null);
    onRefresh?.();
  };

  // Role save handler
  const handleSaveRole = async (roleData: { name: string; description?: string; color?: string; permissions: any }) => {
    if (editingRole) {
      await userService.updateRole(editingRole.id, roleData);
    } else {
      await userService.createRole(roleData);
    }
    setEditingRole(null);
    onRefresh?.();
  };

  // Handle role duplicate
  const handleDuplicateRole = async (role: Role) => {
    await userService.createRole({
      name: `${role.name} (Копия)`,
      description: role.description || '',
      color: role.color || '#f97316',
      permissions: { ...role.permissions }
    });
    onRefresh?.();
  };

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await userService.deleteUser(deletingUser.id, deletingUser.fullName);
    } catch (err) {
      alert('Ошибка при удалении пользователя' + (err instanceof Error ? `: ${err.message}` : ''));
      return;
    }
    if (activeAppUser?.id === deletingUser.id) {
      onSelectActiveUser(null);
    }
    setDeletingUser(null);
    onRefresh?.();
  };

  // Confirm delete role
  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    try {
      await userService.deleteRole(deletingRole.id, deletingRole.name);
    } catch (err) {
      alert('Ошибка при удалении роли' + (err instanceof Error ? `: ${err.message}` : ''));
      return;
    }
    setDeletingRole(null);
    onRefresh?.();
  };

  // Count metrics
  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const rolesCount = roles.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-7 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight break-words">
                  Пользователи и права доступа
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Управление персоналом предприятия, учетными записями, паролями и ролями
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {canCreateUser && (
              <button
                onClick={() => {
                  setEditingUser(null);
                  setIsUserModalOpen(true);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Добавить пользователя</span>
              </button>
            )}

            {canCreateRole && (
              <button
                onClick={() => {
                  setEditingRole(null);
                  setIsRoleModalOpen(true);
                }}
                className="flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] active:bg-[#c2410c] text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Shield className="w-4 h-4" />
                <span>Добавить роль</span>
              </button>
            )}
          </div>
        </div>

        {/* Section Navigation Switcher */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100">
          <button
            onClick={() => setActiveSection('users')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeSection === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Сотрудники</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {totalUsersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('roles')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeSection === 'roles'
                ? 'border-[#f97316] text-[#ea580c]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Роли и матрица прав</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-mono">
              {rolesCount}
            </span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider wrap-anywhere text-slate-400">Всего сотрудников</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">{totalUsersCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider wrap-anywhere text-emerald-600">Активных учетных записей</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 mt-1">{activeUsersCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider wrap-anywhere text-orange-600">Сконфигурировано ролей</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-orange-600 mt-1">{rolesCount}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider wrap-anywhere text-blue-600">Филиалов предприятия</p>
          <p className="text-xl sm:text-2xl font-black font-mono text-blue-600 mt-1">{branches.length || 1}</p>
        </div>
      </div>

      {/* SECTION 1: USERS */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по ФИО, логину, должности или email..."
                className="w-full min-h-10 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div className="w-full md:w-48">
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="w-full min-h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="all">Все роли ({roles.length})</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div className="w-full md:w-48">
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="w-full min-h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="all">Все филиалы</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-36">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full min-h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="blocked">Заблокированные</option>
              </select>
            </div>
          </div>

          {/* Users Grid */}
          {filteredUsers.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700">Пользователи не найдены</p>
              <p className="text-xs text-slate-400 mt-1">Попробуйте изменить параметры поиска или добавьте нового сотрудника</p>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setIsUserModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                <UserPlus className="w-4 h-4" />
                Добавить первого пользователя
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((u) => {
                const userRole = roles.find(r => r.id === u.roleId);
                const isCurrentActive = activeAppUser?.id === u.id;

                return (
                  <div
                    key={u.id}
                    className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                      isCurrentActive ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* User Top Row: Avatar + Name + Status */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div 
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                            style={{ backgroundColor: userRole?.color || '#3b82f6' }}
                          >
                            {u.fullName.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm leading-tight break-words min-w-0">
                                {u.fullName}
                              </h3>
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
                                  Вы
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                              {u.position || 'Сотрудник'}
                            </p>
                          </div>
                        </div>

                        {/* Status badge */}
                        {canEditUser ? (
                          <button
                            onClick={async () => {
                              const newStatus = u.status === 'active' ? 'blocked' : 'active';
                              try {
                                await userService.updateUser(u.id, { status: newStatus });
                              } catch (err) {
                                alert('Ошибка при смене статуса' + (err instanceof Error ? `: ${err.message}` : ''));
                                return;
                              }
                              onRefresh?.();
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                              u.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                            title="Нажмите для смены статуса"
                          >
                            {u.status === 'active' ? '● Активен' : '✕ Заблокирован'}
                          </button>
                        ) : (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 select-none ${
                              u.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                            title="Текущий статус учетной записи"
                          >
                            {u.status === 'active' ? '● Активен' : '✕ Заблокирован'}
                          </span>
                        )}
                      </div>

                      {/* Role & Branch Badges */}
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <span 
                          className="text-[11px] px-2.5 py-1 rounded-lg font-bold text-white shadow-2xs flex items-center gap-1"
                          style={{ backgroundColor: userRole?.color || '#f97316' }}
                        >
                          <Shield className="w-3 h-3" />
                          {userRole?.name || u.roleName || 'Пользователь'}
                        </span>

                        <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {u.branchName || 'Все филиалы'}
                        </span>
                      </div>

                      {/* Login Card */}
                      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                        {/* Username */}
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                          <span className="text-slate-400 font-medium">Логин:</span>
                          <span className="font-mono font-bold text-slate-800 select-all bg-white px-2 py-0.5 rounded border border-slate-200">
                            {u.username}
                          </span>
                        </div>

                        {/* Email & Phone if present */}
                        {(u.email || u.phone) && (
                          <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            {u.email && <span className="truncate max-w-[150px]">{u.email}</span>}
                            {u.phone && <span>{u.phone}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Card Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isCurrentActive && (
                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Текущий сеанс</span>
                          </div>
                        )}
                      </div>

                      {(canEditUser || canDeleteUser) && (
                        <div className="flex items-center gap-1">
                          {canEditUser && (
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setIsUserModalOpen(true);
                              }}
                              className="min-h-10 min-w-10 flex items-center justify-center p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Редактировать сотрудника"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDeleteUser && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="min-h-10 min-w-10 flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Удалить пользователя"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: ROLES & PERMISSIONS */}
      {activeSection === 'roles' && (
        <div className="space-y-5">
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>Матрица прав доступа:</strong> Каждая роль определяет, к каким справочникам, складам, производственным модулям и отчетам имеет доступ сотрудник. Для детальной настройки нажмите <strong>«Настроить права»</strong> на карточке роли.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {roles.map((r) => {
              const assignedCount = users.filter(u => u.roleId === r.id).length;
              
              // Count granted permissions
              let grantedCount = 0;
              let totalCount = 0;
              if (r.permissions) {
                Object.values(r.permissions).forEach((item: any) => {
                  if (item?.menu) grantedCount++;
                  if (item?.view) grantedCount++;
                  if (item?.create) grantedCount++;
                  if (item?.edit) grantedCount++;
                  if (item?.delete) grantedCount++;
                  if (item?.export) grantedCount++;
                  totalCount += 6;
                });
              }


              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{ backgroundColor: r.color || '#f97316' }}
                        >
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base break-words">
                              {r.name}
                            </h3>
                            {r.isSystem && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wider">
                                Базовая
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            {assignedCount} {assignedCount === 1 ? 'сотрудник' : 'сотрудников'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed min-h-[36px]">
                      {r.description || 'Пользовательская роль с индивидуальным набором прав'}
                    </p>

                    {/* Permissions summary */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span>Активно полномочий:</span>
                        <strong className="text-slate-800 font-mono">
                          {grantedCount} из {totalCount || 186}
                        </strong>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, Math.round((grantedCount / (totalCount || 1)) * 100))}%`,
                            backgroundColor: r.color || '#f97316' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {(canEditRole || canCreateRole || (canDeleteRole && !r.isSystem)) && (
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {canEditRole && (
                        <button
                          onClick={() => {
                            setEditingRole(r);
                            setIsRoleModalOpen(true);
                          }}
                          className="flex-1 min-h-10 flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-[#ea580c] py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Настроить права</span>
                        </button>
                      )}

                      {canCreateRole && (
                        <button
                          onClick={() => handleDuplicateRole(r)}
                          className="min-h-10 min-w-10 flex items-center justify-center p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Дублировать роль"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canDeleteRole && !r.isSystem && (
                        <button
                          onClick={() => setDeletingRole(r)}
                          className="min-h-10 min-w-10 flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Удалить роль"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Role Permission Modal (Matching Screenshots рол 1, 2, 3) */}
      <RolePermissionModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
        }}
        role={editingRole}
        onSave={handleSaveRole}
      />

      {/* User Modal */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
        }}
        user={editingUser}
        roles={roles}
        branches={branches}
        onSave={handleSaveUser}
        canEditCredentials={canEditCredentials}
      />

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить пользователя?</h3>
            <p className="text-sm text-slate-600 mb-5">
              Вы действительно хотите удалить аккаунт сотрудника <strong className="text-slate-900">{deletingUser.fullName}</strong> ({deletingUser.username})?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="min-h-10 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteUser}
                className="min-h-10 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-600/20"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation Modal */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить роль?</h3>
            <p className="text-sm text-slate-600 mb-5">
              Вы действительно хотите удалить роль <strong className="text-slate-900">{deletingRole.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingRole(null)}
                className="min-h-10 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteRole}
                className="min-h-10 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-600/20"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
