import React, { useState } from 'react';
import { PlusCircle, Wrench, Trash2, MoveHorizontal, History, Search, Printer } from 'lucide-react';
import { canPerformAction } from '../services/userService';
import type { ActivityLog, Machine, Branch, SparePart, MaintenanceLog, Role } from '../types';

interface HistoryTabProps {
  logs: ActivityLog[];
  machines: Machine[];
  branches: Branch[];
  parts: SparePart[];
  maintenanceLogs: MaintenanceLog[];
  role?: Role | null;
}

export default function HistoryPage({ logs, machines, branches, parts, maintenanceLogs, role }: HistoryTabProps) {
  const canViewActivity = canPerformAction(role, 'history.activity_log', 'view');
  const canViewTransfers = canPerformAction(role, 'history.activity_log', 'view');
  const canViewDeletions = canPerformAction(role, 'history.activity_log', 'view');
  const canExportHistory = canPerformAction(role, 'history.activity_log', 'export');

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
                        {p.unitPrice !== undefined && <span>• Цена: <strong className="text-slate-700">{p.unitPrice.toLocaleString('en-US')} $</strong></span>}
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
                            <span>• Ремонт: <strong className="text-emerald-700 font-bold">{ml.cost.toLocaleString('en-US')} $</strong></span>
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
                      <p className="text-sm text-slate-600 font-medium break-words">{log.details?.replace(/data:[a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[изображение]')}</p>

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
