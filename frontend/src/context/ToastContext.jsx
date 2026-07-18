import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((severity, summary, detail, life = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, severity, summary, detail }]);
    if (life) {
      setTimeout(() => {
        removeToast(id);
      }, life);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showSuccess = (summary, detail, life) => addToast('success', summary, detail, life);
  const showError = (summary, detail, life) => addToast('error', summary, detail, life);
  const showInfo = (summary, detail, life) => addToast('info', summary, detail, life);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-start gap-3 p-4 rounded-md shadow-lg border w-80 bg-bgPanel animate-in slide-in-from-top-2 fade-in duration-300 ${
            toast.severity === 'success' ? 'border-green-500/50' : 
            toast.severity === 'error' ? 'border-red-500/50' : 'border-blue-500/50'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toast.severity === 'success' && <CheckCircle size={18} className="text-green-500" />}
              {toast.severity === 'error' && <AlertCircle size={18} className="text-red-500" />}
              {toast.severity === 'info' && <Info size={18} className="text-blue-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-textMain m-0">{toast.summary}</h4>
              <p className="text-xs text-textMuted mt-1 mb-0 break-words">{toast.detail}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-textMuted hover:text-textMain shrink-0">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
