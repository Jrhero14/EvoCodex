import React, { useState } from 'react';
import { X } from 'lucide-react';

const ChipsInput = ({ value, onChange, placeholder, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip();
    } else if (e.key === 'Backspace' && inputValue === '') {
      e.preventDefault();
      removeChip(value.length - 1);
    }
  };

  const addChip = () => {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, '');
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const handleBlur = () => {
    addChip();
  };

  const removeChip = (index) => {
    if (index < 0 || index >= value.length) return;
    const newChips = [...value];
    newChips.splice(index, 1);
    onChange(newChips);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 p-2 border-2 border-borderSubtle rounded-md min-h-[42px] transition-all ${disabled ? 'bg-bgHover opacity-70 cursor-not-allowed' : 'bg-bgMain focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'}`}>
      {value.map((chip, index) => (
        <div key={index} className="flex items-center gap-1 bg-textMain text-bgMain px-2 py-1 rounded-md text-xs font-mono font-medium shadow-sm">
          {chip}
          {!disabled && (
            <button 
              type="button" 
              onClick={() => removeChip(index)}
              className="hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <input
          type="text"
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm font-mono placeholder:font-sans placeholder:text-textMuted"
          placeholder={value.length === 0 ? placeholder : ''}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      )}
    </div>
  );
};

export default ChipsInput;
