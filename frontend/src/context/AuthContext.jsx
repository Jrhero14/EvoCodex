import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Menu access map per role.
 * Each role has a list of menu paths they can access.
 */
const ROLE_MENU_ACCESS = {
  admin: ['query', 'monitoring', 'database', 'projects', 'templates', 'users'],
  maintener: ['query', 'monitoring', 'database', 'projects', 'templates'],
  guest: ['query', 'database', 'projects'],
};

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadAuth = useCallback(() => {
    const token = localStorage.getItem('cocoindex_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role || 'guest');
        setUsername(decoded.sub || null);
      } catch {
        setRole(null);
        setUsername(null);
      }
    } else {
      setRole(null);
      setUsername(null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  /**
   * Check if the current user has access to a given menu name.
   * @param {string} menuName - e.g. 'query', 'users', 'templates'
   * @returns {boolean}
   */
  const hasAccess = useCallback((menuName) => {
    if (!role) return false;
    const allowed = ROLE_MENU_ACCESS[role];
    if (!allowed) return false;
    return allowed.includes(menuName);
  }, [role]);

  /**
   * Refresh the auth state (call after login/token change).
   */
  const refreshAuth = useCallback(() => {
    loadAuth();
  }, [loadAuth]);

  return (
    <AuthContext.Provider value={{ role, username, loaded, hasAccess, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
