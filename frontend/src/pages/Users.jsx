import React, { useState, useEffect } from 'react';
import { fetchUsers, addUser, updateUser, deleteUser, fetchRoles } from '../services/api';
import { Trash2, Plus, Edit2, Eye, EyeOff } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersRes);
      setRoles(rolesRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    let strength = { score: 0, label: 'Low', color: 'text-red-500', bg: 'bg-red-500', width: '33%' };
    
    // ISO secure password standard rules check
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const length = pwd.length;

    let typesCount = 0;
    if (hasLower) typesCount++;
    if (hasUpper) typesCount++;
    if (hasNumber) typesCount++;
    if (hasSpecial) typesCount++;

    if (length >= 8 && typesCount >= 4) {
      strength = { score: 2, label: 'Strong', color: 'text-green-600', bg: 'bg-green-600', width: '100%' };
    } else if (length >= 8 && typesCount >= 2) {
      strength = { score: 1, label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-500', width: '66%' };
    } else {
      strength = { score: 0, label: 'Low', color: 'text-red-500', bg: 'bg-red-500', width: '33%' };
    }
    return strength;
  };

  const openAddModal = () => {
    setUsername('');
    setPassword('');
    // Default to guest role
    const guestRole = roles.find(r => r.name === 'guest');
    setRoleId(guestRole ? guestRole.id : '');
    setIsEditing(false);
    setEditId(null);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setUsername(user.username);
    setPassword('');
    setRoleId(user.role_id || '');
    setIsEditing(true);
    setEditId(user.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username) {
      setError('Username is required');
      return;
    }
    if (!isEditing && !password) {
      setError('Password is required for new users');
      return;
    }
    if (!roleId) {
      setError('Role is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      if (isEditing) {
        await updateUser(editId, username, password, parseInt(roleId));
      } else {
        await addUser(username, password, parseInt(roleId));
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(id);
      loadUsers();
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  // Helper to get a Tailwind color for a role badge
  const getRoleBadgeClass = (roleName) => {
    switch (roleName) {
      case 'admin':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'maintener':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'guest':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-textMain">User Management</h1>
        <button 
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2 w-auto px-4"
        >
          <Plus /> Add User
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20"><div className="loader border-t-primary"></div></div>
      ) : (
        <div className="bg-bgPanel rounded-xl shadow overflow-x-auto border border-borderSubtle">
          <table className="w-full text-sm text-left">
            <thead className="bg-bgMain text-textMain text-xs uppercase border-b border-borderSubtle">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-textMuted">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-borderSubtle hover:bg-bgHover transition-colors">
                    <td className="px-6 py-4 font-medium text-textMain">
                      <div className="flex items-center gap-2">
                        {u.username}
                        {u.is_sso ? (
                          <span className="bg-blue-100 text-blue-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-blue-200">
                            SSO
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-gray-200">
                            Internal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(u.role_name)}`}>
                        {u.role_name || 'No role'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-textMuted">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 flex justify-center gap-4">
                      <button
                        onClick={() => openEditModal(u)}
                        className="text-textMuted hover:text-blue-500 transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bgPanel rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-6">
            
            <div>
              <h2 className="text-xl font-bold text-textMain mb-4">{isEditing ? 'Edit User' : 'Add User'}</h2>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Username</label>
                  <input 
                    type="text" 
                    className={`input-field w-full ${isEditing ? 'opacity-60 bg-bgHover cursor-not-allowed' : ''}`}
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                    disabled={isEditing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">
                    Password {isEditing && <span className="text-xs font-normal text-textMuted">(Leave blank to keep unchanged)</span>}
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      className="input-field w-full pr-10"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isEditing}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {password && (
                    <div className="mt-2">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-medium text-textMuted">Password strength:</span>
                        <span className={`font-bold ${getPasswordStrength(password).color}`}>
                          {getPasswordStrength(password).label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${getPasswordStrength(password).bg}`}
                          style={{ width: getPasswordStrength(password).width }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-textMain mb-2">Role</label>
                  <select
                    className="input-field w-full"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select a role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.description}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-borderColor">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-textMain transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary flex items-center justify-center min-w-[100px] w-auto px-4"
                    disabled={saving}
                  >
                    {saving ? <div className="loader border-t-white h-4 w-4 border-2"></div> : (isEditing ? 'Save Changes' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
