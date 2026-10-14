import React, { useCallback, useRef } from 'react';
import { Upload, Camera, Keyboard, CheckCircle, XCircle, Shield, Leaf, Trash2, Cpu, Utensils, Box } from 'lucide-react';

export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  category: ItemCategory;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error?: string;
}

export type ItemCategory = 'fridge' | 'wardrobe' | 'bin' | 'desk' | 'kitchen' | 'other';

export const ITEM_CATEGORIES: {
  id: ItemCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
    { id: 'fridge', label: 'FRIDGE', icon: <Leaf className="w-5 h-5" />, color: 'text-emerald-400' },
    { id: 'wardrobe', label: 'WARDROBE', icon: <Shield className="w-5 h-5" />, color: 'text-blue-400' },
    { id: 'bin', label: 'BIN', icon: <Trash2 className="w-5 h-5" />, color: 'text-amber-400' },
    { id: 'desk', label: 'DESK', icon: <Cpu className="w-5 h-5" />, color: 'text-purple-400' },
    { id: 'kitchen', label: 'KITCHEN', icon: <Utensils className="w-5 h-5" />, color: 'text-orange-400' },
    { id: 'other', label: 'OTHER', icon: <Box className="w-5 h-5" />, color: 'text-gray-400' },
  ];

interface UploadPanelProps {
  selectedCategory: ItemCategory;
  onCategoryChange: (category: ItemCategory) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  onFilesChange: (files: UploadedFile[]) => void;
  isAnalyzing: boolean;
  onCameraClick: () => void;
  onCaptureClick: () => void;
  onManualEntryClick: () => void;
  dragActive: boolean;
  onDragActivate: () => void;
  onDragDeactivate: () => void;
  cameraActive: boolean;
  isCaptureDisabled: boolean;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  selectedCategory,
  onCategoryChange,
  uploadedFiles,
  onRemoveFile,
  onFilesChange,
  isAnalyzing,
  onCameraClick,
  onCaptureClick,
  onManualEntryClick,
  dragActive,
  onDragActivate,
  onDragDeactivate,
  cameraActive,
  isCaptureDisabled,
}) => {
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragActivate();
  }, [onDragActivate]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragDeactivate();
  }, [onDragDeactivate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragDeactivate();

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    processFiles(files);
  }, [onDragDeactivate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const processFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      category: selectedCategory,
      status: 'pending' as const,
    }));

    onFilesChange([...uploadedFiles, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    const file = uploadedFiles.find((f) => f.id === id);
    if (file) URL.revokeObjectURL(file.preview);
    onRemoveFile(id);
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3 min-h-0 flex-1">
      {/* Heading */}
      <div className="flex-shrink-0">
        <h2 className="text-sm font-bold font-mono text-lime-400 tracking-wider uppercase mb-0.5">
          UPLOAD YOUR STUFF
        </h2>
        <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
          Select a zone, add photos, and capture. The Arbiter analyzes materials, embodied carbon, and disposal viability.
        </p>
      </div>

      {/* Category Tiles */}
      <div className="flex-shrink-0">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {ITEM_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onCategoryChange(cat.id);
              }}
              className={`relative p-2.5 rounded-lg border-2 transition-all text-left ${cat.id === selectedCategory
                  ? 'border-lime-500 bg-lime-500/10'
                  : 'border-gray-700 hover:border-lime-500/50 hover:bg-gray-900/30'
                }`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded bg-gray-900 border border-gray-700 mb-1.5 ${cat.color}`}>
                {cat.icon}
              </div>
              <span className="text-[10px] font-mono font-medium text-gray-200">{cat.label}</span>
              {cat.id === selectedCategory && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full border-2 border-lime-500 flex items-center justify-center">
                  <CheckCircle className="w-2.5 h-2.5 text-lime-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Zone / Upload Button */}
      <div className="flex-shrink-0">
        {cameraActive ? (
          <div className="relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer bg-[#121a14] border-lime-500/50">
            <Camera className="w-10 h-10 mx-auto mb-2 text-lime-400" />
            <p className="text-sm font-mono text-lime-300 mb-1">CAMERA ACTIVE</p>
            <p className="text-[10px] font-mono text-gray-500 mb-4">POSITION OBJECT IN FRAME</p>
            <button
              type="button"
              onClick={onCaptureClick}
              disabled={isCaptureDisabled || isAnalyzing}
              className="w-full py-2.5 px-4 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold font-mono text-sm rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>CAPTURE PHOTO</span>
            </button>
          </div>
        ) : (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${dragActive
                ? 'border-lime-400 bg-lime-500/5 shadow-[0_0_25px_rgba(180,255,57,0.1)]'
                : 'border-gray-700 hover:border-lime-500/50 hover:bg-gray-900/30'
              }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Drop zone for image uploads"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isAnalyzing}
            />

            <Upload className={`w-10 h-10 mx-auto mb-2 text-gray-500 transition-colors ${dragActive ? 'text-lime-400' : ''}`} />
            <p className="text-sm font-mono text-gray-400 mb-0.5">
              {dragActive ? 'DROP IMAGES HERE' : 'CLICK OR DRAG IMAGES TO UPLOAD'}
            </p>
            <p className="text-[9px] font-mono text-gray-600 mt-0.5">
              PNG, JPG, WEBP • MAX 10MB EACH • SCAN OBJECTS, NOT PEOPLE
            </p>
          </div>
        )}

        {/* Action Buttons (when camera not active) */}
        {!cameraActive && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={onCameraClick}
              disabled={isAnalyzing}
              className="py-2.5 px-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-lime-400" />
              <span>USE CAMERA</span>
            </button>

            <button
              type="button"
              onClick={onManualEntryClick}
              disabled={isAnalyzing}
              className="py-2.5 px-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 border border-gray-700 font-mono text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-lime-400" />
              <span>MANUAL</span>
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="border-t border-gray-800 pt-3 space-y-2 flex-shrink-0 max-h-[180px] overflow-y-auto">
          <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-2">
            QUEUED FOR ANALYSIS ({uploadedFiles.length})
          </h3>
          <div className="space-y-1.5">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 bg-[#0c110d] border border-gray-800 rounded"
              >
                <img
                  src={file.preview}
                  alt={`Upload: ${file.file.name}`}
                  className="w-10 h-10 object-cover rounded border border-gray-700 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-gray-200 truncate">{file.file.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.5 text-[9px] font-mono bg-gray-900 border border-gray-700 rounded text-gray-400">
                      {ITEM_CATEGORIES.find((c) => c.id === file.category)?.label || 'GENERAL'}
                    </span>
                    <span className={`flex items-center gap-1 text-[9px] font-mono ${file.status === 'complete' ? 'text-lime-400' :
                        file.status === 'analyzing' ? 'text-amber-400 animate-pulse' :
                          file.status === 'error' ? 'text-red-400' : 'text-gray-500'
                      }`}>
                      {file.status === 'complete' && <CheckCircle className="w-2.5 h-2.5" />}
                      {file.status === 'analyzing' && (
                        <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      {file.status === 'error' && <XCircle className="w-2.5 h-2.5" />}
                      {file.status === 'pending' && (
                        <span className="w-2.5 h-2.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      <span className="uppercase">{file.status}</span>
                    </span>
                  </div>
                  {file.error && (
                    <p className="text-[9px] font-mono text-red-400 mt-0.5 truncate">{file.error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.id)}
                  className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                  aria-label={`Remove ${file.file.name}`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State Hint */}
      {uploadedFiles.length === 0 && !isAnalyzing && !cameraActive && (
        <div className="text-center py-3 border-t border-gray-800 flex-shrink-0">
          <p className="text-[10px] font-mono text-gray-600">
            NO ITEMS QUEUED. SELECT A ZONE AND UPLOAD IMAGES TO BEGIN.
          </p>
        </div>
      )}

      {/* Privacy & Impact Footer */}
      <div className="flex-shrink-0 pt-2 border-t border-gray-800">
        <div className="flex flex-col gap-2">
          {/* Privacy */}
          <div className="flex items-start gap-2 p-2 rounded bg-[#0c110d] border border-gray-800">
            <Shield className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-gray-400 leading-relaxed">
              <span className="text-gray-300 font-bold">PRIVACY:</span> Your photos are processed, not stored. We don't save any images on our servers.
            </div>
          </div>
          {/* Impact */}
          <div className="flex items-start gap-2 p-2 rounded bg-[#0c110d] border border-gray-800">
            <Leaf className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] font-mono text-gray-400 leading-relaxed">
              <span className="text-gray-300 font-bold">IMPACT:</span> Scan objects, not people.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPanel;