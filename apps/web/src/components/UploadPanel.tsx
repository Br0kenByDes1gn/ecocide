import React from 'react';
import { Upload, CheckCircle, XCircle, Shield, Leaf, Trash2, Cpu, Utensils, Box, FileImage } from 'lucide-react';

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
 * Upload + category panel for the household audit. The category selection is
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
    <div className="w-full space-y-4">
      {/* Category chips */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            AUDIT AREA (OPTIONAL HINT)
          </span>
          <span className="text-[10px] font-mono text-gray-600">
            {ITEM_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? 'OTHER'}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {ITEM_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => onCategoryChange(category.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? `bg-lime-500/10 border-lime-500/60 ${category.color} shadow-[0_0_12px_rgba(180,255,57,0.15)]`
                    : 'bg-black/30 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                }`}
                title={`Audit area hint: ${category.label}`}
              >
                <span className={isSelected ? category.color : 'text-gray-600'}>{category.icon}</span>
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drop zone + upload button */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onDragActivate();
        }}
        onDragLeave={onDragDeactivate}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition-all ${
          dragActive
            ? 'border-lime-400 bg-lime-500/10'
            : 'border-gray-800 bg-black/20 hover:border-lime-500/40'
        }`}
      >
        {selectedFileName ? (
          <div className="flex items-center justify-center gap-3 text-xs font-mono">
            <FileImage className="w-4 h-4 text-lime-400" />
            <span className="text-gray-300 truncate max-w-[220px]">{selectedFileName}</span>
            <span className="flex items-center gap-1 text-lime-400">
              <CheckCircle className="w-3.5 h-3.5" /> STAGED
            </span>
            {onClearFile && (
              <button
                type="button"
                onClick={onClearFile}
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
            <Upload className="w-6 h-6 text-gray-500 mx-auto mb-1.5" />
            <p className="text-[11px] font-mono text-gray-400">
              DRAG A ROOM PHOTO HERE — OR
              <button
                type="button"
                onClick={onUploadClick}
                disabled={isAnalyzing}
                className="ml-1 text-lime-400 hover:text-lime-300 underline underline-offset-2 cursor-pointer disabled:opacity-40"
              >
                BROWSE FILES
              </button>
            </p>
            <p className="text-[9px] font-mono text-gray-600 mt-1">
              JPEG / PNG / WEBP — ONE ROOM PER AUDIT. SCAN OBJECTS, NOT PEOPLE.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;