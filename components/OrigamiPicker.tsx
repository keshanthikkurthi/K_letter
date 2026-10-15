'use client';

import React from 'react';
import { OrigamiManifestItem, OrigamiObjectPlacement } from '@/lib/types';

interface OrigamiPickerProps {
  manifest: OrigamiManifestItem[];
  currentObjects: OrigamiObjectPlacement[];
  onAddObject: (objectId: string) => void;
  onRemoveObject: (index: number) => void;
  maxObjects?: number;
}

export const OrigamiPicker: React.FC<OrigamiPickerProps> = ({
  manifest,
  currentObjects,
  onAddObject,
  onRemoveObject,
  maxObjects = 3,
}) => {
  const isFull = currentObjects.length >= maxObjects;

  return (
    <div className="bg-[#FAF8F3] border border-stone-200/80 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider font-sans font-semibold text-stone-700">
            Paperweights ({currentObjects.length}/{maxObjects})
          </span>
          <p className="text-[11px] text-stone-500 font-sans">
            Add up to 3 origami pieces to weigh down paper corners in the breeze.
          </p>
        </div>
      </div>

      {/* Selected Items Tray */}
      {currentObjects.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-stone-200/60">
          {currentObjects.map((item, index) => {
            const def = manifest.find((m) => m.id === item.object_id);
            return (
              <div
                key={`selected-${index}`}
                className="inline-flex items-center gap-2 bg-white border border-stone-200 rounded px-2.5 py-1 text-xs text-stone-700 shadow-2xs"
              >
                <img
                  src={def?.file || `/origami/${item.object_id}.svg`}
                  alt={item.object_id}
                  className="w-5 h-5 object-contain"
                />
                <span className="font-sans capitalize">{def?.name || item.object_id}</span>
                <button
                  type="button"
                  onClick={() => onRemoveObject(index)}
                  className="text-stone-400 hover:text-red-600 transition-colors ml-1 font-bold"
                  aria-label="Remove origami"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Gallery */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
        {manifest.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={isFull}
            onClick={() => onAddObject(item.id)}
            className={`flex flex-col items-center p-2 rounded-md border text-center transition-all ${
              isFull
                ? 'opacity-40 cursor-not-allowed border-stone-200 bg-stone-100/50'
                : 'border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs active:scale-95 cursor-pointer'
            }`}
          >
            <img src={item.file} alt={item.name} className="w-10 h-10 object-contain mb-1" />
            <span className="text-[11px] text-stone-600 font-sans truncate w-full">
              {item.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
