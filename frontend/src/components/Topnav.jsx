import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../services/api';

const Topnav = () => {
  const navigate = useNavigate();
  const { username, role } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem('cocoindex_token');
    localStorage.removeItem('cocoindex_refresh_token');
    localStorage.removeItem('cocoindex_app_id');
    const apiBase = getApiBaseUrl();
    const currentOrigin = window.location.origin;
    window.location.href = `${apiBase}/oauth/logout?origin=${encodeURIComponent(currentOrigin)}`;
  };

  return (
    <header className="h-topbar bg-bgPanel border-b border-borderColor flex justify-between items-center px-6">
      <div className="text-sm font-medium text-textMain">Dashboard</div>
      <div className="flex items-center gap-4">
        {username && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-textMain">{username}</span>
            {role && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
                role === 'admin' ? 'bg-red-100 text-red-700 border-red-200' :
                role === 'maintener' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {role}
              </span>
            )}
          </div>
        )}
        <a 
          href="/api/docs" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-textMuted hover:text-primary transition-colors cursor-pointer bg-transparent border-none mr-2"
        >
          <BookOpen size={16} />
          Swagger
        </a>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-textMuted hover:text-danger transition-colors cursor-pointer bg-transparent border-none"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topnav;
