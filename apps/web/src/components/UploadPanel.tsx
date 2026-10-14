import React from 'react';
import { Bed, Bath, Utensils, Leaf, Briefcase, Box } from 'lucide-react';

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
  isAnalyzing: boolean;
}

/**
 * Audit-area picker for the household audit. The selection is a hint for the
 * auditor (the room area being photographed); the audit itself is single-photo
 * — the Arbiter audits one room per scan.
 */
export const UploadPanel: React.FC<UploadPanelProps> = ({
  selectedCategory,
  onCategoryChange,
  isAnalyzing,
}) => {
  return (
    <div>
      {/* Audit-area tiles: a hint for the auditor, not a hard filter */}
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
  );
};

export default UploadPanel;
