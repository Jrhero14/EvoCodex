import React, { useState, useEffect } from 'react';
import { fetchMonitoringHistory, fetchWebhookLogs } from '../services/api';
import { Eye, X, Webhook, Activity } from 'lucide-react';

const MonitoringView = () => {
  const [activeTab, setActiveTab] = useState('indexing'); // 'indexing' | 'webhooks'
  
  // Indexing History State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // Webhook State
  const [webhookData, setWebhookData] = useState([]);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [webhookError, setWebhookError] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState(null);

  const loadData = async () => {
    if (activeTab === 'indexing') {
      setLoading(true);
      setError('');
      try {
        const res = await fetchMonitoringHistory();
        setData(res.data || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load monitoring data');
      } finally {
        setLoading(false);
      }
    } else {
      setWebhookLoading(true);
      setWebhookError('');
      try {
        const res = await fetchWebhookLogs();
        setWebhookData(res.data?.logs || []);
      } catch (err) {
        console.error(err);
        setWebhookError(err.message || 'Failed to load webhook logs');
      } finally {
        setWebhookLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[28px] text-textMain font-bold m-0 tracking-tight">System Monitoring</h2>
          <p className="text-[15px] text-textMuted mt-1">Real-time status of codebase indexing and external webhooks</p>
        </div>
        <button onClick={loadData} className="btn-secondary" disabled={activeTab === 'indexing' ? loading : webhookLoading}>
          {(activeTab === 'indexing' ? loading : webhookLoading) ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex border-b border-borderColor mb-6">
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'indexing' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'
          }`}
          onClick={() => setActiveTab('indexing')}
        >
          <Activity size={18} />
          Indexing Jobs
        </button>
        <button
          className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'webhooks' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'
          }`}
          onClick={() => setActiveTab('webhooks')}
        >
          <Webhook size={18} />
          Webhook Logs
        </button>
      </div>

      {activeTab === 'indexing' && error && (
        <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 border border-red-200">
          {error}
        </div>
      )}
      {activeTab === 'webhooks' && webhookError && (
        <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 border border-red-200">
          {webhookError}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left Panel: Table */}
        <div className="w-full lg:w-1/2 bg-bgPanel rounded-xl shadow border border-borderColor flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            {activeTab === 'indexing' ? (
              <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-bgMain border-b border-borderColor text-textMain text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold text-textMuted">ID</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Project</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Branch</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Commit Hash</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Status</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Indexed At</th>
                  <th className="px-6 py-4 font-semibold text-textMuted text-center">Details</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-10 text-textMuted">Loading...</td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-10 text-textMuted">No indexing history found.</td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedLog(row)}
                      className={`border-b border-borderColor last:border-b-0 transition-colors cursor-pointer ${selectedLog?.id === row.id ? 'bg-bgHover' : 'hover:bg-bgHover'}`}
                    >
                      <td className="px-6 py-4">{row.id}</td>
                      <td className="px-6 py-4 font-medium text-textMain">{row.project_name}</td>
                      <td className="px-6 py-4">{row.branch}</td>
                      <td className="px-6 py-4 font-mono text-xs text-textMuted">{row.commit_hash?.slice(0, 7) || '-'}</td>
                      <td className="px-6 py-4">
                        {row.status === 'SUCCESS' && <span className="badge badge-success">SUCCESS</span>}
                        {row.status === 'FAILED' && <span className="badge badge-error">FAILED</span>}
                        {row.status !== 'SUCCESS' && row.status !== 'FAILED' && <span className="badge bg-bgHover text-textMain border-borderColor">{row.status}</span>}
                      </td>
                      <td className="px-6 py-4 text-textMuted">
                        {new Date(row.indexed_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          className={`inline-flex items-center gap-1 transition-colors ${selectedLog?.id === row.id ? 'text-primary' : 'text-textMuted hover:text-primary'}`}
                          title="View Logs"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-bgMain border-b border-borderColor text-textMain text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-semibold text-textMuted">Time</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Request IP</th>
                  <th className="px-6 py-4 font-semibold text-textMuted">Status Code</th>
                  <th className="px-6 py-4 font-semibold text-textMuted text-center">Details</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {webhookLoading && webhookData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center p-10 text-textMuted">Loading...</td>
                  </tr>
                ) : webhookData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center p-10 text-textMuted">No webhook logs found.</td>
                  </tr>
                ) : (
                  webhookData.map((row) => (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedWebhook(row)}
                      className={`border-b border-borderColor last:border-b-0 transition-colors cursor-pointer ${selectedWebhook?.id === row.id ? 'bg-bgHover' : 'hover:bg-bgHover'}`}
                    >
                      <td className="px-6 py-4 text-textMuted">
                        {new Date(row.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </td>
                      <td className="px-6 py-4 font-medium text-textMain">{row.request_ip}</td>
                      <td className="px-6 py-4">
                        {row.status_code >= 200 && row.status_code < 300 ? (
                           <span className="badge badge-success">{row.status_code}</span>
                        ) : (
                           <span className="badge badge-error">{row.status_code}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          className={`inline-flex items-center gap-1 transition-colors ${selectedWebhook?.id === row.id ? 'text-primary' : 'text-textMuted hover:text-primary'}`}
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
            
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="w-full lg:w-1/2 bg-bgPanel rounded-xl shadow border border-borderColor flex flex-col overflow-hidden">
          {activeTab === 'indexing' ? (
            selectedLog ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 border-b border-borderColor bg-bgMain shrink-0">
                <h2 className="text-lg font-bold text-textMain tracking-tight">Indexing Details</h2>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="text-textMuted hover:text-textMain transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 flex flex-col flex-1 bg-bgPanel overflow-hidden min-h-0">
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-bgPanel p-4 rounded-lg border border-borderColor shrink-0">
                  <div><span className="font-semibold text-textMuted text-[11px] uppercase tracking-wider block mb-1">Project</span> <span className="font-medium text-textMain">{selectedLog.project_name}</span></div>
                  <div><span className="font-semibold text-textMuted text-[11px] uppercase tracking-wider block mb-1">Branch</span> <span className="badge badge-success text-[10px] px-1.5 py-0.5">{selectedLog.branch}</span></div>
                  <div><span className="font-semibold text-textMuted text-[11px] uppercase tracking-wider block mb-1">Commit Hash</span> <span className="font-mono text-[11px] bg-bgHover px-1.5 py-0.5 rounded">{selectedLog.commit_hash || 'N/A'}</span></div>
                  <div><span className="font-semibold text-textMuted text-[11px] uppercase tracking-wider block mb-1">Status</span> 
                    {selectedLog.status === 'SUCCESS' && <span className="badge badge-success text-[10px]">SUCCESS</span>}
                    {selectedLog.status === 'FAILED' && <span className="badge badge-error text-[10px]">FAILED</span>}
                    {selectedLog.status !== 'SUCCESS' && selectedLog.status !== 'FAILED' && <span className="badge bg-bgHover text-textMain border-borderColor text-[10px]">{selectedLog.status}</span>}
                  </div>
                </div>
                
                {selectedLog.error_message && (
                  <div className="mb-4 shrink-0">
                    <h3 className="text-sm font-semibold text-textMain mb-2">Error Message</h3>
                    <div className="bg-red-50 text-red-700 p-3 rounded border border-red-100 text-sm font-mono text-xs whitespace-pre-wrap">
                      {selectedLog.error_message}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col flex-1 min-h-0">
                  <h3 className="text-sm font-semibold text-textMain mb-2 shrink-0">Console Output</h3>
                  <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg overflow-auto text-[11px] font-mono whitespace-pre-wrap flex-1 min-h-0 border border-gray-800 shadow-inner">
                    {selectedLog.log_output || "No output logs captured."}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-textMuted bg-bgMain">
              <Eye size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a log entry to view details</p>
            </div>
          )
          ) : (
            selectedWebhook ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center p-4 border-b border-borderColor bg-bgMain shrink-0">
                  <h2 className="text-lg font-bold text-textMain tracking-tight">Webhook Details</h2>
                  <button 
                    onClick={() => setSelectedWebhook(null)}
                    className="text-textMuted hover:text-textMain transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-4 flex flex-col flex-1 bg-bgPanel overflow-hidden min-h-0 gap-4">
                  
                  <div className="flex flex-col shrink-0 min-h-0 max-h-[25%]">
                    <h3 className="text-sm font-semibold text-textMain mb-2 shrink-0">Headers</h3>
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg overflow-auto text-[11px] font-mono whitespace-pre-wrap flex-1 min-h-0 border border-gray-800 shadow-inner">
                      {JSON.stringify(selectedWebhook.headers, null, 2)}
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 min-h-0">
                    <h3 className="text-sm font-semibold text-textMain mb-2 shrink-0">Payload</h3>
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg overflow-auto text-[11px] font-mono whitespace-pre-wrap flex-1 min-h-0 border border-gray-800 shadow-inner">
                      {selectedWebhook.payload ? JSON.stringify(selectedWebhook.payload, null, 2) : 'No payload'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col shrink-0 min-h-0 max-h-[25%]">
                    <h3 className="text-sm font-semibold text-textMain mb-2 shrink-0">Response ({selectedWebhook.status_code})</h3>
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg overflow-auto text-[11px] font-mono whitespace-pre-wrap flex-1 min-h-0 border border-gray-800 shadow-inner">
                      {JSON.stringify(selectedWebhook.response, null, 2)}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-textMuted bg-bgMain">
                <Webhook size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">Select a webhook log to view details</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringView;
