import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import QueryView from './pages/QueryView';
import MonitoringView from './pages/MonitoringView';
import DatabaseView from './pages/DatabaseView';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Templates from './pages/Templates';

import Settings from './pages/Settings';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const PrivateRoute = ({ children, requiredMenu }) => {
  const token = localStorage.getItem('cocoindex_token');
  const { hasAccess, loaded } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Wait for auth context to finish loading
  if (!loaded) {
    return null;
  }

  // If a specific menu is required, check access
  if (requiredMenu && !hasAccess(requiredMenu)) {
    return <Navigate to="/query" replace />;
  }

  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/query" element={<PrivateRoute requiredMenu="query"><QueryView /></PrivateRoute>} />
      <Route path="/monitoring" element={<PrivateRoute requiredMenu="monitoring"><MonitoringView /></PrivateRoute>} />
      <Route path="/database" element={<PrivateRoute requiredMenu="database"><DatabaseView /></PrivateRoute>} />
      <Route path="/projects" element={<PrivateRoute requiredMenu="projects"><Projects /></PrivateRoute>} />
      <Route path="/projects/:projectName/:branchName" element={<PrivateRoute requiredMenu="projects"><ProjectDetails /></PrivateRoute>} />
      <Route path="/templates" element={<PrivateRoute requiredMenu="templates"><Templates /></PrivateRoute>} />

      <Route path="/settings" element={<PrivateRoute requiredMenu="settings"><Settings /></PrivateRoute>} />
      
      <Route path="/" element={<Navigate to="/query" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
