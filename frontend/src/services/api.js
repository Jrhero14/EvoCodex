import axios from 'axios';

export const getApiBaseUrl = () => {
  let baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  // If running on a remote tunnel (ngrok, devtunnels) but configured for localhost, use the current origin
  if (baseURL.includes('localhost') && window.location.hostname !== 'localhost') {
    baseURL = window.location.origin;
  }
  return baseURL.endsWith('/api') ? baseURL : `${baseURL}/api`;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cocoindex_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept login requests to avoid refreshing the page on wrong credentials
      if (originalRequest.url?.endsWith('login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('cocoindex_refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('cocoindex_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${getApiBaseUrl()}/refresh`, { refresh_token: refreshToken });
        const newAuthToken = res.data.token;
        const newRefreshToken = res.data.refresh_token;

        localStorage.setItem('cocoindex_token', newAuthToken);
        localStorage.setItem('cocoindex_refresh_token', newRefreshToken);

        api.defaults.headers.common['Authorization'] = 'Bearer ' + newAuthToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + newAuthToken;
        
        processQueue(null, newAuthToken);
        
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('cocoindex_token');
        localStorage.removeItem('cocoindex_refresh_token');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const loginApi = async (username, password) => {
  return api.post('login', { username, password });
};

export const fetchMonitoringHistory = async () => {
  const res = await api.get('monitoring/history');
  return res.data;
};

export const fetchDatabaseTable = async (page = 1, limit = 50, projectName = "", branch = "") => {
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({ limit, offset });
  if (projectName) params.append('project_name', projectName);
  if (branch) params.append('branch', branch);
  const res = await api.get(`database/code_embedded?${params.toString()}`);
  return res.data;
};

export const fetchRowDetails = async (id) => {
  const res = await api.get(`database/code_embedded/${id}`);
  return res.data;
};

export const queryDatabase = async (queryText, limit = 5, projectName = "", branch = "", searchMode = "hybrid") => {
  const res = await api.get('search', {
    params: {
      query: queryText,
      top_k: limit,
      project_name: projectName,
      branch: branch,
      search_mode: searchMode
    }
  });
  return res.data;
};

export const triggerReindex = async (repoUrl, projectName, branch) => {
  const res = await api.post('index_repo', {
    repo_url: repoUrl,
    project_name: projectName,
    branch: branch
  });
  return res.data;
};

export const triggerForceReindex = async (repoUrl, branch) => {
  const res = await api.post('index_repo', {
    repo_url: repoUrl,
    branch: branch,
    force: true
  });
  return res.data;
};

export const fetchProjects = async (page = 1, limit = 10, search = '') => {
  const params = new URLSearchParams({ page, limit, search });
  const res = await api.get(`/projects?${params.toString()}`);
  return res.data;
};

export const addProject = async (repositoryUrl, branch = "", includedPatterns = null, excludedPatterns = null) => {
  const res = await api.post('projects', {
    repository_url: repositoryUrl,
    branch,
    included_patterns: includedPatterns,
    excluded_patterns: excludedPatterns
  });
  return res.data;
};

export const fetchProjectTree = async (repoUrl, branch = "") => {
  const params = new URLSearchParams({ repo_url: repoUrl });
  if (branch) params.append('branch', branch);
  const res = await api.get(`projects/tree?${params.toString()}`);
  return res.data;
};

export const fetchProjectBranches = async (repoUrl) => {
  const params = new URLSearchParams({ repo_url: repoUrl });
  const res = await api.get(`projects/branches?${params.toString()}`);
  return res.data;
};

export const deleteProject = async (id) => {
  const res = await api.delete(`projects/${id}`);
  return res.data;
};

// -- Templates --
export const fetchTemplates = async () => {
  const res = await api.get('templates');
  return res.data;
};

export const addTemplate = async (name, templateCode, includedPatterns, excludedPatterns) => {
  const res = await api.post('templates', {
    name,
    template_code: templateCode,
    included_patterns: includedPatterns,
    excluded_patterns: excludedPatterns,
  });
  return res.data;
};

export const updateTemplate = async (id, name, templateCode, includedPatterns, excludedPatterns) => {
  const res = await api.put(`templates/${id}`, {
    name,
    template_code: templateCode,
    included_patterns: includedPatterns,
    excluded_patterns: excludedPatterns,
  });
  return res.data;
};

export const deleteTemplate = async (id) => {
  const res = await api.delete(`templates/${id}`);
  return res.data;
};

// -- Users --
export const fetchUsers = async () => {
  const res = await api.get('users');
  return res.data;
};

export const addUser = async (username, password, role_id) => {
  const res = await api.post('users', { username, password, role_id });
  return res.data;
};

export const updateUser = async (id, username, password, role_id) => {
  const res = await api.put(`users/${id}`, { username, password, role_id });
  return res.data;
};

export const deleteUser = async (id) => {
  const res = await api.delete(`users/${id}`);
  return res.data;
};

// -- Roles --
export const fetchRoles = async () => {
  const res = await api.get('roles');
  return res.data;
};

// -- Jobs --
export const fetchProjectJobs = async (projectName, branch) => {
  const res = await api.get(`projects/${encodeURIComponent(projectName)}/${encodeURIComponent(branch)}/jobs`);
  return res.data;
};

export const fetchRecentJobs = async () => {
  const res = await api.get('jobs/recent');
  return res.data;
};

export const fetchJobLogs = async (jobId) => {
  const res = await api.get(`jobs/${jobId}/logs`);
  return res.data;
};

export default api;

