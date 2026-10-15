import React from 'react';
import { Upload, CheckCircle, XCircle, FileImage } from 'lucide-react';

interface EvidenceDropZoneProps {
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
 * Click-or-drag staging zone for the room photo. Clicking opens the scanner's
 * hidden file input; dropping an image stages it for the audit. The staged
 * state shows the file name and a REMOVE action that clears the still.
 */
export const EvidenceDropZone: React.FC<EvidenceDropZoneProps> = ({
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
  );
};

export default EvidenceDropZone;
