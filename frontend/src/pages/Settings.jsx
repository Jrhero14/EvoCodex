import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSetting, regenerateSetting } from '../services/api';
import { Eye, EyeOff, Edit2, Save, X, RefreshCw, Shield, GitBranch, Cpu, Key, Users } from 'lucide-react';
import UsersPage from './Users';

const CATEGORY_META = {
  users: { label: 'User Management', icon: Users, color: 'text-indigo-500' },
  gitlab: { label: 'GitLab Configuration', icon: GitBranch, color: 'text-orange-500' },
  ai: { label: 'AI & Embedding Services', icon: Cpu, color: 'text-blue-500' },
  auth: { label: 'Internal Auth', icon: Key, color: 'text-green-500' },
  oauth: { label: 'OAuth Configuration', icon: Shield, color: 'text-purple-500' },
};

const CATEGORY_ORDER = ['users', 'gitlab', 'ai', 'auth', 'oauth'];

const FIELD_ORDER = {
  gitlab: ['GITLAB_PAT', 'GITLAB_WEBHOOK_SECRET'],
  ai: ['GOOGLE_CLOUD_PROJECT', 'VERTEX_PROJECT', 'COCOINDEX_EMBEDDING_PROVIDER', 'HF_TOKEN'],
  auth: ['JWT_SECRET_KEY', 'AGENT_API_KEY'],
  oauth: ['ENABLE_OAUTH', 'OAUTH_PROVIDER', 'OAUTH_WELL_KNOWN_URL', 'OAUTH_DOMAIN', 'OAUTH_REALM', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET']
};

const Settings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingChanges, setPendingChanges] = useState({});
  const hasChanges = Object.keys(pendingChanges).length > 0;

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const toggleVisibility = (key) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEdit = (key, currentValue) => {
    setEditingKey(key);
    setEditValue(currentValue);
    setVisibleKeys(prev => new Set(prev).add(key));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const confirmLocalSave = (key) => {
    setPendingChanges(prev => ({ ...prev, [key]: editValue }));
    setEditingKey(null);
    setEditValue('');
  };

  const handleGlobalSave = async () => {
    if (!hasChanges) return;
    try {
      setSaving(true);
      let currentPending = { ...pendingChanges };
      if (editingKey) {
        currentPending[editingKey] = editValue;
      }
      
      const promises = Object.entries(currentPending).map(([k, v]) => updateSetting(k, v));
      await Promise.all(promises);
      setPendingChanges({});
      setEditingKey(null);
      setEditValue('');
      await loadSettings();
    } catch (err) {
      setError('Failed to save changes');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (key) => {
    if (!window.confirm(`Are you sure you want to regenerate ${key}? The old value will be permanently replaced.`)) return;
    try {
      setSaving(true);
      await regenerateSetting(key);
      await loadSettings();
      setVisibleKeys(prev => new Set(prev).add(key));
    } catch (err) {
      setError(`Failed to regenerate ${key}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getDisplayValue = (setting, currentValue) => {
    if (editingKey === setting.key) return currentValue;
    if (setting.is_sensitive && !visibleKeys.has(setting.key)) {
      if (currentValue === setting.value) return setting.masked_value;
      return "••••••••";
    }
    return currentValue;
  };

  const [activeTab, setActiveTab] = useState(CATEGORY_ORDER[0]);

  // Group settings by category and sort by field order
  const grouped = CATEGORY_ORDER.map(cat => {
    const catItems = settings.filter(s => s.category === cat);
    const order = FIELD_ORDER[cat] || [];
    
    catItems.sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      const posA = idxA === -1 ? 999 : idxA;
      const posB = idxB === -1 ? 999 : idxB;
      return posA - posB;
    });

    return {
      category: cat,
      ...CATEGORY_META[cat],
      items: catItems,
    };
  }).filter(g => g.items.length > 0 || g.category === 'users');

  const activeGroup = grouped.find(g => g.category === activeTab) || grouped[0];

  return (
    <div className="p-6 w-full h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-xl font-bold text-textMain">Settings</h2>
        {activeTab !== 'users' && (
          <button
            onClick={handleGlobalSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors ${
              hasChanges && !saving
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                : 'bg-borderColor/30 text-textMuted cursor-not-allowed'
            }`}
          >
            {saving ? <div className="loader loader-sm border-white border-2" /> : <Save size={16} />}
            Save Changes
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 text-red-700 text-sm font-medium shrink-0">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="loader" /></div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b border-borderColor mb-6 shrink-0 overflow-x-auto hide-scrollbar">
            {grouped.map(group => {
              const IconComp = group.icon;
              const isActive = activeTab === group.category;
              return (
                <button
                  key={group.category}
                  onClick={() => {
                    setActiveTab(group.category);
                    cancelEdit(); // Cancel any active edits when switching tabs
                  }}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 font-semibold text-sm transition-colors whitespace-nowrap ${
                    isActive 
                      ? 'border-primary text-primary bg-primary/5' 
                      : 'border-transparent text-textMuted hover:text-textMain hover:bg-bgHover'
                  }`}
                >
                  <IconComp size={16} className={isActive ? group.color : ''} />
                  {group.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {activeGroup && activeGroup.category === 'users' ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <UsersPage isNested={true} />
              </div>
            ) : activeGroup && (
              <div className="panel animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 px-5 py-3 border-b-2 border-borderColor bg-bgMain">
                  {React.createElement(activeGroup.icon, { size: 18, className: activeGroup.color })}
                  <h3 className="font-bold text-textMain text-[15px]">{activeGroup.label}</h3>
                </div>
                <div className="divide-y divide-borderColor">
                  {activeGroup.items.map(setting => {
                    const isPending = pendingChanges[setting.key] !== undefined;
                    const currentValue = isPending ? pendingChanges[setting.key] : setting.value;

                    return (
                    <div key={setting.key} className="px-5 py-6 flex items-center gap-6 hover:bg-bgHover transition-colors">
                      <div className="w-1/4 min-w-[250px] shrink-0">
                        <div className="font-mono text-sm font-semibold text-textMain">{setting.key}</div>
                        {setting.description && (
                          <div className="text-xs text-textMuted mt-1">{setting.description}</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex items-center">
                        {setting.key === 'ENABLE_OAUTH' ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={currentValue === 'true'}
                              onChange={(e) => {
                                const newVal = e.target.checked ? 'true' : 'false';
                                setPendingChanges(prev => ({ ...prev, [setting.key]: newVal }));
                              }}
                              disabled={saving}
                            />
                            <div className="w-11 h-6 bg-borderColor/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-borderColor after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"></div>
                          </label>
                        ) : editingKey === setting.key ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmLocalSave(setting.key)}
                            className="input-field text-sm font-mono w-full"
                            autoFocus
                          />
                        ) : (
                          <div className={`text-sm font-mono truncate ${isPending ? 'text-primary font-bold' : 'text-textMuted'}`}>
                            {getDisplayValue(setting, currentValue) || <span className="italic text-textMuted/50">empty</span>}
                            {isPending && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Unsaved</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {setting.is_sensitive && editingKey !== setting.key && (
                          <button
                            onClick={() => toggleVisibility(setting.key)}
                            className="icon-btn"
                            title={visibleKeys.has(setting.key) ? 'Hide' : 'Show'}
                          >
                            {visibleKeys.has(setting.key) ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}

                        {editingKey === setting.key ? (
                          <>
                            <button
                              onClick={() => confirmLocalSave(setting.key)}
                              className="icon-btn text-green-600 hover:text-green-700"
                              disabled={saving}
                              title="Confirm Edit"
                            >
                              <Save size={15} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="icon-btn text-red-500 hover:text-red-600"
                              title="Cancel"
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          !['JWT_SECRET_KEY', 'COCOINDEX_EMBEDDING_PROVIDER', 'ENABLE_OAUTH'].includes(setting.key) && (
                            <button
                              onClick={() => startEdit(setting.key, currentValue)}
                              className="icon-btn"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                          )
                        )}

                        {setting.is_regenerable && editingKey !== setting.key && (
                          <button
                            onClick={() => handleRegenerate(setting.key)}
                            className="icon-btn text-amber-500 hover:text-amber-600"
                            disabled={saving}
                            title="Regenerate"
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
