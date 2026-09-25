import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, 
  Clock, 
  Calendar, 
  MapPin, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Sliders, 
  Activity, 
  Zap, 
  RotateCcw, 
  UserCheck, 
  Info, 
  Sparkles, 
  ChevronRight, 
  Check, 
  Plus, 
  ShieldAlert, 
  HelpCircle,
  FileText,
  AlertCircle,
  Camera,
  Eye,
  Image as ImageIcon,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Machine, MaintenanceSchedule, MaintenanceLog, Branch, SparePart, ToirTaskType } from '../types';
import { TOIR_CATEGORIES, getToirCategory, calculateDeadlineInfo, ToirCategoryConfig } from '../toirConstants';
import { partMatchesTarget, partMachineRank } from '../utils/spareParts';
import { machineService } from '../services/machineService';
import { ApiError } from '../lib/apiClient';
import { MultiPhotoPicker, LightboxModal } from './PhotoPicker';

export interface ToirScheduleItem extends MaintenanceSchedule {
  isManual?: boolean;
  model?: string;
  serialNumber?: string;
  branchName?: string;
  machineName?: string;
}

// Icon helper for TOIR
export function getToirIcon(type?: string, className = "w-4 h-4") {
  switch (type) {
    case 'diagnostic':
    case 'inspection':
      return <Activity className={className} />;
    case 'ppr':
      return <Sliders className={className} />;
    case 'emergency':
    case 'repair':
      return <Zap className={className} />;
    case 'routine':
    default:
      return <RotateCcw className={className} />;
  }
}

// -------------------------------------------------------------
// TOIR Guide Modal (Справочник по 4 типам ТОиР)
// -------------------------------------------------------------
export function ToirGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Info className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Классификация задач ТОиР</h3>
              <p className="text-xs text-slate-300">4 основных промышленных типа технического обслуживания станков</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar text-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(TOIR_CATEGORIES).map((cat) => (
              <div 
                key={cat.type} 
                className={`p-4 rounded-xl border ${cat.colorClasses.border} ${cat.colorClasses.bg} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${cat.colorClasses.iconBg}`}>
                      {getToirIcon(cat.type, "w-4 h-4 text-white")}
                    </div>
                    <div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cat.colorClasses.badgeBorder} ${cat.colorClasses.badgeBg}`}>
                        {cat.code}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight mt-1">{cat.title}</h4>
                    </div>
                  </div>

                  <div className="mt-2.5 bg-white/80 p-2.5 rounded-lg border border-slate-200/60 mb-3">
                    <p className="text-xs font-semibold text-slate-700">
                      <span className="font-bold text-slate-900">🎯 Цель:</span> {cat.goal}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Типовые примеры:</p>
                    <ul className="space-y-1">
                      {cat.examples.map((ex, i) => (
                        <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5 leading-relaxed">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

// Normalizes a date value (ISO timestamp or already YYYY-MM-DD) for <input type="date">
function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  return value.split('T')[0];
}

// -------------------------------------------------------------
// Add TOIR Schedule Task Modal
// -------------------------------------------------------------
export function CreateToirScheduleModal({
  isOpen,
  onClose,
  machines,
  branches,
  parts = [],
  preselectedMachineId,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  branches: Branch[];
  parts?: SparePart[];
  preselectedMachineId?: string;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ToirTaskType>('routine');
  const [machineId, setMachineId] = useState<string>(preselectedMachineId || (machines[0]?.id || ''));
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [intervalDays, setIntervalDays] = useState<number>(30);
  const [lastPerformed, setLastPerformed] = useState<string>(new Date().toISOString().split('T')[0]);
  const [nextDue, setNextDue] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [assignedTechnician, setAssignedTechnician] = useState<string>('');
  const [laborCost, setLaborCost] = useState<number | ''>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Spare parts state for warehouse write-off
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [partQty, setPartQty] = useState<number | string>(1);
  const [selectedParts, setSelectedParts] = useState<{
    partId: string;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    availableStock: number;
  }[]>([]);

  // Selected part object for unit and quick info
  const selectedPartObj = useMemo(() => {
    return parts.find(p => p.id === selectedPartId);
  }, [parts, selectedPartId]);

  // Полная очистка всех полей формы
  const resetForm = () => {
    setSelectedType('routine');
    setMachineId(preselectedMachineId || (machines[0]?.id || ''));
    setBranchFilter('');
    setTaskName('');
    setDescription('');
    setIntervalDays(30);
    const today = new Date().toISOString().split('T')[0];
    setLastPerformed(today);
    setNextDue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setAssignedTechnician('');
    setLaborCost('');
    setPriority('medium');
    setImageUrls([]);
    setSelectedPartId('');
    setPartQty(1);
    setSelectedParts([]);
    setShowAllWarehouseParts(false);
  };

  // Сброс полей при каждом открытии модального окна
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, preselectedMachineId]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Recalculate nextDue on interval change
  const handleIntervalChange = (days: number) => {
    setIntervalDays(days);
    if (lastPerformed) {
      const nextDate = new Date(new Date(lastPerformed).getTime() + days * 24 * 60 * 60 * 1000);
      setNextDue(nextDate.toISOString().split('T')[0]);
    }
  };

  const handleLastPerformedChange = (date: string) => {
    setLastPerformed(date);
    if (intervalDays > 0) {
      const nextDate = new Date(new Date(date).getTime() + intervalDays * 24 * 60 * 60 * 1000);
      setNextDue(nextDate.toISOString().split('T')[0]);
    }
  };

  const filteredMachines = useMemo(() => {
    if (!branchFilter) return machines;
    return machines.filter(m => m.branchId === branchFilter);
  }, [machines, branchFilter]);

  const [showAllWarehouseParts, setShowAllWarehouseParts] = useState(false);
  const currentMachine = useMemo(() => machines.find(m => m.id === machineId), [machines, machineId]);
  const currentBranchId = currentMachine?.branchId || branchFilter;

  // Рекомендованные запчасти для станка и филиала
  const recommendedParts = useMemo(() => {
    if (!machineId && !currentBranchId) return [];
    return parts.filter(p => partMatchesTarget(p, machineId, currentBranchId)).sort((a, b) => {
      const rankDiff = partMachineRank(b, machineId) - partMachineRank(a, machineId);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [parts, machineId, currentBranchId]);

  const relevantParts = useMemo(() => {
    if (showAllWarehouseParts) {
      return [...parts].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return recommendedParts;
  }, [showAllWarehouseParts, parts, recommendedParts]);

  const activeCategory = TOIR_CATEGORIES[selectedType];

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const part = parts.find(p => p.id === selectedPartId);
    if (!part) return;

    const parsed = parseFloat(String(partQty).replace(',', '.'));
    const qtyToAdd = Math.round((Number.isFinite(parsed) ? parsed : 0) * 1000) / 1000;
    
    if (qtyToAdd <= 0) {
      alert('Укажите количество больше 0 (например, 0.3, 0.5, 1)');
      return;
    }
    
    // Check existing
    const existingIndex = selectedParts.findIndex(p => p.partId === selectedPartId);
    const currentQty = existingIndex >= 0 ? selectedParts[existingIndex].quantity : 0;
    const totalDesired = Math.round((currentQty + qtyToAdd) * 1000) / 1000;

    const available = part.availableQuantity;
    if (totalDesired > available) {
      alert(`Недостаточно на складе! Доступно ${available} ${part.unit || 'ед.'} (в наличии ${part.quantity}, в резерве ${part.reservedQuantity}), а запрошено ${totalDesired} ${part.unit || 'ед.'}`);
      return;
    }

    if (existingIndex >= 0) {
      const updated = [...selectedParts];
      updated[existingIndex].quantity = totalDesired;
      setSelectedParts(updated);
    } else {
      setSelectedParts(prev => [
        ...prev,
        {
          partId: part.id,
          name: part.name,
          quantity: qtyToAdd,
          unit: part.unit || 'шт',
          unitPrice: part.unitPrice || 0,
          availableStock: available
        }
      ]);
    }

    // Suggest task name if empty
    if (!taskName.trim()) {
      setTaskName(`Замена: ${part.name}`);
    }

    setSelectedPartId('');
    setPartQty(1);
  };

  const handleRemovePart = (index: number) => {
    setSelectedParts(prev => prev.filter((_, i) => i !== index));
  };

  const totalPartsCost = useMemo(() => {
    return Math.round(selectedParts.reduce((acc, p) => acc + (p.unitPrice || 0) * p.quantity, 0) * 100) / 100;
  }, [selectedParts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineId) {
      alert('Пожалуйста, выберите станок');
      return;
    }
    if (!taskName.trim()) {
      alert('Пожалуйста, введите название задачи ТОиР');
      return;
    }

    setLoading(true);
    try {
      // Selected parts are reserved server-side (transactionally, with the schedule itself) -
      // stock isn't touched until the task is actually executed.
      await machineService.addSchedule({
        machineId,
        taskName: taskName.trim(),
        taskType: selectedType,
        description: description.trim(),
        intervalDays: Number(intervalDays) || 30,
        lastPerformed: lastPerformed || new Date().toISOString().split('T')[0],
        nextDue: nextDue || new Date().toISOString().split('T')[0],
        assignedTechnician: assignedTechnician.trim(),
        laborCost: laborCost !== '' ? Number(laborCost) : 0,
        priority,
        imageUrl: imageUrls[0] || '',
        imageUrls: imageUrls,
        partsUsed: selectedParts.map(p => ({
          partId: p.partId,
          name: p.name,
          quantity: p.quantity
        }))
      });

      // Очищаем все поля формы после сохранения
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      console.error("Error creating schedule:", err);
      alert('Ошибка при создании задачи ТОиР');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black">Создать задачу ТОиР</h3>
              <p className="text-xs text-blue-100">Внесение в график технического обслуживания и ремонта</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar text-slate-800 text-xs">
          {/* Step 1: Select TOIR Category */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              1. Тип задачи по регламенту ТОиР
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(TOIR_CATEGORIES).map((cat) => {
                const isSelected = selectedType === cat.type;
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => setSelectedType(cat.type)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected 
                        ? `${cat.colorClasses.badgeBg} border-2 ${cat.colorClasses.border} shadow-sm ring-2 ring-blue-500/20` 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`p-1.5 rounded-lg ${isSelected ? cat.colorClasses.iconBg : 'bg-slate-200 text-slate-600'}`}>
                        {getToirIcon(cat.type, "w-3.5 h-3.5 text-white")}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />}
                    </div>
                    <div className="font-bold text-[11px] leading-tight text-slate-900 mt-1">
                      {cat.shortName}
                    </div>
                    <div className="text-[9px] text-slate-500 line-clamp-1 mt-0.5">
                      {cat.code}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Goal helper banner */}
            <div className={`mt-2 p-2.5 rounded-xl border ${activeCategory.colorClasses.border} ${activeCategory.colorClasses.bg} flex items-start gap-2`}>
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">{activeCategory.title}:</span>{' '}
                <span className="text-slate-700">{activeCategory.goal}</span>
              </div>
            </div>
          </div>

          {/* Step 2: Select Machine */}
          {!preselectedMachineId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Филиал / Цех
                </label>
                <select
                  value={branchFilter}
                  onChange={e => {
                    const newBranch = e.target.value;
                    setBranchFilter(newBranch);
                    const branchMachines = machines.filter(m => !newBranch || m.branchId === newBranch);
                    if (branchMachines.length > 0 && !branchMachines.some(m => m.id === machineId)) {
                      setMachineId(branchMachines[0].id);
                    }
                  }}
                  className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Все филиалы ({machines.length} станков)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Станок / Оборудование *
                </label>
                <select
                  required
                  value={machineId}
                  onChange={e => {
                    const newMachineId = e.target.value;
                    setMachineId(newMachineId);
                    const m = machines.find(x => x.id === newMachineId);
                    if (m?.branchId && m.branchId !== branchFilter) {
                      setBranchFilter(m.branchId);
                    }
                  }}
                  className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>-- Выберите оборудование --</option>
                  {filteredMachines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.model ? `(${m.model})` : ''} {m.serialNumber ? `• SN: ${m.serialNumber}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Task Name */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              2. Название задачи ТОиР *
            </label>
            <input
              required
              type="text"
              placeholder="Например: Замена масляного фильтра и смазка направляющих"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              className="min-h-10 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {/* Step 4: Spare parts from warehouse with automatic deduction */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 min-w-0 break-words">
                <span className="p-1 bg-amber-100 text-amber-800 rounded-md shrink-0">⚙️</span>
                3. Запчасти со склада (списание при создании задачи)
              </label>
              <div className="flex items-center gap-2">
                {parts.length > recommendedParts.length && (
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none whitespace-nowrap">
                    <span>Весь склад</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showAllWarehouseParts}
                      onClick={() => setShowAllWarehouseParts(!showAllWarehouseParts)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                        showAllWarehouseParts ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                      title={showAllWarehouseParts ? 'Показать только рекомендованные детали' : 'Показать все детали склада'}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                    </button>
                  </label>
                )}
                {selectedParts.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                    Итого: {totalPartsCost.toLocaleString()} ₽
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <select
                value={selectedPartId}
                onChange={e => setSelectedPartId(e.target.value)}
                className="min-h-10 flex-1 p-2 bg-white rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none truncate"
              >
                <option value="">
                  {relevantParts.length === 0 
                    ? (!machineId 
                        ? '-- Сначала выберите станок --' 
                        : '-- Нет рекомендованных деталей для этого станка/филиала --')
                    : showAllWarehouseParts
                      ? `-- Выбрать деталь со склада (${relevantParts.length} доступно) --`
                      : `-- Выбрать рекомендованную деталь (${relevantParts.length} привязано) --`}
                </option>
                {relevantParts.map(p => {
                  const isForMachine = Boolean(machineId && (p.machineIds ?? []).includes(machineId));
                  const isForBranch = Boolean(currentBranchId && p.branchId === currentBranchId && !(p.machineIds && p.machineIds.length));
                  const tag = isForMachine
                    ? '[Ст] '
                    : isForBranch
                      ? '[Фил] '
                      : '[Скл] ';
                  return (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.availableQuantity <= 0}
                      style={p.reservedQuantity > 0 ? { color: '#b45309' } : undefined}
                    >
                      {tag}{p.name} {p.sku ? `[${p.sku}]` : ''} • {p.availableQuantity <= 0 ? 'НЕТ' : `${p.availableQuantity} ${p.unit || 'шт'}${p.reservedQuantity > 0 ? ` (рез ${p.reservedQuantity})` : ''}`} {p.unitPrice ? `• ${p.unitPrice}₽` : ''}
                    </option>
                  );
                })}
              </select>

              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center w-24">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="Кол-во"
                    value={partQty}
                    onChange={e => setPartQty(e.target.value)}
                    className="min-h-10 w-full p-2 pr-7 bg-white rounded-lg border border-slate-200 text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    title="Можно вводить дробное количество (например: 0.3, 0.5, 0.7)"
                  />
                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
                    {selectedPartObj?.unit || 'ед.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddPart}
                  disabled={!selectedPartId}
                  className="min-h-10 px-3 py-2 flex-1 bg-slate-900 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            {/* Quick fractional quantity buttons if a part is selected */}
            {selectedPartId && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/80 border border-blue-200/70 rounded-lg text-[11px] text-blue-900">
                <span className="font-semibold text-blue-800 text-[10px] shrink-0">
                  Быстрый расход:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[0.1, 0.2, 0.25, 0.3, 0.5, 0.7, 1].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPartQty(String(preset))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        Number(partQty) === preset 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-white border-blue-200 hover:bg-blue-100 text-blue-900'
                      }`}
                    >
                      {preset} {selectedPartObj?.unit || ''}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-blue-600 ml-auto font-medium">
                  Доступно: <b>{selectedPartObj?.availableQuantity || 0} {selectedPartObj?.unit || 'ед.'}</b>
                </span>
              </div>
            )}

            {/* Warehouse parts filter status */}
            <div className="flex items-center gap-1 text-[11px] pt-1 px-1 text-slate-500">
              <Filter className="w-3 h-3 text-indigo-500" />
              {showAllWarehouseParts
                ? `Показаны все детали со склада (${parts.length})`
                : `Показаны только рекомендованные к станку/филиалу (${recommendedParts.length})`}
            </div>

            {/* Selected parts list */}
            {selectedParts.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Будут списаны со склада ({selectedParts.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedParts.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-2xs"
                    >
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-[11px]">
                        × {p.quantity} {p.unit}
                      </span>
                      {p.unitPrice ? (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({(p.unitPrice * p.quantity).toLocaleString()} ₽)
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-0.5 rounded transition-colors ml-0.5"
                        title="Удалить из списка"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>При нажатии «Запланировать задачу ТОиР» выбранные запчасти автоматически спишутся со склада.</span>
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">
                Если для регламента требуются фильтры, ремни, масла или расходники со склада — выберите их выше.
              </p>
            )}
          </div>

          {/* Step 4: Photos of performed work */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200">
            <MultiPhotoPicker 
              images={imageUrls}
              onChange={setImageUrls}
              maxPhotos={8}
              label="4. Фото проведенных работ / оборудования"
              compact={false}
            />
          </div>

          {/* Step 5: Description / Goal */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              5. Регламент / Описание работ
            </label>
            <textarea
              rows={2}
              placeholder="Укажите технологические требования, контрольные точки или особенности..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Step 6: Schedule timing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Интервал (дней) *
              </label>
              <input
                required
                type="number"
                min="1"
                value={intervalDays}
                onChange={e => handleIntervalChange(Number(e.target.value))}
                className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex gap-1 mt-1">
                {[7, 14, 30, 90, 180, 365].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleIntervalChange(d)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${intervalDays === d ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {d}д
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Прошлое ТО / Дата отсчета
              </label>
              <input
                type="date"
                value={lastPerformed}
                onChange={e => handleLastPerformedChange(e.target.value)}
                className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Срок следующего ТО *
              </label>
              <input
                required
                type="date"
                value={nextDue}
                onChange={e => setNextDue(e.target.value)}
                className="min-h-10 w-full p-2 bg-white rounded-lg border-2 border-blue-400 text-xs font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
            </div>
          </div>

          {/* Step 7: Technician, Labor Cost & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Ответственный мастер / техник
              </label>
              <input
                type="text"
                placeholder="ФИО инженера / бригады"
                value={assignedTechnician}
                onChange={e => setAssignedTechnician(e.target.value)}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 flex flex-wrap items-center justify-between gap-x-2">
                <span>Стоимость работ (₽)</span>
                <span className="text-[9px] text-emerald-600 font-bold lowercase">работа/услуга</span>
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="0 ₽"
                value={laborCost}
                onChange={e => setLaborCost(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Приоритет задачи
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="low">Низкий (Плановый)</option>
                <option value="medium">Обычный (Стандарт)</option>
                <option value="high">Высокий (Важно)</option>
                <option value="critical">Критический (Срочно)</option>
              </select>
            </div>
          </div>

          {/* Cost Summary if labor cost or parts used */}
          {(Number(laborCost) > 0 || selectedParts.length > 0) && (
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-[11px] text-emerald-950 font-medium">
                {Number(laborCost) > 0 && (
                  <span>Раб: <b>{(Number(laborCost) || 0).toLocaleString()} ₽</b></span>
                )}
                {totalPartsCost > 0 && (
                  <span>Запчасти: <b>{totalPartsCost.toLocaleString()} ₽</b></span>
                )}
              </div>
              <div className="text-xs font-black text-emerald-800 flex items-center gap-1">
                <span>Итого расчетная стоимость:</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs font-mono font-bold shadow-2xs">
                  {((Number(laborCost) || 0) + totalPartsCost).toLocaleString()} ₽
                </span>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Сохранение...' : 'Запланировать задачу ТОиР'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Edit TOIR Schedule Task Modal
// -------------------------------------------------------------
export function EditToirScheduleModal({
  schedule,
  isOpen,
  parts = [],
  machines = [],
  branches = [],
  onClose,
  onUpdated
}: {
  schedule: MaintenanceSchedule;
  isOpen: boolean;
  parts?: SparePart[];
  machines?: Machine[];
  branches?: Branch[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ToirTaskType>(schedule.taskType || 'routine');
  const [taskName, setTaskName] = useState(schedule.taskName || '');
  const [description, setDescription] = useState(schedule.description || '');
  const [intervalDays, setIntervalDays] = useState<number>(schedule.intervalDays || 30);
  const [lastPerformed, setLastPerformed] = useState(toDateInputValue(schedule.lastPerformed));
  const [nextDue, setNextDue] = useState(toDateInputValue(schedule.nextDue));
  const [assignedTechnician, setAssignedTechnician] = useState(schedule.assignedTechnician || '');
  const [laborCost, setLaborCost] = useState<number | ''>(schedule.laborCost !== undefined ? schedule.laborCost : '');
  const [priority, setPriority] = useState(schedule.priority || 'medium');
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    if (schedule.imageUrls && Array.isArray(schedule.imageUrls) && schedule.imageUrls.length > 0) {
      return schedule.imageUrls;
    }
    if (schedule.imageUrl) {
      return [schedule.imageUrl];
    }
    return [];
  });

  const [showAllWarehouseParts, setShowAllWarehouseParts] = useState(false);
  const currentMachine = useMemo(() => machines.find(m => m.id === schedule.machineId), [machines, schedule.machineId]);
  const currentBranchId = currentMachine?.branchId;

  // Рекомендованные запчасти для станка и филиала
  const recommendedParts = useMemo(() => {
    if (!schedule.machineId && !currentBranchId) return [];
    return parts.filter(p => partMatchesTarget(p, schedule.machineId, currentBranchId)).sort((a, b) => {
      const rankDiff = partMachineRank(b, schedule.machineId) - partMachineRank(a, schedule.machineId);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [parts, schedule.machineId, currentBranchId]);

  const relevantParts = useMemo(() => {
    if (showAllWarehouseParts) {
      return [...parts].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return recommendedParts;
  }, [showAllWarehouseParts, parts, recommendedParts]);

  // Spare parts state
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [partQty, setPartQty] = useState<number | string>(1);
  const [selectedParts, setSelectedParts] = useState<{
    partId: string;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    availableStock: number;
  }[]>(() => {
    if (!schedule.partsUsed || schedule.partsUsed.length === 0) return [];
    return schedule.partsUsed.map(p => {
      const matched = parts.find(sp => sp.id === p.partId);
      return {
        partId: p.partId,
        name: p.name || matched?.name || 'Запчасть',
        quantity: p.quantity,
        unit: matched?.unit || 'шт',
        unitPrice: matched?.unitPrice || 0,
        availableStock: matched ? matched.quantity : 0
      };
    });
  });

  const selectedPartObj = useMemo(() => {
    return parts.find(p => p.id === selectedPartId);
  }, [parts, selectedPartId]);

  const handleIntervalChange = (days: number) => {
    setIntervalDays(days);
    if (lastPerformed) {
      const nextDate = new Date(new Date(lastPerformed).getTime() + days * 24 * 60 * 60 * 1000);
      setNextDue(nextDate.toISOString().split('T')[0]);
    }
  };

  const handleLastPerformedChange = (date: string) => {
    setLastPerformed(date);
    if (intervalDays > 0) {
      const nextDate = new Date(new Date(date).getTime() + intervalDays * 24 * 60 * 60 * 1000);
      setNextDue(nextDate.toISOString().split('T')[0]);
    }
  };

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const part = parts.find(p => p.id === selectedPartId);
    if (!part) return;

    const parsed = parseFloat(String(partQty).replace(',', '.'));
    const qtyToAdd = Math.round((Number.isFinite(parsed) ? parsed : 0) * 1000) / 1000;
    
    if (qtyToAdd <= 0) {
      alert('Укажите количество больше 0 (например: 0.3, 0.5, 1)');
      return;
    }
    
    // Check existing in selected list
    const existingIndex = selectedParts.findIndex(p => p.partId === selectedPartId);
    const currentQty = existingIndex >= 0 ? selectedParts[existingIndex].quantity : 0;
    const totalDesired = Math.round((currentQty + qtyToAdd) * 1000) / 1000;

    // Previously already allocated in this schedule (its own reservation shouldn't count against itself)
    const previouslyAllocated = schedule.partsUsed?.find(p => p.partId === selectedPartId)?.quantity || 0;
    // Max allowable = available stock right now + what this schedule already has reserved
    const maxAvailable = Math.round((part.availableQuantity + previouslyAllocated) * 1000) / 1000;

    if (totalDesired > maxAvailable) {
      alert(`Недостаточно на складе! Доступно ${maxAvailable} ${part.unit || 'ед.'}, а суммарно запрошено ${totalDesired} ${part.unit || 'ед.'}`);
      return;
    }

    if (existingIndex >= 0) {
      const updated = [...selectedParts];
      updated[existingIndex].quantity = totalDesired;
      setSelectedParts(updated);
    } else {
      setSelectedParts(prev => [
        ...prev,
        {
          partId: part.id,
          name: part.name,
          quantity: qtyToAdd,
          unit: part.unit || 'шт',
          unitPrice: part.unitPrice || 0,
          availableStock: maxAvailable
        }
      ]);
    }

    setSelectedPartId('');
    setPartQty(1);
  };

  const handleRemovePart = (index: number) => {
    setSelectedParts(prev => prev.filter((_, i) => i !== index));
  };

  const totalPartsCost = useMemo(() => {
    return Math.round(selectedParts.reduce((acc, p) => acc + (p.unitPrice || 0) * p.quantity, 0) * 100) / 100;
  }, [selectedParts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      alert('Пожалуйста, введите название задачи');
      return;
    }

    setLoading(true);
    try {
      // The reservation diff (old parts -> new parts) is applied server-side, transactionally,
      // by updateSchedule itself - stock isn't touched until the task is executed.
      await machineService.updateSchedule(schedule.id, {
        taskName: taskName.trim(),
        taskType: selectedType,
        description: description.trim(),
        intervalDays: Number(intervalDays) || 30,
        lastPerformed,
        nextDue,
        assignedTechnician: assignedTechnician.trim(),
        laborCost: laborCost !== '' ? Number(laborCost) : 0,
        priority: priority as any,
        imageUrl: imageUrls[0] || '',
        imageUrls: imageUrls,
        partsUsed: selectedParts.map(p => ({
          partId: p.partId,
          name: p.name,
          quantity: p.quantity
        }))
      });

      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.status === 404) {
        alert('Эта задача уже была изменена или удалена в другом месте. Список будет обновлён.');
        onUpdated();
        onClose();
      } else {
        alert('Ошибка при обновлении задачи');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Pencil className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black">Редактировать задачу ТОиР</h3>
              <p className="text-[11px] text-slate-300">Изменение параметров и графика проведения</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white rounded-lg">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar text-xs flex-1 min-h-0">
          {/* TOIR Type */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Тип задачи ТОиР
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {Object.values(TOIR_CATEGORIES).map((cat) => (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => setSelectedType(cat.type)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedType === cat.type 
                      ? `${cat.colorClasses.badgeBg} border-2 ${cat.colorClasses.border} font-bold text-slate-900` 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {getToirIcon(cat.type, "w-3 h-3")}
                    <span className="text-[10px]">{cat.shortName}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Task Name */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Название задачи *
            </label>
            <input
              required
              type="text"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              className="min-h-10 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Описание / Регламент
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Spare parts from warehouse with automatic sync */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5 min-w-0 break-words">
                <span className="p-1 bg-amber-100 text-amber-800 rounded-md shrink-0">⚙️</span>
                Запчасти со склада (авто-списание при изменении)
              </label>
              <div className="flex items-center gap-2">
                {parts.length > recommendedParts.length && (
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none whitespace-nowrap">
                    <span>Весь склад</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showAllWarehouseParts}
                      onClick={() => setShowAllWarehouseParts(!showAllWarehouseParts)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                        showAllWarehouseParts ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                      title={showAllWarehouseParts ? 'Показать только рекомендованные детали' : 'Показать все детали склада'}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                    </button>
                  </label>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <select
                value={selectedPartId}
                onChange={e => setSelectedPartId(e.target.value)}
                className="min-h-10 flex-1 p-2 bg-white rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none truncate"
              >
                <option value="">
                  {relevantParts.length === 0
                    ? (!schedule.machineId
                        ? '-- Сначала выберите станок --' 
                        : '-- Нет рекомендованных деталей для этого станка/филиала --')
                    : showAllWarehouseParts
                      ? `-- Выбрать деталь со склада (${relevantParts.length} доступно) --`
                      : `-- Выбрать рекомендованную деталь (${relevantParts.length} привязано) --`}
                </option>
                {relevantParts.map(p => {
                  const isForMachine = Boolean(schedule.machineId && (p.machineIds ?? []).includes(schedule.machineId));
                  const isForBranch = Boolean(currentBranchId && p.branchId === currentBranchId && !(p.machineIds && p.machineIds.length));
                  const tag = isForMachine
                    ? '[Ст] '
                    : isForBranch
                      ? '[Фил] '
                      : '[Скл] ';
                  return (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.availableQuantity <= 0}
                      style={p.reservedQuantity > 0 ? { color: '#b45309' } : undefined}
                    >
                      {tag}{p.name} {p.sku ? `[${p.sku}]` : ''} • {p.availableQuantity <= 0 ? 'НЕТ' : `${p.availableQuantity} ${p.unit || 'шт'}${p.reservedQuantity > 0 ? ` (рез ${p.reservedQuantity})` : ''}`} {p.unitPrice ? `• ${p.unitPrice}₽` : ''}
                    </option>
                  );
                })}
              </select>

              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center w-24">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="Кол-во"
                    value={partQty}
                    onChange={e => setPartQty(e.target.value)}
                    className="min-h-10 w-full p-2 pr-7 bg-white rounded-lg border border-slate-200 text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    title="Можно вводить дробное количество (например: 0.3, 0.5, 0.7)"
                  />
                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
                    {selectedPartObj?.unit || 'ед.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddPart}
                  disabled={!selectedPartId}
                  className="min-h-10 px-3 py-2 flex-1 bg-slate-900 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            {/* Quick fractional quantity buttons if a part is selected */}
            {selectedPartId && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/80 border border-blue-200/70 rounded-lg text-[11px] text-blue-900">
                <span className="font-semibold text-blue-800 text-[10px] shrink-0">
                  Быстрый расход:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[0.1, 0.2, 0.25, 0.3, 0.5, 0.7, 1].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPartQty(String(preset))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        Number(partQty) === preset 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-white border-blue-200 hover:bg-blue-100 text-blue-900'
                      }`}
                    >
                      {preset} {selectedPartObj?.unit || ''}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-blue-600 ml-auto font-medium">
                  Доступно: <b>{selectedPartObj?.availableQuantity || 0} {selectedPartObj?.unit || 'ед.'}</b>
                </span>
              </div>
            )}

            {/* Warehouse parts filter status */}
            <div className="flex items-center gap-1 text-[11px] pt-1 px-1 text-slate-500">
              <Filter className="w-3 h-3 text-indigo-500" />
              {showAllWarehouseParts
                ? `Показаны все детали со склада (${parts.length})`
                : `Показаны только рекомендованные к станку/филиалу (${recommendedParts.length})`}
            </div>

            {/* Selected parts list */}
            {selectedParts.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Прикрепленные запчасти ({selectedParts.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedParts.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-2xs"
                    >
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-[11px]">
                        × {p.quantity} {p.unit}
                      </span>
                      {p.unitPrice ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                          ({(p.unitPrice * p.quantity).toLocaleString()} ₽)
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-0.5 rounded transition-colors ml-0.5"
                        title="Удалить из списка"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>При сохранении складской остаток автоматически скорректируется с учетом изменений.</span>
                </p>
              </div>
            ) : null}
          </div>

          {/* Photos of performed work */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200">
            <MultiPhotoPicker 
              images={imageUrls}
              onChange={setImageUrls}
              maxPhotos={8}
              label="Фотографии проведенных работ / оборудования"
              compact={false}
            />
          </div>

          {/* Timing */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Интервал (дней)</label>
              <input
                required
                type="number"
                min="1"
                value={intervalDays}
                onChange={e => handleIntervalChange(Number(e.target.value))}
                className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Прошлый раз</label>
              <input
                type="date"
                value={lastPerformed}
                onChange={e => handleLastPerformedChange(e.target.value)}
                className="min-h-10 w-full p-2 bg-white rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Срок следующего</label>
              <input
                required
                type="date"
                value={nextDue}
                onChange={e => setNextDue(e.target.value)}
                className="min-h-10 w-full p-2 bg-white rounded-lg border border-blue-400 text-xs font-mono font-bold text-blue-900"
              />
            </div>
          </div>

          {/* Technician, Labor Cost & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Ответственный мастер / техник
              </label>
              <input
                type="text"
                placeholder="ФИО инженера / бригады"
                value={assignedTechnician}
                onChange={e => setAssignedTechnician(e.target.value)}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 flex flex-wrap items-center justify-between gap-x-2">
                <span>Стоимость работ (₽)</span>
                <span className="text-[9px] text-emerald-600 font-bold lowercase">работа/услуга</span>
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="0 ₽"
                value={laborCost}
                onChange={e => setLaborCost(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Приоритет задачи
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="min-h-10 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="low">Низкий (Плановый)</option>
                <option value="medium">Обычный (Стандарт)</option>
                <option value="high">Высокий (Важно)</option>
                <option value="critical">Критический (Срочно)</option>
              </select>
            </div>
          </div>

          {/* Cost Summary if labor cost or parts used */}
          {(Number(laborCost) > 0 || selectedParts.length > 0) && (
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-[11px] text-emerald-950 font-medium">
                {Number(laborCost) > 0 && (
                  <span>Раб: <b>{(Number(laborCost) || 0).toLocaleString()} ₽</b></span>
                )}
                {totalPartsCost > 0 && (
                  <span>Запчасти: <b>{totalPartsCost.toLocaleString()} ₽</b></span>
                )}
              </div>
              <div className="text-xs font-black text-emerald-800 flex items-center gap-1">
                <span>Итого расчетная стоимость:</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs font-mono font-bold shadow-2xs">
                  {((Number(laborCost) || 0) + totalPartsCost).toLocaleString()} ₽
                </span>
              </div>
            </div>
          )}
        </div>

          {/* Actions */}
          <div className="shrink-0 p-4 sm:p-5 pt-3 flex justify-end gap-2 border-t border-slate-200 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-bold transition-all shadow-sm"
            >
              {loading ? 'Обновление...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Interactive TOIR Task Card
// -------------------------------------------------------------
export interface ToirScheduleCardProps {
  schedule: ToirScheduleItem;
  machine?: Machine;
  branch?: Branch;
  onCompleteModal?: (schedule: ToirScheduleItem) => void;
  onQuickComplete?: (schedule: ToirScheduleItem) => void | Promise<void>;
  onEdit?: (schedule: ToirScheduleItem) => void;
  onDelete?: (schedule: ToirScheduleItem) => void | Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
  canExecute?: boolean;
}

export const ToirScheduleCard: React.FC<ToirScheduleCardProps> = ({
  schedule,
  machine,
  branch,
  onCompleteModal,
  onQuickComplete,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  canExecute = true
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const category = getToirCategory(schedule.taskType);
  const deadline = calculateDeadlineInfo(schedule.nextDue);
  const scheduleImages = schedule.imageUrls && schedule.imageUrls.length > 0 
    ? schedule.imageUrls 
    : schedule.imageUrl 
      ? [schedule.imageUrl] 
      : [];

  const handleExecute = () => {
    if (onQuickComplete) {
      onQuickComplete(schedule);
    } else if (onCompleteModal) {
      onCompleteModal(schedule);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-2xl border-2 transition-all flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-md ${
        deadline.isOverdue
          ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/10'
          : deadline.isToday
            ? 'border-amber-300 ring-1 ring-amber-200'
            : 'border-slate-400 hover:border-slate-500'
      }`}
    >
      {/* Top Bar: TOIR Badge & Urgency status */}
      <div className="p-3 sm:p-3.5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          {/* TOIR Type Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight whitespace-nowrap border ${category.colorClasses.badgeBorder} ${category.colorClasses.badgeBg}`}>
              {getToirIcon(schedule.taskType, "w-3 h-3 shrink-0")}
              <span>{category.badgeLabel}</span>
            </span>
          </div>

          {/* Urgency Badge */}
          <div className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border text-right shrink-0 whitespace-nowrap flex items-center gap-1 ${deadline.badgeClass}`}>
            <Clock className="w-3 h-3 shrink-0" />
            <span>{deadline.label}</span>
          </div>
        </div>

        {/* Task Title */}
        <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 break-words mb-2" title={schedule.taskName}>
          {schedule.taskName}
        </h4>

        {/* Middle Section: Branch Name & Machine Info */}
        <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 mb-2.5 space-y-1.5 shadow-2xs">
          {/* Branch Name - prominent in middle/upper section */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 text-xs font-bold text-indigo-800 bg-indigo-50/90 border border-indigo-200/80 px-2 py-0.5 rounded-lg truncate shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate font-black tracking-tight">{branch?.name || schedule.branchName || 'Филиал не указан'}</span>
            </div>
            {machine?.model && (
              <span className="text-slate-600 font-medium text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                {machine.model}
              </span>
            )}
          </div>

          {/* Machine Name & Serial */}
          <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between gap-1.5 truncate pt-0.5">
            <span className="truncate">{machine?.name || schedule.machineName || 'Оборудование'}</span>
            {machine?.serialNumber && (
              <span className="text-slate-400 font-mono text-[10px] font-medium shrink-0">
                SN: {machine.serialNumber}
              </span>
            )}
          </div>
        </div>

        {/* Goal / Description snippet */}
        {schedule.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100 mb-2.5">
            {schedule.description}
          </p>
        )}

        {/* Attached Spare Parts */}
        {schedule.partsUsed && schedule.partsUsed.length > 0 && (
          <div className="mb-2.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <div className="text-[8px] font-bold uppercase text-emerald-800 tracking-wider mb-1 flex items-center gap-1">
              <span>⚙️ Запчасти (списано со склада):</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {schedule.partsUsed.map((p, idx) => (
                <span key={idx} className="bg-white border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs">
                  {p.name} <span className="text-emerald-600 font-mono">×{p.quantity}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attached Photos of Performed Work / Equipment */}
        {scheduleImages.length > 0 && (
          <div className="mb-2.5 p-2 bg-blue-50/60 border border-blue-100 rounded-xl">
            <div className="flex items-center justify-between text-[9px] font-bold text-blue-900 uppercase tracking-wider mb-1.5 px-0.5">
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Фото проведенных работ ({scheduleImages.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="text-[9px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 hover:underline"
              >
                <Eye className="w-2.5 h-2.5" />
                <span>Открыть</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
              {scheduleImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative w-11 h-11 rounded-lg overflow-hidden border border-blue-200 hover:border-blue-500 shrink-0 group/img shadow-2xs transition-all hover:scale-105 bg-slate-900"
                  title="Нажмите для увеличения"
                >
                  <img src={img} alt="" className="w-full h-full object-cover group-hover/img:opacity-85 transition-opacity" />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Eye className="w-3 h-3 text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Meta Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 2xl:grid-cols-4 gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-100 text-[10px]">
          <div>
            <div className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Срок ТО</div>
            <div className={`font-bold font-mono truncate ${deadline.isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
              {schedule.nextDue ? new Date(schedule.nextDue).toLocaleDateString('ru-RU') : '---'}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Интервал</div>
            <div className="font-bold text-slate-700 truncate">
              {schedule.isManual ? 'Разово' : `${schedule.intervalDays} дн.`}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Мастер</div>
            <div className="font-semibold text-slate-700 truncate" title={schedule.assignedTechnician || 'Дежурный'}>
              {schedule.assignedTechnician || 'Дежурный'}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-bold uppercase text-emerald-600 tracking-wider">Раб. (₽)</div>
            <div className="font-bold font-mono text-emerald-700 truncate">
              {schedule.laborCost ? `${schedule.laborCost.toLocaleString()} ₽` : '0 ₽'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="p-2 sm:p-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
        {canExecute ? (
          <button
            onClick={handleExecute}
            className="flex-1 min-h-10 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
            title="Выполнить задачу и перенести запись в историю обслуживания"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-white" />
            <span>Выполнить</span>
          </button>
        ) : (
          <div className="flex-1 py-1.5 px-2 rounded-xl text-xs font-medium text-slate-400 bg-slate-100 text-center truncate">
            Только просмотр
          </div>
        )}

        {/* Edit & Delete Controls */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && onEdit && !schedule.isManual && (
              <button
                onClick={() => onEdit(schedule)}
                className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                title="Редактировать задачу ТОиР"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {canDelete && onDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="min-h-10 min-w-10 flex items-center justify-center p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                title="Удалить задачу из графика"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Photo Lightbox */}
      <LightboxModal
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={scheduleImages}
        initialIndex={lightboxIndex || 0}
        title={`Фото задачи ТОиР: ${schedule.taskName}`}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 rounded-xl shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm">Удалить задачу?</h3>
                  <p className="text-xs text-slate-500 mt-1 break-words">
                    Задача «{schedule.taskName}» будет удалена из графика ТОиР. Это действие нельзя отменить.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-10 px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Нет
                </button>
                <button
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete && onDelete(schedule);
                  }}
                  className="min-h-10 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                >
                  Да, удалить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
