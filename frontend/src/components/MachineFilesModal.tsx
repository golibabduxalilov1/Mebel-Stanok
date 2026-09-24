import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FolderOpen,
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  Film,
  Archive,
  Download,
  Trash2,
  Eye,
  ExternalLink,
  Star,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Play,
  Grid,
  List,
  Clock,
  User,
  HardDrive,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Machine, MachineAttachment, MachineAttachmentType, Role, AppUser } from '../types';
import { compressImage } from './PhotoPicker';
import { machineService } from '../services/machineService';
import { ApiError } from '../lib/apiClient';

/** Generates a JPEG poster frame (~15-25KB) for a video, uploaded alongside it as the attachment's thumbnail. */
async function generateVideoThumbnail(file: File | Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }, 5000);

      video.onloadedmetadata = () => {
        const target = Math.min(1.0, video.duration / 2 || 0.5);
        video.currentTime = target;
      };

      video.onseeked = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let w = video.videoWidth || 320;
          let h = video.videoHeight || 240;

          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(objectUrl);
              resolve(blob);
            }, 'image/jpeg', 0.75);
            return;
          }
        } catch {
          // ignore error
        }
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      video.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/** True for the synthetic read-only entries synthesized below from machine.imageUrl/imageUrls - not real attachment rows. */
function isLegacyPhoto(attachment: MachineAttachment): boolean {
  return attachment.id.startsWith('legacy-photo-');
}

/** Only .docx can be rendered inline (via mammoth) - legacy .doc and other document types still fall back to download. */
function isDocx(attachment: MachineAttachment): boolean {
  return attachment.type === 'document' && attachment.name.toLowerCase().endsWith('.docx');
}

interface MachineFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine;
  role?: Role | null;
  currentUser?: AppUser | null;
  onMachineUpdated: (updatedMachine: Machine) => void;
}

export function MachineFilesModal({
  isOpen,
  onClose,
  machine,
  role,
  currentUser,
  onMachineUpdated
}: MachineFilesModalProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'video' | 'pdf' | 'document' | 'archive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab] = useState<'files'>('files');

  // Upload state
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
    percent?: number;
    stage?: string;
  } | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files chosen but not yet saved - selecting/dropping files no longer uploads them
  // immediately; the user reviews the list and presses "Сохранить" to upload.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Media preview modal state
  const [previewItem, setPreviewItem] = useState<MachineAttachment | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewDocxHtml, setPreviewDocxHtml] = useState<string | null>(null);
  const [previewDocxError, setPreviewDocxError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (previewItem && previewItem.type === 'video') {
      // Note: resolvedUrls[id] holds this video's thumbnail poster (pre-resolved for the
      // grid), not the video itself - the actual video file is always fetched separately.
      setPreviewVideoUrl(null);
      machineService.resolveAttachmentUrl(previewItem.id, previewItem.url).then(url => {
        if (isMounted) setPreviewVideoUrl(url);
      });
    } else {
      setPreviewVideoUrl(null);
    }
    return () => { isMounted = false; };
  }, [previewItem]);

  // Renders .docx inline (no download): converts the already-resolved blob to HTML client-side via mammoth.
  useEffect(() => {
    let isMounted = true;
    setPreviewDocxHtml(null);
    setPreviewDocxError(false);
    if (previewItem && isDocx(previewItem)) {
      (async () => {
        try {
          const resolved = resolvedUrls[previewItem.id] || await machineService.resolveAttachmentUrl(previewItem.id, previewItem.url);
          const res = await fetch(resolved);
          const arrayBuffer = await res.arrayBuffer();
          const mammoth = await import('mammoth');
          const { value } = await mammoth.convertToHtml({ arrayBuffer });
          if (isMounted) setPreviewDocxHtml(value);
        } catch (err) {
          console.error('DOCX preview error:', err);
          if (isMounted) setPreviewDocxError(true);
        }
      })();
    }
    return () => { isMounted = false; };
  }, [previewItem, resolvedUrls]);

  // Normalize existing attachments, incorporating any machine.imageUrls that might not yet be in attachments
  const attachments: MachineAttachment[] = useMemo(() => {
    const list: MachineAttachment[] = [...(machine.attachments || [])];

    // Check if there are legacy photos in machine.imageUrls not yet represented
    const legacyPhotos = machine.imageUrls || (machine.imageUrl ? [machine.imageUrl] : []);
    legacyPhotos.forEach((imgUrl, idx) => {
      if (!imgUrl) return;
      const alreadyExists = list.some(a => a.url === imgUrl);
      if (!alreadyExists) {
        list.push({
          id: `legacy-photo-${idx}-${machine.id}`,
          name: `Фото станка #${idx + 1}`,
          type: 'image',
          url: imgUrl,
          uploadedAt: machine.installationDate || new Date().toISOString(),
          uploadedBy: 'Система',
          isMainImage: imgUrl === machine.imageUrl
        });
      }
    });

    return list;
  }, [machine]);

  // Filtered files
  const filteredAttachments = useMemo(() => {
    return attachments.filter(item => {
      return activeFilter === 'all' || item.type === activeFilter;
    });
  }, [attachments, activeFilter]);

  // Counts by category
  const counts = useMemo(() => {
    return {
      all: attachments.length,
      image: attachments.filter(a => a.type === 'image').length,
      video: attachments.filter(a => a.type === 'video').length,
      pdf: attachments.filter(a => a.type === 'pdf').length,
      document: attachments.filter(a => a.type === 'document').length,
      archive: attachments.filter(a => a.type === 'archive').length,
    };
  }, [attachments]);

  // Pre-resolve URLs (backend attachments need an authenticated blob fetch; legacy entries resolve instantly)
  useEffect(() => {
    let isMounted = true;
    async function resolveAll() {
      const urls: Record<string, string> = {};
      for (const att of attachments) {
        try {
          const resolved = await machineService.resolveAttachmentUrl(att.id, att.url, { thumbnail: att.type === 'video' });
          if (resolved) urls[att.id] = resolved;
        } catch (e) {
          console.error('Error resolving attachment URL:', e);
        }
      }
      if (isMounted) {
        setResolvedUrls(prev => ({ ...prev, ...urls }));
      }
    }
    if (attachments.length > 0) {
      resolveAll();
    }
    return () => { isMounted = false; };
  }, [attachments, machine.id]);

  if (!isOpen) return null;

  // Format file size
  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Detect file type
  const detectFileType = (file: File): MachineAttachmentType => {
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();

    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|heic|heif)$/i.test(name)) {
      return 'image';
    }
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v|3gp|wmv|flv|ts|mts)$/i.test(name)) {
      return 'video';
    }
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      return 'pdf';
    }
    if (
      /\.(doc|docx|xls|xlsx|csv|txt|rtf|odt|ods|ppt|pptx)$/i.test(name) ||
      mime.includes('word') ||
      mime.includes('sheet') ||
      mime.includes('excel') ||
      mime.includes('text')
    ) {
      return 'document';
    }
    if (/\.(zip|rar|7z|tar|gz|dwg|dxf|step|stp|iges)$/i.test(name)) {
      return 'archive';
    }
    return 'other';
  };

  // Queue files chosen via the picker or drag-and-drop for review before uploading.
  const queueFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);
    setPendingFiles(prev => [...prev, ...list]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePendingFiles = async () => {
    const files = pendingFiles;
    setPendingFiles([]);
    await handleFiles(files);
  };

  // Handle uploaded files (videos, photos, docs) - each goes straight to the backend's attachment endpoint.
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);
    setIsProcessing(true);

    const newAttachments: MachineAttachment[] = [];
    const total = files.length;
    const hasExistingMainImage = attachments.some(a => a.type === 'image' && a.isMainImage);

    try {
      for (let i = 0; i < total; i++) {
        const file = files[i];
        const fileType = detectFileType(file);

        setUploadProgress({
          current: i + 1,
          total,
          currentFileName: file.name,
          percent: Math.round((i / total) * 100),
          stage: fileType === 'video' ? `Обработка видео (${formatBytes(file.size)})...` : `Загрузка ${file.name}...`
        });

        let uploadFile: File | Blob = file;
        let thumbnail: Blob | undefined;

        if (fileType === 'video') {
          const thumb = await generateVideoThumbnail(file);
          if (thumb) thumbnail = thumb;
        } else if (fileType === 'image') {
          try {
            const compressedDataUrl = await compressImage(file, 1400, 1400, 0.82);
            const res = await fetch(compressedDataUrl);
            uploadFile = await res.blob();
          } catch {
            uploadFile = file;
          }
        }

        const isMainImage = fileType === 'image' && !hasExistingMainImage && newAttachments.every(a => a.type !== 'image');

        const attachment = await machineService.uploadAttachment(
          machine.id,
          uploadFile instanceof File ? uploadFile : new File([uploadFile], file.name, { type: file.type }),
          { name: file.name, type: fileType, isMainImage },
          thumbnail
        );

        newAttachments.push(attachment);
      }

      if (newAttachments.length > 0) {
        const updatedMachine: Machine = {
          ...machine,
          attachments: [...newAttachments, ...attachments],
        };
        onMachineUpdated(updatedMachine);

        const videoCount = newAttachments.filter(a => a.type === 'video').length;
        if (videoCount > 0) {
          setUploadSuccess(`Видео успешно добавлено (${videoCount}) и сохранено в папку станка!`);
        } else {
          setUploadSuccess(`Успешно добавлено файлов: ${newAttachments.length}`);
        }
      }
    } catch (err) {
      console.error('File upload error:', err);
      setUploadError('Ошибка при чтении или сохранении файлов. Попробуйте снова.');
    } finally {
      setIsProcessing(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete attachment
  const handleDeleteAttachment = async (attachmentId: string) => {
    const itemToDelete = attachments.find(a => a.id === attachmentId);
    if (!itemToDelete) return;

    if (!window.confirm(`Удалить файл «${itemToDelete.name}» из папки станка?`)) {
      return;
    }

    try {
      if (isLegacyPhoto(itemToDelete)) {
        // Synthetic entry sourced from machine.imageUrl/imageUrls, not a real attachment row.
        const updatedImageUrls = (machine.imageUrls || (machine.imageUrl ? [machine.imageUrl] : []))
          .filter(url => url !== itemToDelete.url);
        const updatedMainImageUrl = machine.imageUrl === itemToDelete.url
          ? (updatedImageUrls[0] || '')
          : machine.imageUrl;

        await machineService.updateMachine(machine.id, {
          imageUrls: updatedImageUrls,
          imageUrl: updatedMainImageUrl,
        });

        const updatedMachine: Machine = { ...machine, imageUrls: updatedImageUrls, imageUrl: updatedMainImageUrl };
        onMachineUpdated(updatedMachine);
      } else {
        await machineService.deleteAttachment(attachmentId);

        const updatedList = attachments.filter(a => a.id !== attachmentId);
        const updatedMachine: Machine = { ...machine, attachments: updatedList };
        onMachineUpdated(updatedMachine);
      }

      if (previewItem?.id === attachmentId) {
        setPreviewItem(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // File was already removed server-side (e.g. deleted from another session/tab).
        // Drop the stale row from the UI instead of leaving it permanently stuck - every
        // retry would just 404 again since there is nothing left on the server to delete.
        const updatedList = attachments.filter(a => a.id !== attachmentId);
        onMachineUpdated({ ...machine, attachments: updatedList });
        if (previewItem?.id === attachmentId) setPreviewItem(null);
        return;
      }
      console.error(err);
      alert('Ошибка при удалении файла');
    }
  };

  // Set as main machine photo (within the attachments folder)
  const handleSetAsMainImage = async (attachment: MachineAttachment) => {
    if (attachment.type !== 'image' || isLegacyPhoto(attachment)) return;

    try {
      await machineService.setMainImage(attachment.id);

      const updatedList = attachments.map(a => ({
        ...a,
        isMainImage: a.id === attachment.id,
      }));
      const updatedMachine: Machine = { ...machine, attachments: updatedList };
      onMachineUpdated(updatedMachine);
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении главной фотографии');
    }
  };

  // Download attachment
  const handleDownload = async (attachment: MachineAttachment) => {
    try {
      const resolved = resolvedUrls[attachment.id] || await machineService.resolveAttachmentUrl(attachment.id, attachment.url);
      if (!resolved) {
        alert('Файл недоступен');
        return;
      }
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        const link = document.createElement('a');
        link.href = resolved;
        link.download = attachment.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      const link = document.createElement('a');
      link.href = resolved;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Ошибка при скачивании файла');
    }
  };

  // Render file icon based on type
  const renderFileIcon = (type: MachineAttachmentType, className = "w-5 h-5") => {
    switch (type) {
      case 'image':
        return <ImageIcon className={`${className} text-emerald-600`} />;
      case 'video':
        return <Video className={`${className} text-rose-600`} />;
      case 'pdf':
        return <FileText className={`${className} text-red-600`} />;
      case 'document':
        return <FileText className={`${className} text-blue-600`} />;
      case 'archive':
        return <Archive className={`${className} text-amber-600`} />;
      default:
        return <FileText className={`${className} text-slate-500`} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-5xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 text-slate-900 relative"
      >
        {/* Hidden global file input for choosing files from device */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) queueFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {/* Header */}
        <div className="px-4 py-3 sm:px-8 sm:py-5 border-b border-slate-100 bg-slate-50/80 flex items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-100/90 text-amber-800 flex items-center justify-center shadow-xs shrink-0">
              <FolderOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-base sm:text-xl font-black text-slate-900 break-words min-w-0">
                  Папка материалов станка
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                  {attachments.length} {attachments.length === 1 ? 'файл' : attachments.length < 5 ? 'файла' : 'файлов'}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 break-words mt-0.5">
                <span className="font-semibold text-slate-700">{machine.name}</span>
                {machine.model && <span> • Модель: {machine.model}</span>}
                {machine.serialNumber && <span> • С/Н: {machine.serialNumber}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-10 min-w-10 flex items-center justify-center p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pending files review - shown after picking/dropping files, before they're saved */}
        {pendingFiles.length > 0 && !isProcessing && (
          <div className="mx-5 sm:mx-8 mt-4 p-4 bg-blue-50/60 border border-blue-200 rounded-2xl shadow-xs space-y-3">
            <p className="text-xs font-bold text-blue-900">
              Выбрано файлов: {pendingFiles.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((file, idx) => (
                <span
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-blue-200 rounded-xl text-[11px] font-semibold text-slate-700 max-w-[220px]"
                >
                  <span className="truncate" title={file.name}>{file.name}</span>
                  <span className="text-slate-400 font-mono shrink-0">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => removePendingFile(idx)}
                    className="text-slate-400 hover:text-rose-600 shrink-0"
                    title="Убрать файл"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSavePendingFiles}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                Сохранить
              </button>
              <button
                onClick={() => setPendingFiles([])}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {uploadProgress && (
          <div className="mx-5 sm:mx-8 mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                {uploadProgress.stage || 'Загрузка видео и файлов...'}
              </span>
              <span className="font-mono text-blue-700 font-bold bg-white px-2 py-0.5 rounded-md border border-blue-200 text-[11px]">
                {uploadProgress.current} из {uploadProgress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200/80 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(uploadProgress.percent || 0, 15)}%` }}
              />
            </div>
            <p className="text-[11px] text-blue-700 truncate font-medium">
              Файл: {uploadProgress.currentFileName}
            </p>
          </div>
        )}

        {uploadError && (
          <div className="mx-5 mt-4 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className="mx-5 mt-4 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="flex-1">{uploadSuccess}</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shrink-0"
            >
              Закрыть
            </button>
            <button onClick={() => setUploadSuccess(null)} className="text-emerald-400 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-8 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto bg-white">
          <div className="flex gap-1 py-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Выбрать файлы на компьютере или телефоне"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выбрать файлы</span>
              <span className="sm:hidden">Файлы</span>
            </button>
          </div>

          {activeTab === 'files' && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Вид: Сетка"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Вид: Список"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
          {/* TAB 1: FILE EXPLORER */}
          {activeTab === 'files' && (
            <div className="space-y-5">
              {/* Category Filter Pills */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  {[
                    { id: 'all', label: 'Все', count: counts.all, icon: FolderOpen },
                    { id: 'image', label: 'Фото', count: counts.image, icon: ImageIcon },
                    { id: 'video', label: 'Видео', count: counts.video, icon: Video },
                    { id: 'pdf', label: 'PDF', count: counts.pdf, icon: FileText },
                    { id: 'document', label: 'Документы', count: counts.document, icon: FileText },
                    { id: 'archive', label: 'Схемы/Архивы', count: counts.archive, icon: Archive },
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                          activeFilter === tab.id
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          activeFilter === tab.id ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Empty state */}
              {filteredAttachments.length === 0 ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files) queueFiles(e.dataTransfer.files);
                  }}
                  className={`py-14 text-center border-2 border-dashed rounded-3xl transition-all flex flex-col items-center justify-center ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-16 h-16 rounded-3xl bg-amber-100/70 text-amber-700 flex items-center justify-center mb-3 shadow-inner">
                    <FolderOpen className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    В папке станка пока нет файлов
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                    Сюда можно скидывать всё что есть: видео работы станка, фотографии шильдиков и узлов, PDF паспорта, руководства, электросхемы и чертежи.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {isProcessing ? 'Загрузка...' : 'Выбрать файлы'}
                    </button>
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredAttachments.map((item) => (
                    <div
                      key={item.id}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all flex flex-col overflow-hidden relative"
                    >
                      {/* Card Thumbnail / Preview */}
                      <div
                        className="h-36 bg-slate-100 relative overflow-hidden flex items-center justify-center cursor-pointer border-b border-slate-100"
                        onClick={() => {
                          if (item.type === 'image' || item.type === 'video' || item.type === 'pdf' || isDocx(item)) {
                            setPreviewItem(item);
                          } else {
                            handleDownload(item);
                          }
                        }}
                      >
                        {item.type === 'image' ? (
                          <img
                            src={resolvedUrls[item.id] || item.url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : item.type === 'video' ? (
                          <div className="w-full h-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
                            {resolvedUrls[item.id] ? (
                              <img
                                src={resolvedUrls[item.id]}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-3 text-center">
                                <Film className="w-10 h-10 text-rose-500 mb-1" />
                                <span className="text-[11px] font-bold text-slate-200">Видеозапись</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-rose-600 transition-all">
                                <Play className="w-5 h-5 ml-0.5 fill-current" />
                              </div>
                            </div>
                          </div>
                        ) : item.type === 'pdf' ? (
                          <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center text-red-600">
                            <FileText className="w-12 h-12 stroke-[1.5]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-500 mt-1">PDF Документ</span>
                          </div>
                        ) : item.type === 'document' ? (
                          <div className="w-full h-full bg-blue-50 flex flex-col items-center justify-center text-blue-600">
                            <FileText className="w-12 h-12 stroke-[1.5]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 mt-1">Документ / Таблица</span>
                          </div>
                        ) : item.type === 'archive' ? (
                          <div className="w-full h-full bg-amber-50 flex flex-col items-center justify-center text-amber-700">
                            <Archive className="w-12 h-12 stroke-[1.5]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 mt-1">Архив / Чертёж</span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-12 h-12 stroke-[1.5]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Файл</span>
                          </div>
                        )}

                        {/* Top corner badge */}
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-xs text-slate-800 shadow-xs flex items-center gap-1">
                            {renderFileIcon(item.type, "w-3 h-3")}
                            {item.type}
                          </span>
                          {item.isMainImage && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              Главное
                            </span>
                          )}
                        </div>

                        {/* Size badge */}
                        {item.sizeFormatted && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-900/80 text-white">
                            {item.sizeFormatted}
                          </span>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <p
                            className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-blue-600 cursor-pointer"
                            title={item.name}
                            onClick={() => {
                              if (item.type === 'image' || item.type === 'video' || item.type === 'pdf' || isDocx(item)) setPreviewItem(item);
                              else handleDownload(item);
                            }}
                          >
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(item.uploadedAt).toLocaleDateString('ru-RU')}
                            </span>
                            {item.uploadedBy && (
                              <span className="flex items-center gap-0.5 truncate max-w-[100px]" title={item.uploadedBy}>
                                <User className="w-2.5 h-2.5" />
                                {item.uploadedBy}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            {item.type === 'image' && !item.isMainImage && !isLegacyPhoto(item) && (
                              <button
                                onClick={() => handleSetAsMainImage(item)}
                                className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors"
                                title="Сделать главным фото станка"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(item.type === 'image' || item.type === 'video' || item.type === 'pdf' || isDocx(item)) && (
                              <button
                                onClick={() => setPreviewItem(item)}
                                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                title="Посмотреть"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDownload(item)}
                              className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                              title="Скачать файл"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteAttachment(item.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Удалить из папки"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* LIST VIEW */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <th className="py-3 px-4">Тип</th>
                          <th className="py-3 px-4">Наименование файла</th>
                          <th className="py-3 px-4">Размер</th>
                          <th className="py-3 px-4">Дата загрузки</th>
                          <th className="py-3 px-4">Автор</th>
                          <th className="py-3 px-4 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredAttachments.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {renderFileIcon(item.type, "w-4 h-4")}
                                <span className="font-semibold uppercase text-[10px] text-slate-500">
                                  {item.type}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  onClick={() => {
                                    if (item.type === 'image' || item.type === 'video' || item.type === 'pdf' || isDocx(item)) setPreviewItem(item);
                                    else handleDownload(item);
                                  }}
                                  className="cursor-pointer hover:text-blue-600 truncate"
                                  title={item.name}
                                >
                                  {item.name}
                                </span>
                                {item.isMainImage && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">
                                    Главное фото
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-slate-400 font-normal italic truncate">{item.description}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {item.sizeFormatted || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(item.uploadedAt).toLocaleDateString('ru-RU')}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                              {item.uploadedBy || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {item.type === 'image' && !item.isMainImage && !isLegacyPhoto(item) && (
                                  <button
                                    onClick={() => handleSetAsMainImage(item)}
                                    className="p-1 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded"
                                    title="Сделать главным фото"
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(item.type === 'image' || item.type === 'video' || item.type === 'pdf' || isDocx(item)) && (
                                  <button
                                    onClick={() => setPreviewItem(item)}
                                    className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded"
                                    title="Посмотреть"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownload(item)}
                                  className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded"
                                  title="Скачать"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAttachment(item.id)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-3 sm:px-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 min-w-0">
            <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="min-w-0 break-words">Папка привязана к станку: <strong className="text-slate-700">{machine.name}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="min-h-10 shrink-0 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            Закрыть
          </button>
        </div>
      </motion.div>

      {/* MEDIA PREVIEW MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Top bar of preview */}
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between text-white border-b border-white/10">
              <div className="flex items-center gap-2 truncate mr-3">
                {renderFileIcon(previewItem.type, "w-4 h-4 text-white")}
                <span className="font-bold text-xs sm:text-sm truncate">{previewItem.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewItem.type === 'image' && !previewItem.isMainImage && !isLegacyPhoto(previewItem) && (
                  <button
                    onClick={() => {
                      handleSetAsMainImage(previewItem);
                      setPreviewItem(null);
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                    title="Сделать главным фото станка"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">Сделать главным</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownload(previewItem)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
                  title="Скачать файл"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Media Body */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/90 min-h-[300px]">
              {previewItem.type === 'image' ? (
                <img
                  src={resolvedUrls[previewItem.id] || previewItem.url}
                  alt={previewItem.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              ) : previewItem.type === 'video' ? (
                previewVideoUrl ? (
                  <div className="flex flex-col items-center justify-center w-full max-h-[75vh]">
                    <video
                      controls
                      autoPlay
                      playsInline
                      src={previewVideoUrl}
                      className="max-h-[72vh] max-w-full rounded-xl shadow-2xl bg-black"
                    />
                  </div>
                ) : previewItem.url.startsWith('http') && (previewItem.url.includes('youtube') || previewItem.url.includes('rutube') || previewItem.url.includes('vimeo')) ? (
                  <div className="text-center p-8 text-white space-y-4">
                    <Video className="w-16 h-16 text-rose-500 mx-auto" />
                    <p className="font-bold text-base">Онлайн видео (внешний сервис)</p>
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Смотреть на внешнем сервисе
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-white space-y-3">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-300">Подготовка видео к воспроизведению...</p>
                  </div>
                )
              ) : previewItem.type === 'pdf' ? (
                resolvedUrls[previewItem.id] ? (
                  <iframe
                    src={resolvedUrls[previewItem.id]}
                    title={previewItem.name}
                    className="w-full h-[75vh] max-w-full rounded-xl shadow-2xl bg-white"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-white space-y-3">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    <p className="text-sm font-semibold text-slate-300">Загрузка PDF...</p>
                  </div>
                )
              ) : isDocx(previewItem) && !previewDocxError ? (
                previewDocxHtml ? (
                  <div className="w-full h-[75vh] overflow-y-auto rounded-xl shadow-2xl bg-white">
                    <div
                      className="docx-preview-content max-w-3xl mx-auto p-8 sm:p-12 text-slate-900 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: previewDocxHtml }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-white space-y-3">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    <p className="text-sm font-semibold text-slate-300">Загрузка документа...</p>
                  </div>
                )
              ) : (
                <div className="text-center p-8 text-white">
                  <FileText className="w-16 h-16 text-blue-400 mx-auto mb-3" />
                  <p className="font-bold text-base">{previewItem.name}</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">{previewItem.sizeFormatted}</p>
                  <button
                    onClick={() => handleDownload(previewItem)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    Скачать файл
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
