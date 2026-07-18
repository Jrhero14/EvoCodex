import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { queryDatabase, fetchProjects } from '../services/api';
import SearchableDropdown from '../components/SearchableDropdown';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

const QueryView = () => {
  const [queryText, setQueryText] = useState('');
  const [searchMode, setSearchMode] = useState('hybrid');
  const [limit, setLimit] = useState(5);
  const [projectName, setProjectName] = useState('');
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [availableProjects, setAvailableProjects] = useState([]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetchProjects();
        setAvailableProjects(res.data || []);
      } catch (err) {
        console.error("Failed to load projects", err);
      }
    };
    loadProjects();
  }, []);

  const uniqueProjectNames = [...new Set(availableProjects.map(p => p.project_name))];
  const availableBranches = projectName 
    ? [...new Set(availableProjects.filter(p => p.project_name === projectName).map(p => p.current_branch))]
    : [];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);
    setExpandedRows({});

    try {
      const res = await queryDatabase(queryText, limit, projectName, branch, searchMode);
      setResults(res.results || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (idx) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderCode = (code) => {
    // Quick and dirty syntax highlighting using hljs
    try {
      const highlighted = hljs.highlightAuto(code).value;
      return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
    } catch {
      return <code>{code}</code>;
    }
  };

  return (
    <div className="p-10 max-w-[1000px] mx-auto">
      <div className="flex flex-col items-center justify-center mb-10 mt-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo_300.png" alt="Evocodex Logo" className="h-[90px] object-contain mr-5" />
          <h1 className="text-[48px] sm:text-[56px] font-bold tracking-widest text-textMain m-0" style={{ letterSpacing: '0.1em' }}>
            EVOCODEX
          </h1>
        </div>
        <p className="text-[18px] sm:text-[20px] text-textMuted tracking-wide">
          The Revolutionary Code Indexing System.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-textMuted" size={20} />
            <textarea 
              className="w-full min-h-[100px] py-3 pl-11 pr-4 rounded-none border-2 border-borderColor bg-bgPanel text-[15px] text-textMain focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm resize-y"
              style={{boxShadow: '4px 4px 0px var(--color-border, #1A1A1A)'}}
              placeholder="Evocodex input"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <SearchableDropdown 
                options={uniqueProjectNames} 
                value={projectName} 
                onChange={(val) => { 
                  setProjectName(val); 
                  if (!val) setBranch(''); 
                }}
                placeholder="Select Project" 
              />
            </div>
            <div className="flex-1">
              <SearchableDropdown 
                options={availableBranches} 
                value={branch} 
                onChange={setBranch}
                placeholder="Select Branch" 
                disabled={!projectName}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-2">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[13px] font-bold text-textMuted uppercase tracking-wider">Search Mode</label>
              <div className="flex flex-wrap gap-4 sm:gap-6 bg-bgPanel p-3 rounded-lg border border-borderColor h-full items-center">
                <label className="flex items-center gap-2 text-[14px] text-textMain cursor-pointer">
                  <input type="radio" value="hybrid" checked={searchMode === 'hybrid'} onChange={() => setSearchMode('hybrid')} className="accent-primary" />
                  Hybrid <span className="text-textMuted text-xs hidden sm:inline">(Semantic + Keyword)</span>
                </label>
                <label className="flex items-center gap-2 text-[14px] text-textMain cursor-pointer">
                  <input type="radio" value="vector" checked={searchMode === 'vector'} onChange={() => setSearchMode('vector')} className="accent-primary" />
                  Semantic Only <span className="text-textMuted text-xs hidden sm:inline">(Context)</span>
                </label>
                <label className="flex items-center gap-2 text-[14px] text-textMain cursor-pointer">
                  <input type="radio" value="fts" checked={searchMode === 'fts'} onChange={() => setSearchMode('fts')} className="accent-primary" />
                  Keyword Only <span className="text-textMuted text-xs hidden sm:inline">(Exact Match)</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-[150px]">
              <label className="text-[13px] font-bold text-textMuted uppercase tracking-wider">Top K</label>
              <select 
                className="input-field h-full py-3"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={3}>3 Results</option>
                <option value={5}>5 Results</option>
                <option value={10}>10 Results</option>
                <option value={20}>20 Results</option>
                <option value={50}>50 Results</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end mt-2">
            <button 
              type="submit" 
              className="btn-primary h-[50px] w-full sm:w-[200px] flex items-center justify-center m-0"
              disabled={loading || !queryText.trim() || !projectName || !branch}
            >
              {loading ? <div className="loader border-t-textMain"></div> : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 border border-red-200">
          {error}
        </div>
      )}



      {results !== null && (
        <div>
          <h3 className="text-lg font-bold text-textMain mb-4 border-b border-borderColor pb-2">
            Results ({results.length})
          </h3>
          {results.length === 0 ? (
            <div className="text-center py-10 text-textMuted bg-bgPanel rounded-lg border border-borderColor">
              No relevant code found. Try adjusting your query or filters.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {results.map((res, idx) => (
                <div key={idx} className="panel bg-bgPanel rounded-lg overflow-hidden border border-borderColor">
                  <div 
                    className="p-4 cursor-pointer hover:bg-bgHover transition-colors flex justify-between items-center"
                    onClick={() => toggleRow(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="badge badge-success">{res.score.toFixed(3)}</span>
                      <strong className="text-[15px]">{res.filename}</strong>
                      <span className="text-sm text-textMuted">Lines {res.start_line}-{res.end_line}</span>
                    </div>
                    <div className="text-textMuted">
                      <svg 
                        className={`w-5 h-5 transition-transform ${expandedRows[idx] ? 'rotate-180' : ''}`} 
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>
                  {expandedRows[idx] && (
                    <div className="p-4 border-t border-borderColor bg-bgMain">
                      <div className="flex gap-4 mb-3 text-xs text-textMuted">
                        <div><strong>Project:</strong> {res.project_name}</div>
                        <div><strong>Branch:</strong> {res.branch}</div>
                      </div>
                      <pre className="m-0 p-4 bg-[#282c34] text-[#abb2bf] rounded-md overflow-x-auto text-[13px] font-mono leading-relaxed">
                        {renderCode(res.code)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QueryView;
