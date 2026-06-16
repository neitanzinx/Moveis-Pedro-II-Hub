import React from "react";
import { Check, X } from "lucide-react";

export function RestricaoCheckbox({ checked, onCheckedChange, label, isBlockedMode = false, disabled = false }) {
  // If isBlockedMode is true, then checking it means "blocking" (prohibited), so active state = red.
  // If isBlockedMode is false, then checking it means "allowing" (permitted), so active state = green.
  const activeColor = isBlockedMode
    ? 'bg-red-600 border-red-600 text-white'
    : 'bg-green-600 border-green-600 text-white';

  const inactiveColor = isBlockedMode
    ? 'bg-white border-gray-300 text-gray-400 group-hover:border-green-500 group-hover:text-green-500'
    : 'bg-white border-gray-300 text-gray-400 group-hover:border-red-500 group-hover:text-red-500';

  const activeIcon = isBlockedMode ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />;
  const inactiveIcon = isBlockedMode ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />;

  return (
    <div
      className={`flex items-center space-x-2 select-none group ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
      onClick={() => !disabled && onCheckedChange(!checked)}
    >
      <div className={`
        w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0
        ${checked ? activeColor : inactiveColor}
      `}>
        {checked ? activeIcon : inactiveIcon}
      </div>
      {label && (
        <span className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
    </div>
  );
}
