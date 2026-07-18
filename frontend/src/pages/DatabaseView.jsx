import React, { useState, useEffect } from 'react';
import { fetchDatabaseTable, fetchRowDetails } from '../services/api';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

const DatabaseView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const limit = 50;

  const loadData = async (currentPage) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDatabaseTable(currentPage, limit);
      setData(res.data || []);
      setTotalCount(res.total || 0);
      setTotalPages(Math.max(1, Math.ceil((res.total || 0) / limit)));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page]);

  const handleRowDoubleClick = async (id) => {
    setSelectedRow({ id }); // Open modal immediately with loading state
    setModalLoading(true);
    setModalError('');
    
    try {
      const res = await fetchRowDetails(id);
      setSelectedRow(res.data);
    } catch (err) {
      setModalError(err.message || 'Failed to load row details');
    } finally {
      setModalLoading(false);
    }
  };

  const handleGoToPage = (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      let val = parseInt(pageInput);
      if (isNaN(val) || val < 1) val = 1;
      if (val > totalPages) val = totalPages;
      setPageInput(val.toString());
      if (val !== page) {
        setPage(val);
      }
    }
  };

  const renderCode = (code) => {
    try {
      const highlighted = hljs.highlightAuto(code).value;
      return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
    } catch {
      return <code>{code}</code>;
    }
  };

  return (
    <div className="flex flex-col h-full m-0 p-0">
      <div className="flex justify-between items-center px-4 py-3 bg-bgMain border-b border-borderColor shrink-0">
        <h2 className="text-lg text-textMain font-bold m-0 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          code_embeddings
        </h2>
        <div className="flex items-center gap-2">
          <div className="text-xs text-textMuted mr-2 hidden sm:block">
            Total: <span className="font-semibold text-textMain">{totalCount}</span> rows
          </div>
          <button 
            className="btn-secondary py-1 px-3 text-xs" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Prev
          </button>
          
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs text-textMuted">Page</span>
            <input 
              type="text"
              className="w-12 px-1.5 py-0.5 text-center text-xs border border-borderColor rounded bg-bgMain focus:outline-none focus:border-primary"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={handleGoToPage}
              onBlur={handleGoToPage}
              disabled={loading}
            />
            <span className="text-xs text-textMuted">of {totalPages}</span>
          </div>

          <button 
            className="btn-secondary py-1 px-3 text-xs" 
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
          <button onClick={() => loadData(page)} className="btn-secondary py-1 px-3 text-xs ml-2" disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-bgPanel">
        {error && (
          <div className="p-4 m-4 bg-red-100 text-red-800 rounded border border-red-200">
            {error}
          </div>
        )}
        <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
          <thead className="bg-bgPanel sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-16">id</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-[150px]">project_name</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-[100px]">branch</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[200px]">filename</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[300px]">code</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[200px]">embedding</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-20">start_line</th>
              <th className="p-2 border-b border-borderColor font-semibold text-textMuted w-20">end_line</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="p-10 text-center text-textMuted font-sans">Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="8" className="p-10 text-center text-textMuted font-sans">No records found.</td></tr>
            ) : (
              data.map(row => (
                <tr 
                  key={row.id} 
                  className="border-b border-borderColor hover:bg-bgHover cursor-pointer"
                  onDoubleClick={() => handleRowDoubleClick(row.id)}
                >
                  <td className="p-2 border-r border-borderColor">{row.id}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[150px]" title={row.project_name}>{row.project_name}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[100px]" title={row.branch}>{row.branch}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[200px]" title={row.filename}>{row.filename}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[300px]" title={row.code}>{row.code}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[200px] text-green-700" title={row.embedding}>{row.embedding}</td>
                  <td className="p-2 border-r border-borderColor">{row.start_line}</td>
                  <td className="p-2">{row.end_line}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="panel w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-borderColor p-4">
              <h3 className="m-0 text-base font-bold text-textMain">Row Details</h3>
              <button onClick={() => setSelectedRow(null)} className="icon-btn p-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {modalLoading ? (
                <div className="text-center p-10">
                  <div className="loader border-t-primary mb-2"></div>
                  <p className="text-textMuted text-sm">Fetching full code...</p>
                </div>
              ) : modalError ? (
                <div className="text-center p-5 text-danger">{modalError}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">ID</strong><div className="font-mono text-sm break-all">{selectedRow.id}</div></div>
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">Project</strong><div className="font-mono text-sm break-all">{selectedRow.project_name}</div></div>
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">Branch</strong><div className="font-mono text-sm break-all">{selectedRow.branch}</div></div>
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">Filename</strong><div className="font-mono text-sm break-all">{selectedRow.filename}</div></div>
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">Lines</strong><div className="font-mono text-sm">{selectedRow.start_line} - {selectedRow.end_line}</div></div>
                    <div className="min-w-0"><strong className="text-xs text-textMuted uppercase block mb-1">Embedding (truncated)</strong><div className="font-mono text-sm text-green-700 break-all">{selectedRow.embedding}</div></div>
                  </div>
                  <div className="mt-4">
                    <strong className="text-xs text-textMuted uppercase block mb-2">Code</strong>
                    <pre className="m-0 p-4 bg-[#282c34] text-[#abb2bf] rounded-md overflow-x-auto text-[13px] font-mono leading-relaxed border border-borderColor">
                      {renderCode(selectedRow.code)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseView;
