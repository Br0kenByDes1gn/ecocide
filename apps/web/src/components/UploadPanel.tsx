import React from 'react';
import { Upload, CheckCircle, XCircle, Bed, Bath, Utensils, Leaf, Briefcase, Box, FileImage } from 'lucide-react';

export type ItemCategory = 'bedroom' | 'bathroom' | 'kitchen' | 'outdoors' | 'workspace' | 'others';

export const ITEM_CATEGORIES: {
  id: ItemCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { id: 'bedroom', label: 'BEDROOM', icon: <Bed className="w-5 h-5" />, color: 'text-emerald-400' },
  { id: 'bathroom', label: 'BATHROOM', icon: <Bath className="w-5 h-5" />, color: 'text-blue-400' },
  { id: 'kitchen', label: 'KITCHEN', icon: <Utensils className="w-5 h-5" />, color: 'text-orange-400' },
  { id: 'outdoors', label: 'OUTDOORS', icon: <Leaf className="w-5 h-5" />, color: 'text-lime-400' },
  { id: 'workspace', label: 'WORKSPACE', icon: <Briefcase className="w-5 h-5" />, color: 'text-purple-400' },
  { id: 'others', label: 'OTHERS', icon: <Box className="w-5 h-5" />, color: 'text-gray-400' },
];

interface UploadPanelProps {
  selectedCategory: ItemCategory;
  onCategoryChange: (category: ItemCategory) => void;
  /** Fired with a dropped/selected image file (single-file audit). */
  onFileSelected: (file: File) => void;
  /** Opens the hidden file input owned by the scanner. */
  onUploadClick: () => void;
  /** Name of the currently staged evidence file, when one exists. */
  selectedFileName?: string | null;
  onClearFile?: () => void;
  dragActive: boolean;
  onDragActivate: () => void;
  onDragDeactivate: () => void;
  isAnalyzing: boolean;
}

/**
 * Upload + audit-area panel for the household audit. The category selection is
 * a hint for the auditor (the room area being photographed); the audit itself
 * is single-photo — the Arbiter audits one room per scan.
 */
export const UploadPanel: React.FC<UploadPanelProps> = ({
  selectedCategory,
  onCategoryChange,
  onFileSelected,
  onUploadClick,
  selectedFileName,
  onClearFile,
  dragActive,
  onDragActivate,
  onDragDeactivate,
  isAnalyzing,
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragDeactivate();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onFileSelected(file);
  };

  return (
    <div className="w-full space-y-3">
      {/* Audit-area tiles: a hint for the auditor, not a hard filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            AUDIT AREA
          </span>
          <span className="text-[10px] font-mono text-gray-600">
            {ITEM_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? 'OTHER'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ITEM_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => onCategoryChange(category.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? `bg-lime-500/10 border-lime-500/60 ${category.color} shadow-[0_0_12px_rgba(180,255,57,0.15)]`
                    : 'bg-gray-900/40 border-gray-700 text-gray-300 hover:border-lime-500/40 hover:text-gray-100'
                }`}
                title={`Audit area hint: ${category.label}`}
              >
                <span className={isSelected ? category.color : 'text-gray-500'}>{category.icon}</span>
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drag & drop staging area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onDragActivate();
        }}
        onDragLeave={onDragDeactivate}
        onDrop={handleDrop}
        onClick={() => !isAnalyzing && onUploadClick()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isAnalyzing) onUploadClick();
          }
        }}
        aria-label="Drop zone for the room photo"
        className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-lime-400 bg-lime-500/5'
            : 'border-gray-700 hover:border-lime-500/50 hover:bg-gray-900/30'
        }`}
      >
        {selectedFileName ? (
          <div className="flex items-center justify-center gap-3 text-xs font-mono">
            <FileImage className="w-4 h-4 text-lime-400" />
            <span className="text-gray-300 truncate max-w-[200px]">{selectedFileName}</span>
            <span className="flex items-center gap-1 text-lime-400">
              <CheckCircle className="w-3.5 h-3.5" /> STAGED
            </span>
            {onClearFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFile();
                }}
                disabled={isAnalyzing}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400 rounded px-1.5 py-0.5 transition-colors cursor-pointer disabled:opacity-40"
                title="Remove the staged evidence"
              >
                <XCircle className="w-3 h-3" />
                REMOVE
              </button>
            )}
          </div>
        ) : (
          <>
            <Upload
              className={`w-8 h-8 mx-auto mb-2 text-gray-500 transition-colors ${dragActive ? 'text-lime-400' : ''}`}
            />
            <p className="text-sm font-mono text-gray-400 mb-0.5">
              {dragActive ? 'DROP IMAGE HERE' : 'CLICK OR DRAG IMAGE TO UPLOAD'}
            </p>
            <p className="text-[9px] font-mono text-gray-600 mt-0.5">
              PNG, JPG, WEBP — ONE ROOM PER AUDIT. SCAN OBJECTS, NOT PEOPLE.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;
