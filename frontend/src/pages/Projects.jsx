import React, { useState, useEffect } from 'react';
import { fetchProjects, addProject, deleteProject, fetchProjectTree, fetchProjectBranches, fetchTemplates } from '../services/api';
import { Trash2, Plus, ExternalLink, Info, Copy, Database, Play, LayoutTemplate, Settings2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FileTree from '../components/FileTree';
import ChipsInput from '../components/ChipsInput';
import { useAuth } from '../context/AuthContext';

const Projects = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = role !== 'guest';
  const [projects, setProjects] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [includedPatterns, setIncludedPatterns] = useState(['**/*.py','**/*.rs','**/*.toml','**/*.md','**/*.mdx','**/*.js','**/*.jsx','**/*.ts','**/*.tsx']);
  const [excludedPatterns, setExcludedPatterns] = useState(['**/.*','**/target','**/node_modules','**/scripts','**/internal']);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  
  const [treeData, setTreeData] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState('');
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [templates, setTemplates] = useState([]);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filterText);
      setPage(1); // reset page on search
    }, 500);
    return () => clearTimeout(handler);
  }, [filterText]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetchProjects(page, limit, debouncedSearch);
      setProjects(res.data || []);
      if (res.pagination) {
        setTotalRows(res.pagination.total_rows);
        setTotalPages(res.pagination.total_pages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetchTemplates();
        setTemplates(res);
      } catch (err) {
        console.error(err);
      }
    };
    loadTemplates();
  }, []);

  const handleTemplateChange = (e) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    const template = templates.find(t => t.id === parseInt(id));
    if (template) {
      setIncludedPatterns(template.included_patterns ? template.included_patterns.split(',') : []);
      setExcludedPatterns(template.excluded_patterns ? template.excluded_patterns.split(',') : []);
    }
  };

  const handleUseTemplateToggle = (useTpl) => {
    if (useTemplate === useTpl) return;
    setUseTemplate(useTpl);
    setSelectedTemplateId('');
    setIncludedPatterns([]);
    setExcludedPatterns([]);
    setRepoUrl('');
    setBranch('');
    setBranches([]);
    setTreeData([]);
    setTreeError('');
  };

  const handlePreviewTree = async () => {
    if (!repoUrl) return;
    setLoadingTree(true);
    setTreeError('');
    try {
      const res = await fetchProjectTree(repoUrl, branch);
      setTreeData(res.data || []);
    } catch (err) {
      setTreeError(err.response?.data?.detail || err.message || 'Failed to fetch tree');
    } finally {
      setLoadingTree(false);
    }
  };

  const handleFetchBranches = async () => {
    if (!repoUrl) return;
    setLoadingBranches(true);
    try {
      const res = await fetchProjectBranches(repoUrl);
      setBranches(res.data || []);
      if (res.data && res.data.length > 0) {
        setBranch(res.data.includes('main') ? 'main' : res.data.includes('master') ? 'master' : res.data[0]);
      }
    } catch (err) {
      setError('Failed to fetch branches. Check URL.');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!repoUrl || !branch) {
      setError('Repository URL and Branch are required');
      return;
    }
    
    setAdding(true);
    setError('');
    
    try {
      await addProject(repoUrl, branch, includedPatterns.join(','), excludedPatterns.join(','));
      setShowModal(false);
      setRepoUrl('');
      setBranch('');
      setBranches([]);
      setIncludedPatterns([]);
      setExcludedPatterns([]);
      setUseTemplate(false);
      setSelectedTemplateId('');
      loadProjects();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to add project');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await deleteProject(id);
      loadProjects();
    } catch (err) {
      alert("Failed to delete project");
    }
  };

  return (
    <div className="p-8 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-textMain">Projects</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="input-field w-full pl-9 py-2"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          {canWrite && (
            <button 
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2 w-auto px-4 py-2 shrink-0"
            >
              <Plus /> Add Project
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20"><div className="loader border-t-primary"></div></div>
      ) : (
        <div className="bg-bgPanel rounded-xl shadow overflow-x-auto border border-borderSubtle">
          <table className="w-full text-sm text-left">
            <thead className="bg-bgMain text-textMain text-xs uppercase border-b border-borderSubtle">
              <tr>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Namespace</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Last Activity</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-textMuted">No projects found. Add one to get started!</td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b border-borderSubtle hover:bg-bgHover transition-colors cursor-pointer" onClick={() => navigate(`/projects/${encodeURIComponent(p.project_name)}/${encodeURIComponent(p.current_branch)}`)}>
                    <td className="px-6 py-4 font-medium text-textMain">
                      {p.project_name}
                      <div className="text-xs text-textMuted font-normal mt-1">{p.project_id}</div>
                    </td>
                    <td className="px-6 py-4 text-textMuted">{p.namespace}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        {p.current_branch}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-textMuted">
                      {new Date(p.last_activity_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 flex items-center justify-center gap-4">
                      <button
                        onClick={() => navigate(`/projects/${encodeURIComponent(p.project_name)}/${encodeURIComponent(p.current_branch)}`)}
                        className="btn-secondary px-4 py-1.5 text-sm font-semibold"
                        title="View Details"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {!loading && totalPages > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-borderSubtle bg-bgMain gap-4">
              <div className="text-sm text-textMuted">
                Showing page <span className="font-semibold text-textMain">{page}</span> of <span className="font-semibold text-textMain">{totalPages}</span> 
                {' '}(Total: {totalRows} projects)
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-borderSubtle bg-bgPanel text-textMain disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bgHover transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex items-center gap-1">
                  <span className="text-sm text-textMuted">Go to:</span>
                  <input 
                    type="number" 
                    min="1" 
                    max={totalPages}
                    value={page}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setPage(val);
                      }
                    }}
                    className="input-field py-1 px-2 w-16 text-center text-sm"
                  />
                </div>

                <button 
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-borderSubtle bg-bgPanel text-textMain disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bgHover transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleAddProject} className="bg-bgPanel rounded-xl shadow-xl w-full max-w-5xl p-6 flex flex-col max-h-[95vh]">
            <h2 className="text-xl font-bold text-textMain mb-2">Add Project</h2>
            <p className="text-sm text-textMuted mb-4">
              Simply paste your GitLab repository URL. We will automatically extract the metadata and setup the project.
            </p>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 shrink-0">
                {error}
              </div>
            )}
            
            <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0 overflow-y-auto pr-1">
              
              {/* Left Column: Project Setup */}
              <div className="flex-1 flex flex-col gap-5">
                <div className="flex bg-bgHover p-1 rounded-lg border border-borderColor w-full">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${!useTemplate ? 'bg-bgPanel text-textMain shadow-sm border border-borderSubtle' : 'text-textMuted hover:text-textMain'}`}
                    onClick={() => handleUseTemplateToggle(false)}
                  >
                    <Settings2 size={16} /> Custom Setup
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${useTemplate ? 'bg-bgPanel text-textMain shadow-sm border border-borderSubtle' : 'text-textMuted hover:text-textMain'}`}
                    onClick={() => handleUseTemplateToggle(true)}
                  >
                    <LayoutTemplate size={16} /> Use Template
                  </button>
                </div>

                {useTemplate && (
                  <div>
                    <label className="block text-sm font-semibold text-textMain mb-2">Select Template</label>
                    <select 
                      className="input-field w-full"
                      value={selectedTemplateId}
                      onChange={handleTemplateChange}
                      required={useTemplate}
                    >
                      <option value="" disabled>Choose a template...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Included Patterns</label>
                  <ChipsInput 
                    value={includedPatterns}
                    onChange={setIncludedPatterns}
                    placeholder={useTemplate ? '' : 'Type pattern and press Enter...'}
                    disabled={useTemplate}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Excluded Patterns</label>
                  <ChipsInput 
                    value={excludedPatterns}
                    onChange={setExcludedPatterns}
                    placeholder={useTemplate ? '' : 'Type pattern and press Enter...'}
                    disabled={useTemplate}
                  />
                </div>
              </div>
              
              {/* Right Column: Repository Setup and File Tree */}
              <div className="flex-1 flex flex-col gap-5">
                <div className="bg-bgHover p-4 rounded-lg border border-borderColor space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-textMain">Repository Setup</h3>
                    <p className="text-xs text-textMuted mt-1">Provide the repository details and preview the patterns.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-textMain mb-1.5">Repository URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        className="input-field flex-1 py-1.5 text-sm"
                        placeholder="https://gitlab.example.com/team/repo.git"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        required 
                      />
                      <button 
                        type="button"
                        onClick={handleFetchBranches}
                        disabled={!repoUrl || loadingBranches}
                        className="btn-secondary px-3 shrink-0 py-1.5 text-sm"
                      >
                        {loadingBranches ? 'Fetching...' : 'Get Branches'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-textMain mb-1.5">Branch</label>
                      <select 
                        className="input-field w-full py-1.5 text-sm"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        required
                        disabled={branches.length === 0}
                      >
                        <option value="" disabled>{branches.length === 0 ? 'Fetch branches first' : 'Select a branch'}</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={handlePreviewTree}
                      className="btn-secondary flex items-center justify-center gap-2 px-4 py-1.5 text-sm h-[34px]"
                      disabled={!repoUrl || loadingTree}
                    >
                      {loadingTree ? <div className="loader border-t-primary h-3 w-3 border-2"></div> : <Play size={14} />} 
                      Preview Files
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-bgMain rounded-lg border border-borderColor overflow-hidden min-h-[300px]">
                   <div className="p-3 border-b border-borderColor bg-bgPanel flex items-center justify-between">
                     <h3 className="text-sm font-bold text-textMain">File Tree Preview</h3>
                     {treeData.length > 0 && <span className="text-xs text-textMuted">{treeData.length} items</span>}
                   </div>
                   <div className="flex-1 overflow-auto p-0">
                     {treeError ? (
                       <div className="p-4 text-center text-red-500 text-sm">{treeError}</div>
                     ) : loadingTree ? (
                       <div className="flex justify-center items-center h-full"><div className="loader border-t-primary"></div></div>
                     ) : (
                       <FileTree 
                         items={treeData} 
                         includedPatterns={includedPatterns.join(',')} 
                         excludedPatterns={excludedPatterns.join(',')} 
                         onAddInclude={(p) => {
                           if (!includedPatterns.includes(p)) {
                             setIncludedPatterns(prev => [...prev, p]);
                             setExcludedPatterns(prev => prev.filter(item => item !== p));
                           }
                         }}
                         onAddExclude={(p) => {
                           if (!excludedPatterns.includes(p)) {
                             setExcludedPatterns(prev => [...prev, p]);
                             setIncludedPatterns(prev => prev.filter(item => item !== p));
                           }
                         }}
                         disableActions={useTemplate}
                       />
                     )}
                   </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-borderColor shrink-0">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-textMain transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary flex items-center justify-center min-w-[120px] w-auto px-4"
                disabled={adding}
              >
                {adding ? <div className="loader border-t-white h-4 w-4 border-2"></div> : 'Save Project'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Projects;
