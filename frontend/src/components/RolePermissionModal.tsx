import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  Pencil, 
  Shield, 
  Bookmark, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Role, PermissionTabId, PermissionMatrixItem } from '../types';
import { 
  PERMISSION_TABS, 
  PERMISSION_ACTIONS, 
  createEmptyPermissions, 
  createTechnologistPermissions,
  createFullPermissions 
} from '../services/userService';

interface RolePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: Role | null;
  onSave: (roleData: { name: string; description?: string; color?: string; permissions: Record<string, PermissionMatrixItem> }) => Promise<void>;
}

export const RolePermissionModal: React.FC<RolePermissionModalProps> = ({
  isOpen,
  onClose,
  role,
  onSave
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<PermissionTabId>('machines');
  const [permissions, setPermissions] = useState<Record<string, PermissionMatrixItem>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setName(role.name || '');
      setDescription(role.description || '');
      setPermissions({ ...createEmptyPermissions(), ...(role.permissions || {}) });
    } else {
      setName('');
      setDescription('');
      // Default to technologist preset or clean slate
      setPermissions(createTechnologistPermissions());
    }
    setError(null);
  }, [role, isOpen]);

  if (!isOpen) return null;

  const currentTabDef = PERMISSION_TABS.find(t => t.id === activeTab) || PERMISSION_TABS[0];

  const handleToggleCell = (rowId: string, actionId: keyof PermissionMatrixItem) => {
    const key = `${activeTab}.${rowId}`;
    const currentItem = permissions[key] || {
      menu: false,
      create: false,
      view: false,
      edit: false,
      delete: false,
      export: false
    };

    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...currentItem,
        [actionId]: !currentItem[actionId]
      }
    }));
  };

  const handleSelectAllInTab = () => {
    setPermissions(prev => {
      const next = { ...prev };
      currentTabDef.rows.forEach(row => {
        const key = `${activeTab}.${row.id}`;
        next[key] = {
          menu: true,
          create: true,
          view: true,
          edit: true,
          delete: true,
          export: true
        };
      });
      return next;
    });
  };

  const handleDeselectAllInTab = () => {
    setPermissions(prev => {
      const next = { ...prev };
      currentTabDef.rows.forEach(row => {
        const key = `${activeTab}.${row.id}`;
        next[key] = {
          menu: false,
          create: false,
          view: false,
          edit: false,
          delete: false,
          export: false
        };
      });
      return next;
    });
  };

  const handleToggleColumnInTab = (actionId: keyof PermissionMatrixItem) => {
    // Check if all rows in current tab currently have this permission
    const allEnabled = currentTabDef.rows.every(row => {
      const key = `${activeTab}.${row.id}`;
      return !!permissions[key]?.[actionId];
    });

    const targetVal = !allEnabled;

    setPermissions(prev => {
      const next = { ...prev };
      currentTabDef.rows.forEach(row => {
        const key = `${activeTab}.${row.id}`;
        const currentItem = next[key] || {
          menu: false,
          create: false,
          view: false,
          edit: false,
          delete: false,
          export: false
        };
        next[key] = {
          ...currentItem,
          [actionId]: targetVal
        };
      });
      return next;
    });
  };

  const handleApplyPreset = (preset: 'tech' | 'admin' | 'clear') => {
    if (preset === 'tech') {
      setName(prev => prev || 'Технолог');
      setPermissions(createTechnologistPermissions());
    } else if (preset === 'admin') {
      setName(prev => prev || 'Администратор');
      setPermissions(createFullPermissions());
    } else {
      setPermissions(createEmptyPermissions());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Пожалуйста, укажите наименование роли');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color: role?.color || '#f97316',
        permissions
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить роль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        >
          {/* Header Banner - Matches Warm/Orange Sky Atmosphere from Screenshots */}
          <div className="relative bg-gradient-to-r from-[#b45309] via-[#ea580c] to-[#c2410c] text-white px-5 py-4 sm:px-8 sm:py-5 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-inner">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {role ? 'Редактировать роль' : 'Добавить роль'}
                </h2>
                <p className="text-xs text-orange-100/90 font-medium">
                  Матрица прав доступа и полномочий сотрудников в системе
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Preset Buttons */}
              <div className="hidden lg:flex items-center gap-1.5 mr-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('tech')}
                  className="text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg text-white font-medium transition-all"
                  title="Заполнить как у Технолога"
                >
                  Шаблон: Технолог
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('admin')}
                  className="text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg text-white font-medium transition-all"
                  title="Полный доступ"
                >
                  Все права
                </button>
              </div>

              {/* Orange Save Button - Exact Style from Screenshot */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] active:bg-[#c2410c] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Bookmark className="w-4 h-4 fill-white" />
                )}
                <span>Сохранить</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl font-medium flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Role Name Input - Exactly from screenshots: "* Наименование" with pencil icon */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="text-sm font-semibold text-slate-700 sm:w-36 shrink-0 flex items-center gap-1.5">
                  <span className="text-rose-500 font-bold">*</span> Наименование
                </label>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Технолог, Мастер цеха, Инженер ТОиР"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Optional brief role description */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mt-3">
                <label className="text-xs font-medium text-slate-500 sm:w-36 shrink-0">
                  Описание роли
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание обязанностей и зоны ответственности"
                  className="flex-1 px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Category Tabs: Оборудование, Техобслуживание, Филиалы, Склад запчастей, Пользователи и роли, Отчеты, История */}
            <div className="border-b border-slate-200 overflow-x-auto pb-0.5">
              <nav className="flex space-x-6 sm:space-x-8 min-w-max px-1">
                {PERMISSION_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-3 text-sm font-bold tracking-tight transition-all border-b-2 cursor-pointer ${
                        isActive
                          ? 'border-[#f97316] text-[#ea580c]'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Bulk Action Buttons: "Выбрать всё" | "Отменить всё" */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSelectAllInTab}
                  className="px-4 py-1.5 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 text-slate-700 text-xs font-semibold rounded-full shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Выбрать всё
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllInTab}
                  className="px-4 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-600 text-xs font-semibold rounded-full shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Отменить всё
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Нажмите на заголовок колонки с галочкой для массового переключения</span>
              </div>
            </div>

            {/* Permissions Matrix Table - Styled exactly like screenshots рол 1, 2, 3 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 text-xs font-bold">
                      <th className="py-3.5 px-4 sm:px-6 w-1/4 min-w-[180px] uppercase tracking-wider text-slate-400 text-[11px]">
                        Ресурс / Модуль
                      </th>
                      {PERMISSION_ACTIONS.map((action) => (
                        <th key={action.id} className="py-3.5 px-3 text-center min-w-[110px]">
                          <button
                            type="button"
                            onClick={() => handleToggleColumnInTab(action.id)}
                            className="group inline-flex items-center justify-center gap-1.5 text-slate-700 hover:text-orange-600 font-semibold cursor-pointer transition-colors"
                            title={`Переключить всю колонку "${action.label}"`}
                          >
                            <span>{action.label}</span>
                            <span className="w-4 h-4 rounded-full border border-slate-300 group-hover:border-orange-500 group-hover:bg-orange-50 flex items-center justify-center text-[10px] text-slate-500 group-hover:text-orange-600">
                              ✓
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {currentTabDef.rows.map((row) => {
                      const rowKey = `${activeTab}.${row.id}`;
                      const rowPerms = permissions[rowKey] || {
                        menu: false,
                        create: false,
                        view: false,
                        edit: false,
                        delete: false,
                        export: false
                      };

                      return (
                        <tr 
                          key={row.id}
                          className="hover:bg-orange-50/30 transition-colors"
                        >
                          {/* Row title */}
                          <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                            {row.name}
                          </td>

                          {/* 6 Permission action circles */}
                          {PERMISSION_ACTIONS.map((action) => {
                            const isChecked = !!rowPerms[action.id];

                            return (
                              <td key={action.id} className="py-3.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(row.id, action.id)}
                                  className="inline-flex items-center justify-center p-1 rounded-full hover:bg-orange-100/50 transition-all cursor-pointer focus:outline-none"
                                  title={`${row.name}: ${action.label}`}
                                >
                                  {/* Custom circular checkbox - Exactly as shown in screenshots */}
                                  <div 
                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                      isChecked
                                        ? 'bg-[#f97316] text-white shadow-xs scale-105'
                                        : 'border-2 border-slate-300 bg-white hover:border-orange-400'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              Выбранная роль: <strong className="text-slate-800">{name || 'Без названия'}</strong>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 text-sm font-semibold transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-[#f97316] hover:bg-[#ea580c] active:bg-[#c2410c] text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить роль'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
