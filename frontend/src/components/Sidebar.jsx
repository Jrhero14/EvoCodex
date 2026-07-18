import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Activity, Database, Folder, LayoutTemplate, Users, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchRecentJobs } from '../services/api';

const Sidebar = () => {
  const { hasAccess } = useAuth();
  const navigate = useNavigate();
  const [recentJobs, setRecentJobs] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const loadRecentJobs = async () => {
    if (!hasAccess('projects')) return;
    try {
      const res = await fetchRecentJobs();
      setRecentJobs(res.data || []);
    } catch(_e) { /* ignore */ }
  };

  // Connect to WebSocket for real-time job updates
  useEffect(() => {
    if (!hasAccess('projects')) return;

    // Initial load via REST (one-time)
    loadRecentJobs();

    // Also listen for local browser events (same tab)
    const handleJobStarted = () => loadRecentJobs();
    window.addEventListener('job-started', handleJobStarted);

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/jobs`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = () => {
        // Whenever backend broadcasts a job event, just re-fetch the list
        loadRecentJobs();
      };

      ws.onclose = () => {
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      window.removeEventListener('job-started', handleJobStarted);
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent auto-reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <aside className="w-sidebar bg-bgPanel border-r border-borderColor flex flex-col">
      <div className="h-topbar flex items-center px-5 border-b border-borderColor gap-3">
        <img src="/logo.png" alt="Logo" className="h-6 w-auto" />
        <h1 className="text-lg font-bold text-primary m-0 tracking-tight">Evocodex</h1>
      </div>
      <nav className="flex-1 p-5 space-y-2 overflow-y-auto min-h-0">
        {hasAccess('query') && (
          <NavLink
            to="/query"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <Search size={18} />
            Query
          </NavLink>
        )}
        {hasAccess('monitoring') && (
          <NavLink
            to="/monitoring"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <Activity size={18} />
            Monitoring
          </NavLink>
        )}
        {hasAccess('database') && (
          <NavLink
            to="/database"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <Database size={18} />
            Database
          </NavLink>
        )}
        {hasAccess('projects') && (
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <Folder size={18} />
            Projects
          </NavLink>
        )}
        {hasAccess('templates') && (
          <NavLink
            to="/templates"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <LayoutTemplate size={18} />
            Templates
          </NavLink>
        )}

        {hasAccess('settings') && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[15px] transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-textMain hover:bg-bgHover'
              }`
            }
          >
            <SettingsIcon size={18} />
            Settings
          </NavLink>
        )}
      </nav>
      
      {/* Build Executor Status / Recent Jobs */}
      {hasAccess('projects') && (
        <div className="border-t border-borderColor p-3 bg-bgMain shrink-0 flex flex-col max-h-64 h-auto shadow-inner">
          <div className="text-[11px] font-bold text-textMuted uppercase tracking-wider mb-2 flex items-center justify-between px-1">
            Build Executor Status
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {recentJobs.length === 0 ? (
              <div className="text-xs text-textMuted text-center py-4 bg-bgPanel rounded border border-borderColor/50">No recent jobs</div>
            ) : (
              recentJobs.map(job => (
                <div 
                  key={job.id} 
                  className={`text-xs border rounded p-2 cursor-pointer transition-all flex items-start gap-2 ${
                    job.status === 'IN_PROGRESS'
                      ? 'border-blue-500 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.4)] ring-1 ring-blue-500'
                      : 'border-borderColor bg-bgPanel hover:border-primary shadow-sm'
                  }`}
                  onClick={() => navigate(`/projects/${encodeURIComponent(job.project_name)}/${encodeURIComponent(job.branch)}?tab=builds&jobId=${job.id}`)}
                  title="Click to view project details"
                >
                  <div className="mt-0.5 shrink-0">
                    {job.status === 'SUCCESS' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]"></div>}
                    {job.status === 'FAILED' && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_4px_#ef4444]"></div>}
                    {job.status === 'IN_PROGRESS' && <RefreshCw size={10} className="animate-spin text-blue-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-textMain truncate text-[11px] leading-tight mb-0.5 flex justify-between">
                      <span className="truncate">{job.project_name}</span>
                      <span className="text-textMuted ml-1">#{job.id}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-[10px] text-textMuted truncate leading-tight font-mono bg-bgMain px-1 rounded inline-block">{job.branch}</div>
                      <div className="text-[9px] text-textMuted">{new Date(job.indexed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
