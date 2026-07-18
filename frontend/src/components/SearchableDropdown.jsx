import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const SearchableDropdown = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={wrapperRef}>
      <div 
        className={`w-full px-3 py-2 rounded-lg border border-borderColor bg-bgPanel text-[15px] flex justify-between items-center shadow-sm h-[42px] transition-colors ${disabled ? 'text-textMuted cursor-not-allowed' : 'text-textMain cursor-pointer hover:border-primary'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`truncate pr-2 ${value && !disabled ? "text-textMain" : "text-textMuted"}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`text-textMuted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-bgPanel border border-borderColor rounded-lg shadow-lg max-h-[300px] flex flex-col">
          <div className="p-2 shrink-0 border-b border-borderColor bg-bgPanel rounded-t-lg">
            <input
              type="text"
              className="w-full px-2 py-1.5 rounded bg-bgMain border border-borderColor text-sm focus:outline-none focus:border-primary text-textMain"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="p-1 overflow-y-auto min-h-[50px] flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-textMuted text-center">No results found</div>
            ) : (
              filteredOptions.map((opt, i) => (
                <div 
                  key={i}
                  className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-bgHover flex justify-between items-center text-textMain"
                  onClick={() => handleSelect(opt)}
                >
                  <span className="truncate pr-2">{opt}</span>
                  {value === opt && <Check size={14} className="text-primary shrink-0" />}
                </div>
              ))
            )}
          </div>
          {value && (
            <div className="p-1 border-t border-borderColor shrink-0 bg-bgPanel rounded-b-lg">
              <div 
                className="px-3 py-1.5 text-sm rounded cursor-pointer hover:bg-red-50 text-danger flex justify-center items-center transition-colors font-medium"
                onClick={() => handleSelect('')}
              >
                Clear selection
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
