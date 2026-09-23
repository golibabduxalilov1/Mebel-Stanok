import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Star, 
  Plus, 
  AlertCircle, 
  X, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export async function compressImage(
  file: File, 
  maxWidth = 1200, 
  maxHeight = 1200, 
  quality = 0.82
): Promise<string> {
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

export function MultiPhotoPicker({
  images = [],
  onChange,
  maxPhotos = 10,
  label = "Фото проведенных работ",
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
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    if (safeImages.length >= maxPhotos) {
      setError(`Достигнут лимит в ${maxPhotos} фото`);
      return;
    }
    onChange([...safeImages, urlInput.trim()]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  return (
    <div className={compact ? "space-y-1.5 text-slate-900" : "space-y-2.5 text-slate-900"}>
      <div className="flex items-center justify-between">
        <label className={compact ? "text-[9px] font-black uppercase tracking-wider text-slate-400 block px-0.5" : "text-[10px] font-black uppercase tracking-wider text-slate-400 block"}>
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[9px] text-blue-600 hover:text-blue-700 hover:underline font-bold"
          >
            {showUrlInput ? 'Скрыть URL' : '+ по ссылке URL'}
          </button>
          <span className={compact ? "text-[9px] font-bold text-slate-400 font-mono" : "text-[10px] font-semibold text-slate-400"}>
            {safeImages.length} из {maxPhotos} фото
          </span>
        </div>
      </div>

      {showUrlInput && (
        <div className="flex gap-1.5 p-2 bg-slate-100 rounded-xl border border-slate-200 animate-fadeIn">
          <input
            type="url"
            placeholder="https://example.com/photo.jpg"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            className="flex-1 px-2.5 py-1 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-3 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            Добавить
          </button>
        </div>
      )}

      {error && (
        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-rose-100">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid of uploaded images */}
      {safeImages.length > 0 && (
        <div className={compact ? "grid grid-cols-4 sm:grid-cols-5 gap-1.5" : "grid grid-cols-3 sm:grid-cols-4 gap-2.5"}>
          {safeImages.map((url, idx) => (
            <div key={idx} className={`relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 shadow-xs ${compact ? 'rounded-lg' : 'rounded-xl'}`}>
              <img 
                src={url} 
                alt={`Фото ${idx + 1}`} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" 
              />
              {idx === 0 && (
                <span className={`absolute top-1 left-1 bg-blue-600 text-white font-bold uppercase rounded shadow-xs ${compact ? 'px-1 py-0.2 text-[7px]' : 'px-1.5 py-0.5 text-[8px]'}`}>
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
              className={`border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center aspect-square text-slate-400 hover:text-blue-600 transition-all group bg-white ${compact ? 'rounded-lg border' : 'rounded-xl border-2'}`}
            >
              <Plus className={compact ? "w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" : "w-5 h-5 mb-0.5 group-hover:scale-110 transition-transform"} />
              <span className={compact ? "text-[8px] font-bold uppercase" : "text-[9px] font-bold uppercase"}>+ Фото</span>
            </button>
          )}
        </div>
      )}

      {/* File input / Dropzone if 0 images */}
      {safeImages.length === 0 && (
        <div 
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed transition-all p-3.5 text-center flex flex-col items-center justify-center min-h-[95px] ${
            dragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-1 shadow-inner">
            <Camera className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-700">Загрузите фото проведенных работ</p>
          <p className="text-[10px] text-slate-400 mb-2">Перетащите файлы сюда или нажмите кнопку (до {maxPhotos} шт)</p>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            {loading ? 'Обработка...' : 'Выбрать файлы / Сделать фото'}
          </button>
        </div>
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

export function LightboxModal({ 
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
              <h4 className="font-bold text-sm truncate">{title || 'Фото проведенных работ'}</h4>
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
