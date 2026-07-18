import React, { useState, useEffect, useRef } from 'react';
import { fetchTemplates, addTemplate, updateTemplate, deleteTemplate, fetchProjectBranches, fetchProjectTree } from '../services/api';
import { Plus, Edit2, Play } from 'lucide-react';
import ChipsInput from '../components/ChipsInput';
import FileTree from '../components/FileTree';

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTimeoutRef = useRef(null);
  
  const [name, setName] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [includedPatterns, setIncludedPatterns] = useState([]);
  const [excludedPatterns, setExcludedPatterns] = useState([]);
  
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  const [treeData, setTreeData] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetchTemplates();
      setTemplates(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openAddModal = () => {
    setName('');
    setTemplateCode('');
    setIncludedPatterns([]);
    setExcludedPatterns([]);
    setIsEditing(false);
    setEditId(null);
    setError('');
    setRepoUrl('');
    setBranch('');
    setBranches([]);
    setTreeData([]);
    setTreeError('');
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setIsEditing(true);
    setEditId(template.id);
    setName(template.name);
    setTemplateCode(template.template_code);
    setIncludedPatterns(template.included_patterns ? template.included_patterns.split(',').map(p => p.trim()).filter(Boolean) : []);
    setExcludedPatterns(template.excluded_patterns ? template.excluded_patterns.split(',').map(p => p.trim()).filter(Boolean) : []);
    setRepoUrl('');
    setBranch('');
    setBranches([]);
    setTreeData([]);
    setTreeError('');
    setError('');
    setIsConfirmingDelete(false);
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    setShowModal(true);
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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Template name is required');
      return;
    }
    if (templateCode.includes(' ')) {
      setError('Template code cannot contain spaces');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      if (isEditing) {
        await updateTemplate(editId, name, templateCode, includedPatterns.join(','), excludedPatterns.join(','));
      } else {
        await addTemplate(name, templateCode, includedPatterns.join(','), excludedPatterns.join(','));
      }
      setShowModal(false);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      alert("Failed to delete template");
    }
  };

  const handleDeleteClick = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      deleteTimeoutRef.current = setTimeout(() => {
        setIsConfirmingDelete(false);
      }, 5000);
    } else {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      handleDelete(editId);
      setShowModal(false);
    }
  };

  return (
    <div className="p-8 w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-textMain">Project Templates</h1>
        <button 
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2 w-auto px-4"
        >
          <Plus /> Add Template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20"><div className="loader border-t-primary"></div></div>
      ) : (
        <div className="bg-bgPanel rounded-xl shadow overflow-x-auto border border-borderSubtle">
          <table className="w-full text-sm text-left">
            <thead className="bg-bgMain text-textMain text-xs uppercase border-b border-borderSubtle">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Included Patterns</th>
                <th className="px-6 py-4">Excluded Patterns</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-textMuted">No templates found. Add one to get started!</td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="border-b border-borderSubtle hover:bg-bgHover transition-colors">
                    <td className="px-6 py-4 font-medium text-textMain">{t.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-textMuted">{t.template_code}</td>
                    <td className="px-6 py-4 text-textMuted max-w-xs truncate" title={t.included_patterns}>{t.included_patterns}</td>
                    <td className="px-6 py-4 text-textMuted max-w-xs truncate" title={t.excluded_patterns}>{t.excluded_patterns}</td>
                    <td className="px-6 py-4 flex justify-center gap-4">
                      <button
                        onClick={() => openEditModal(t)}
                        className="text-textMuted hover:text-blue-500 transition-colors"
                        title="Edit Template"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-bgPanel rounded-xl shadow-xl w-full max-w-5xl p-6 flex flex-col max-h-[95vh]">
            <h2 className="text-xl font-bold text-textMain mb-4">{isEditing ? 'Edit Template' : 'Add Template'}</h2>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 shrink-0">
                {error}
              </div>
            )}
            
            <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0 overflow-y-auto pr-1">
              
              {/* Left Column: Template Data */}
              <div className="flex-1 flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Template Name</label>
                  <input 
                    type="text" 
                    className="input-field w-full"
                    placeholder="e.g. React JS Template"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Template Code</label>
                  <input 
                    type="text" 
                    className="input-field w-full"
                    placeholder="e.g. react-js"
                    value={templateCode}
                    onChange={(e) => setTemplateCode(e.target.value.replace(/\s/g, ''))}
                    required 
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Included Patterns</label>
                  <ChipsInput 
                    value={includedPatterns}
                    onChange={setIncludedPatterns}
                    placeholder="Type pattern and press Enter..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Excluded Patterns</label>
                  <ChipsInput 
                    value={excludedPatterns}
                    onChange={setExcludedPatterns}
                    placeholder="Type pattern and press Enter..."
                  />
                </div>
              </div>
              
              {/* Right Column: Preview Setup and File Tree */}
              <div className="flex-1 flex flex-col gap-5">
                <div className="bg-bgHover p-4 rounded-lg border border-borderColor space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-textMain">Preview Setup</h3>
                    <p className="text-xs text-textMuted mt-1">Use a reference project to preview the patterns against a real codebase.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-textMain mb-1.5">Test Repository URL (Optional)</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        className="input-field flex-1 py-1.5 text-sm"
                        placeholder="https://gitlab.example.com/team/repo.git"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
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
                      <label className="block text-xs font-semibold text-textMain mb-1.5">Test Branch</label>
                      <select 
                        className="input-field w-full py-1.5 text-sm"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
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
                       />
                     )}
                   </div>
                </div>
              </div>
            </div>

            <div className={`flex ${isEditing ? 'justify-between' : 'justify-end'} gap-3 mt-6 pt-4 border-t border-borderColor shrink-0`}>
              {isEditing && (
                <button 
                  type="button" 
                  onClick={handleDeleteClick}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all relative overflow-hidden flex items-center justify-center ${
                    isConfirmingDelete 
                      ? 'bg-red-50 text-red-700' 
                      : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                  }`}
                >
                  <span className="relative z-10">{isConfirmingDelete ? 'Click again to confirm' : 'Delete Template'}</span>
                  {isConfirmingDelete && (
                    <div className="absolute bottom-0 right-0 h-1 bg-red-500 animate-shrink-x w-full" style={{ transformOrigin: 'right' }} />
                  )}
                </button>
              )}
              <div className="flex gap-3">
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
                  disabled={saving}
                >
                  {saving ? <div className="loader border-t-white h-4 w-4 border-2"></div> : (isEditing ? 'Save Changes' : 'Save Template')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Templates;
