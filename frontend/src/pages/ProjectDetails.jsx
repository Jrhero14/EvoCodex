import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDatabaseTable, fetchRowDetails, fetchProjects, triggerForceReindex, deleteProject, fetchProjectJobs, fetchJobLogs, fetchProjectTree } from '../services/api';
import FileTree from '../components/FileTree';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { ArrowLeft, Copy, FolderGit2, Hash, MapPin, Link as LinkIcon, GitBranch, GitCommit, Calendar, Clock, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import BuildPipelineFlow from '../components/BuildPipelineFlow';

const ProjectDetails = () => {
  const { projectName, branchName } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const jobIdParam = searchParams.get('jobId');
  const { showSuccess, showError } = useToast();
  const { role } = useAuth();
  const canWrite = role !== 'guest';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInput, setPageInput] = useState('1');

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const [selectedRow, setSelectedRow] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [projectMetadata, setProjectMetadata] = useState(null);

  const limit = 50;
  
  // Decoding URL params
  const project = decodeURIComponent(projectName);
  const branch = decodeURIComponent(branchName);


  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobLogs, setJobLogs] = useState('');
  const [activeTab, setActiveTab] = useState(tabParam === 'builds' ? 'builds' : tabParam === 'settings' ? 'settings' : 'database');

  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

  useEffect(() => {
    if (tabParam === 'builds') setActiveTab('builds');
    else if (tabParam === 'settings') setActiveTab('settings');
    else if (tabParam === 'database') setActiveTab('database');
  }, [tabParam]);

  useEffect(() => {
    if (jobIdParam && jobs.length > 0) {
      const jobToSelect = jobs.find(j => j.id === parseInt(jobIdParam, 10));
      if (jobToSelect && (!selectedJob || selectedJob.id !== jobToSelect.id)) {
        setSelectedJob(jobToSelect);
        setJobLogs('Loading logs...');
        fetchJobLogs(jobToSelect.id).then(setJobLogs).catch(() => setJobLogs('Failed to load logs.'));
      }
    }
  }, [jobIdParam, jobs]);

  useEffect(() => {
    if (activeTab === 'settings' && projectMetadata && treeData.length === 0 && !treeLoading) {
      setTreeLoading(true);
      fetchProjectTree(projectMetadata.repository_url, projectMetadata.current_branch)
        .then(res => setTreeData(res.data || []))
        .catch(err => console.error("Failed to load tree", err))
        .finally(() => setTreeLoading(false));
    }
  }, [activeTab, projectMetadata]);

  const loadJobs = async () => {
    try {
      const res = await fetchProjectJobs(project, branch);
      const fetchedJobs = res.data || [];
      setJobs(fetchedJobs);
      setSelectedJob(prev => {
        if (!prev) return null;
        const updated = fetchedJobs.find(j => j.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [project, branch]);

  const hasActiveJob = jobs.some(j => j.status === 'IN_PROGRESS');

  useEffect(() => {
    let interval;
    if (hasActiveJob) {
      interval = setInterval(() => {
        loadJobs();
      }, 3000);
    } else {
      // If a job just finished, reload table data
      if (jobs.length > 0) {
        loadData(page);
      }
    }
    return () => clearInterval(interval);
  }, [hasActiveJob, project, branch]);
  
  useEffect(() => {
    let interval;
    if (selectedJob && selectedJob.status === 'IN_PROGRESS') {
      interval = setInterval(async () => {
        try {
          const logs = await fetchJobLogs(selectedJob.id);
          setJobLogs(logs);
        } catch(e) {}
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [selectedJob]);
  
  const handleSelectJob = async (job) => {
    setSearchParams(prev => {
      prev.set('tab', 'builds');
      prev.set('jobId', job.id.toString());
      return prev;
    });
  };

  const loadData = async (currentPage) => {
    setLoading(true);
    setError('');
    try {
      const [dbRes, projectsRes] = await Promise.all([
        fetchDatabaseTable(currentPage, limit, project, branch),
        fetchProjects()
      ]);
      setData(dbRes.data || []);
      setTotalCount(dbRes.total || 0);
      setTotalPages(Math.max(1, Math.ceil((dbRes.total || 0) / limit)));
      
      const p = projectsRes.data?.find(p => p.project_name === project && p.current_branch === branch);
      setProjectMetadata(p || null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load project indexed data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page, project, branch]);

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

  const renderCode = (code) => {
    try {
      const highlighted = hljs.highlightAuto(code).value;
      return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
    } catch {
      return <code>{code}</code>;
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

  const handleForceIndex = async () => {
    if (!projectMetadata) return;
    setIsIndexing(true);
    try {
      await triggerForceReindex(projectMetadata.repository_url, projectMetadata.current_branch);
      showSuccess('Job Started', 'Indexing is running in the background.', 3000);
      loadJobs(); // Refresh jobs to show IN_PROGRESS
      window.dispatchEvent(new Event('job-started')); // Notify Sidebar to refresh immediately
      setActiveTab('builds'); // Auto-switch to builds view
    } catch (err) {
      showError('Error', err.response?.data?.detail || err.message || 'Failed to start indexing', 5000);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectMetadata) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectMetadata.id);
      showSuccess('Project Deleted', 'The project and all its data have been removed.', 5000);
      setShowDeleteModal(false);
      navigate('/projects');
    } catch (err) {
      showError('Error', err.response?.data?.detail || err.message || 'Failed to delete project', 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  const expectedConfirmText = `${project}/${branch}`;

  return (
    <>
    <div className="flex flex-col h-full m-0 p-0">
      <div className="flex justify-between items-center px-4 py-3 bg-bgMain border-b border-borderColor shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/projects')}
            className="text-textMuted hover:text-textMain transition-colors p-1"
            disabled={isIndexing || hasActiveJob}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg text-textMain font-bold m-0 flex items-center gap-2">
            Project Index: {project} <span className="text-sm font-normal text-textMuted bg-bgHover px-2 py-0.5 rounded ml-2">{branch}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'database' && (
            <>
              <div className="text-xs text-textMuted mr-2 hidden sm:block">
                Total: <span className="font-semibold text-textMain">{totalCount}</span> rows
              </div>
              <button 
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-50" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading || isIndexing}
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
                  disabled={loading || isIndexing}
                />
                <span className="text-xs text-textMuted">of {totalPages}</span>
              </div>

              <button 
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-50" 
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages || loading || isIndexing}
              >
                Next
              </button>
              <button onClick={() => loadData(page)} className="btn-secondary py-1 px-3 text-xs ml-2 disabled:opacity-50" disabled={loading || isIndexing}>
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-bgMain border-b border-borderColor px-4 shrink-0">
        <button 
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'database' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          onClick={() => {
            setSearchParams(prev => {
              prev.set('tab', 'database');
              prev.delete('jobId'); // clear job selection if moving away
              return prev;
            });
          }}
        >
          Database View
        </button>
        <button 
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'builds' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
          onClick={() => {
            setSearchParams(prev => {
              prev.set('tab', 'builds');
              prev.delete('jobId'); // Ensure jobId doesn't stick around if we just want builds list
              return prev;
            });
          }}
        >
          Build History
          {hasActiveJob && <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>}
        </button>
        {canWrite && (
          <button 
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textMain'}`}
            onClick={() => {
              setSearchParams(prev => {
                prev.set('tab', 'settings');
                prev.delete('jobId');
                return prev;
              });
            }}
          >
            Settings
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'database' ? (
          <div className="flex-1 overflow-auto bg-bgPanel flex flex-col">
            {projectMetadata && (
          <div className="p-4 bg-bgMain border-b border-borderColor shrink-0 shadow-sm z-10">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-textMain uppercase tracking-wider text-textMuted flex items-center gap-2">
                  Project Metadata
                </h3>
                <div className="flex gap-2">
                  {canWrite && (
                    <button 
                      onClick={handleForceIndex}
                      disabled={isIndexing || hasActiveJob}
                      className="btn-primary w-auto py-1 px-3 text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={13} className={(isIndexing || hasActiveJob) ? "animate-spin" : ""} />
                      {(isIndexing || hasActiveJob) ? 'Running...' : 'Indexing Now'}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                
                {/* Project Name */}
                <div className="bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <FolderGit2 size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Project Name</span>
                  </div>
                  <div className="text-textMain font-semibold text-[12px] truncate" title={projectMetadata.project_name}>{projectMetadata.project_name}</div>
                </div>

                {/* Project ID */}
                <div className="bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <Hash size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Project ID</span>
                  </div>
                  <div className="text-textMain font-semibold text-[12px]">{projectMetadata.project_id}</div>
                </div>

                {/* Path with Namespace */}
                <div className="lg:col-span-2 bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <MapPin size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Path</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 bg-bgPanel px-2 py-1 rounded border border-borderColor">
                    <div className="text-textMain font-mono text-[11px] truncate" title={projectMetadata.path_with_namespace}>{projectMetadata.path_with_namespace}</div>
                    <button onClick={() => navigator.clipboard.writeText(projectMetadata.path_with_namespace)} className="icon-btn shrink-0" title="Copy">
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                
                {/* Repository URL */}
                <div className="lg:col-span-2 bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <LinkIcon size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Repository</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 bg-bgPanel px-2 py-1 rounded border border-borderColor">
                    <div className="text-textMain font-mono text-[11px] truncate" title={projectMetadata.repository_url}>{projectMetadata.repository_url}</div>
                    <button onClick={() => navigator.clipboard.writeText(projectMetadata.repository_url)} className="icon-btn shrink-0" title="Copy">
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                {/* Target Branch */}
                <div className="bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <GitBranch size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Branch</span>
                  </div>
                  <div>
                    <span className="inline-block badge badge-success text-[10px] px-1.5 py-0.5 mt-0.5">
                      {projectMetadata.current_branch}
                    </span>
                  </div>
                </div>

                {/* Last Commit SHA */}
                <div className="bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <GitCommit size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Commit SHA</span>
                  </div>
                  <div className="text-textMain font-mono text-[11px] truncate mt-0.5" title={projectMetadata.commit_sha || 'N/A'}>{projectMetadata.commit_sha || 'N/A'}</div>
                </div>
                
                {/* Added On */}
                <div className="lg:col-span-2 bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <Calendar size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Added On</span>
                  </div>
                  <div className="text-textMain font-medium text-[12px]">{new Date(projectMetadata.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                </div>
                
                {/* Last Activity */}
                <div className="lg:col-span-2 bg-bgPanel border border-borderColor rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 text-textMuted mb-1">
                    <Clock size={13} className="text-primary/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Last Activity</span>
                  </div>
                  <div className="text-textMain font-medium text-[12px]">{new Date(projectMetadata.last_activity_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          {error && (
            <div className="p-4 m-4 bg-red-100 text-red-800 rounded border border-red-200 shrink-0">
              {error}
            </div>
          )}
          <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
          <thead className="bg-bgPanel sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-16">id</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[200px]">filename</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[400px]">code</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted max-w-[200px]">embedding</th>
              <th className="p-2 border-r border-b border-borderColor font-semibold text-textMuted w-20">start_line</th>
              <th className="p-2 border-b border-borderColor font-semibold text-textMuted w-20">end_line</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-10 text-center text-textMuted font-sans">Loading project data...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="6" className="p-10 text-center text-textMuted font-sans">No indexed code found for this project and branch.</td></tr>
            ) : (
              data.map(row => (
                <tr 
                  key={row.id} 
                  className="border-b border-borderColor hover:bg-bgHover cursor-pointer"
                  onDoubleClick={() => handleRowDoubleClick(row.id)}
                >
                  <td className="p-2 border-r border-borderColor">{row.id}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[200px]" title={row.filename}>{row.filename}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[400px]" title={row.code}>{row.code}</td>
                  <td className="p-2 border-r border-borderColor truncate max-w-[200px] text-green-700" title={row.embedding}>{row.embedding}</td>
                  <td className="p-2 border-r border-borderColor">{row.start_line}</td>
                  <td className="p-2">{row.end_line}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
          </div>
        ) : activeTab === 'builds' ? (
          <>
            {/* Left Sidebar for Builds */}
            <div className="w-64 border-r border-borderColor bg-bgPanel flex flex-col shrink-0">
              <div className="p-3 border-b border-borderColor font-bold text-sm text-textMain flex items-center justify-between">
                Build History
                <button onClick={loadJobs} className="text-textMuted hover:text-textMain"><RefreshCw size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {jobs.map(job => (
                  <div 
                    key={job.id} 
                    className={`p-3 border-b border-borderColor cursor-pointer hover:bg-bgHover flex items-start gap-2 ${selectedJob?.id === job.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                    onClick={() => handleSelectJob(job)}
                  >
                    <div className="mt-0.5">
                      {job.status === 'SUCCESS' && <div className="w-3 h-3 rounded-full bg-green-500"></div>}
                      {job.status === 'FAILED' && <div className="w-3 h-3 rounded-full bg-red-500"></div>}
                      {job.status === 'IN_PROGRESS' && <RefreshCw size={12} className="animate-spin text-blue-500" />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-textMain flex items-center gap-2">
                        #{job.id}
                        <span className="text-[10px] font-normal text-textMuted uppercase">{job.status}</span>
                      </div>
                      <div className="text-xs text-textMuted mt-1">
                        {new Date(job.indexed_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </div>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <div className="p-4 text-center text-xs text-textMuted">No builds yet.</div>}
              </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 overflow-auto bg-bgPanel flex flex-col p-4">
              {selectedJob ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2">Console Output - Job #{selectedJob.id}</h3>
                    {selectedJob.status === 'IN_PROGRESS' && <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold animate-pulse">RUNNING...</span>}
                  </div>
                  <BuildPipelineFlow logText={jobLogs} jobStatus={selectedJob.status} />
                  <div className="flex-1 bg-[#1e1e1e] rounded-lg p-4 overflow-auto border border-borderColor shadow-inner">
                    <pre className="text-gray-300 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{jobLogs}</pre>
                    {selectedJob.status === 'IN_PROGRESS' && (
                      <div className="flex items-center gap-2 text-gray-500 text-xs mt-2">
                        <RefreshCw size={12} className="animate-spin" /> Fetching live logs...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-textMuted gap-3">
                  <RefreshCw size={48} className="opacity-20" />
                  <p>Select a build from the history to view its console output.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto bg-bgPanel flex flex-col p-8">
            <div className="max-w-4xl mx-auto w-full space-y-10">
              
              {/* File Rules Preview */}
              <div>
                <h2 className="text-xl font-bold text-textMain mb-1">Indexed Files Preview</h2>
                <p className="text-textMuted mb-4 text-[13px]">
                  Preview which files in the repository match this project's inclusion and exclusion rules.<br/>
                  <span className="text-green-600 font-medium">Green</span> = Indexed, <span className="line-through text-textMuted/60">Strikethrough</span> = Ignored.
                </p>
                <div className="h-[400px] bg-bgMain border border-borderColor rounded-lg overflow-hidden shadow-sm relative">
                   {treeLoading && (
                     <div className="absolute inset-0 bg-bgMain/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                       <RefreshCw size={24} className="animate-spin text-primary" />
                     </div>
                   )}
                   <FileTree 
                     items={treeData}
                     includedPatterns={projectMetadata?.included_patterns || ''}
                     excludedPatterns={projectMetadata?.excluded_patterns || ''}
                     disableActions={true}
                   />
                </div>
              </div>

              {/* Danger Zone */}
              <div>
                <h2 className="text-xl font-bold text-textMain mb-1">Delete project</h2>
                <p className="text-textMuted mb-6 text-sm">Permanently remove your project and its database</p>
              
              <div className="border border-red-500/50 rounded-lg p-5 bg-red-500/5">
                <div className="flex gap-4">
                  <div className="bg-[#E25C4C] shrink-0 w-8 h-8 rounded flex items-center justify-center text-white mt-1">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-textMain mb-1 text-[15px]">Deleting this project will also remove your database.</h4>
                    <p className="text-textMuted text-sm mb-5">Make sure you have made a backup if you want to keep your data.</p>
                    
                    <button 
                      onClick={() => {
                        setDeleteConfirmText('');
                        setShowDeleteModal(true);
                      }}
                      disabled={isIndexing || hasActiveJob}
                      className="bg-[#5c2423] hover:bg-[#4a1c1b] text-[#e0b0b0] hover:text-white py-1.5 px-4 text-[13px] rounded shadow-sm transition-colors border border-[#8a3333] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Delete project
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Database Detail Modal */} {selectedRow && (
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-bgMain border border-borderColor rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-red-500 mb-2">Delete Project</h3>
            <p className="text-sm text-textMuted mb-4">
              This action cannot be undone. It will delete the project metadata, indexing history, vector embeddings, and all cached repositories.
            </p>
            <p className="text-sm text-textMain mb-2">
              Please type <strong className="bg-bgHover px-1.5 py-0.5 rounded text-red-500 select-all">{expectedConfirmText}</strong> to confirm.
            </p>
            <input 
              type="text" 
              className="input-field w-full mb-4 py-2 px-3 text-sm" 
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`${project}/${branch}`}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary px-4 py-2 text-sm"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2"
                disabled={isDeleting || deleteConfirmText !== expectedConfirmText}
              >
                {isDeleting ? <div className="loader border-t-white w-4 h-4"></div> : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectDetails;
