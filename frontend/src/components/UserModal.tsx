import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Lock,
  Eye,
  EyeOff,
  Key,
  Shield,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Check,
  ChevronDown,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { AppUser, Role, Branch } from '../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: AppUser | null;
  roles: Role[];
  branches: Branch[];
  onSave: (userData: Omit<AppUser, 'id' | 'createdAt'>) => Promise<void>;
  canEditCredentials?: boolean;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  user,
  roles,
  branches,
  onSave,
  canEditCredentials = true
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'blocked'>('active');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPassword('');
      setRoleId(user.roleId || (roles[0]?.id ?? ''));
      setBranchIds(user.branchIds || []);
      setPosition(user.position || '');
      setPhone(user.phone || '');
      setStatus(user.status || 'active');
      setNotes(user.notes || '');
    } else {
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword(generateStrongPassword());
      setRoleId(roles[1]?.id || roles[0]?.id || '');
      setBranchIds([]);
      setPosition('');
      setPhone('');
      setStatus('active');
      setNotes('');
    }
    setError(null);
  }, [user, isOpen, roles]);

  useEffect(() => {
    if (!isBranchDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBranchDropdownOpen]);

  function generateStrongPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const handleGeneratePassword = () => {
    const pass = generateStrongPassword();
    setPassword(pass);
    setShowPassword(true);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Укажите ФИО сотрудника');
      return;
    }
    if (!username.trim()) {
      setError('Укажите логин для входа');
      return;
    }
    if (!user && !password.trim()) {
      setError('Укажите пароль');
      return;
    }

    const selectedRole = roles.find(r => r.id === roleId);

    try {
      setSaving(true);
      setError(null);
      await onSave({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim() || `${username.trim().toLowerCase()}@stankobase.local`,
        password: password.trim(),
        roleId: roleId || (roles[0]?.id ?? 'role-tech'),
        roleName: selectedRole?.name || 'Пользователь',
        branchIds,
        position: position.trim(),
        phone: phone.trim(),
        status,
        notes: notes.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка сохранения пользователя');
    } finally {
      setSaving(false);
    }
  };

  const currentRole = roles.find(r => r.id === roleId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-8 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white break-words">
                  {user ? 'Редактировать сотрудника' : 'Добавить пользователя'}
                </h3>
                <p className="text-xs text-slate-400">
                  Учетные данные, логин, пароль и назначение роли доступа
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="min-h-10 min-w-10 flex items-center justify-center shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  ФИО сотрудника <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванов Алексей Петрович"
                    className="min-h-10 w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Должность
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Инженер-технолог ЧПУ"
                    className="min-h-10 w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Credentials Card (Login & Password) */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-black text-blue-900 uppercase tracking-wider">
                <Key className="w-4 h-4 text-blue-600" />
                <span>Данные для авторизации в системе</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Логин (Username) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="technolog_ivanov"
                    className="min-h-10 w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Используется для входа в приложение</p>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Пароль {!user && <span className="text-rose-500">*</span>}
                    </label>
                    {canEditCredentials && (
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                        title="Сгенерировать безопасный пароль"
                      >
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        Сгенерировать
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!user}
                      disabled={!canEditCredentials}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={user ? 'Оставьте пустым, чтобы не менять' : '••••••••'}
                      className={`min-h-10 w-full pl-3 pr-10 py-2 border rounded-xl text-sm font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        !canEditCredentials
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                    {canEditCredentials && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {!canEditCredentials && (
                    <p className="text-[10px] text-slate-400 mt-1">Редактирование пароля ограничено вашей ролью</p>
                  )}
                  {canEditCredentials && user && (
                    <p className="text-[10px] text-slate-400 mt-1">Пароль хранится в хешированном виде и не может быть показан — оставьте поле пустым, чтобы не менять его</p>
                  )}
                </div>
              </div>
            </div>

            {/* Role and Branch Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span>Назначить роль <span className="text-rose-500">*</span></span>
                  {currentRole && (
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-2xs whitespace-nowrap"
                      style={{ backgroundColor: currentRole.color || '#f97316' }}
                    >
                      {currentRole.name}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="min-h-10 w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.isSystem ? '(Системная)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {currentRole?.description && (
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight italic">
                    {currentRole.description}
                  </p>
                )}
              </div>

              <div ref={branchDropdownRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Привязка к филиалу
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setIsBranchDropdownOpen(v => !v)}
                    className="min-h-10 w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 text-left truncate focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {branchIds.length === 0
                      ? 'Все филиалы и цеха'
                      : branchIds.map(id => branches.find(b => b.id === id)?.name).filter(Boolean).join(', ')}
                  </button>
                  <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isBranchDropdownOpen && (
                  <div className="absolute z-10 mt-1.5 w-full border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={branchIds.length === 0}
                        onChange={() => setBranchIds([])}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                      <span className="text-sm font-semibold text-slate-800">Все филиалы и цеха</span>
                    </label>
                    {branches.map((b) => (
                      <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={branchIds.includes(b.id)}
                          onChange={(e) => {
                            setBranchIds(prev =>
                              e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id)
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {b.name} ({b.location || 'Цех'})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Можно выбрать несколько филиалов</p>
              </div>
            </div>

            {/* Contacts & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="worker@company.ru"
                    className="min-h-10 w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Телефон
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="min-h-10 w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Status Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block">Статус учетной записи</span>
                <span className="text-[11px] text-slate-500">
                  {status === 'active' ? 'Пользователь может авторизоваться и работать' : 'Доступ в систему заблокирован'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatus(status === 'active' ? 'blocked' : 'active')}
                className={`min-h-10 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  status === 'active' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {status === 'active' ? '● Активен' : '✕ Заблокирован'}
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Заметки / Примечания
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Дополнительные сведения, табельный номер или допуски"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>

          {/* Modal Footer */}
          <div className="bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="min-h-10 px-5 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : (user ? 'Сохранить изменения' : 'Добавить пользователя')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
