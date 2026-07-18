import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, KeyRound, User, Shield } from 'lucide-react';

import { loginApi, getApiBaseUrl, fetchPublicSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';

const floatingSnippets = [
  'class IndexManager {',
  'def embed(chunk):',
  'SELECT * FROM code_embedded',
  'git pull origin main',
  'vector_search(query)',
  'process_file: 49 total',
  'cocoindex update',
  'CREATE INDEX ON embeddings',
  'async def sync():',
  'return cosine_similarity()',
];

const WaveMesh = () => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      
      time += 0.008;
      
      const lines = 18;
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        // Shift phase for each line
        const phase = i * 0.4;
        // Different amplitude and spacing for each line
        const amplitude = 30 + (i * 8);
        
        for (let x = 0; x <= width; x += 8) {
          // Combine multiple sine waves for a complex, 3D-like organic mesh
          const freq1 = (x * 0.002) + time * 0.8 + phase;
          const freq2 = (x * 0.005) - time * 0.3;
          const freq3 = (x * 0.001) + time * 0.1;
          
          const yOffset = Math.sin(freq1) * amplitude 
                        + Math.cos(freq2) * (amplitude * 0.4)
                        + Math.sin(freq3) * 60;
          
          const y = (height / 2) + yOffset;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        // Gradient stroke for a glowing electric feel
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, `rgba(100, 200, 255, 0)`);
        gradient.addColorStop(0.3, `rgba(100, 220, 255, ${0.12 - (i * 0.005)})`);
        gradient.addColorStop(0.7, `rgba(140, 255, 255, ${0.12 - (i * 0.005)})`);
        gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      
      // Floating glowing particles
      for(let p = 0; p < 60; p++) {
         const pX = (Math.sin(p * 74.3 + time * 0.2) * 0.5 + 0.5) * width;
         const pY = (Math.sin(p * 31.3 + time * 0.15) * 0.5 + 0.5) * height;
         ctx.beginPath();
         const radius = Math.abs(Math.sin(time * 0.5 + p)) * 2;
         ctx.arc(pX, pY, radius, 0, Math.PI * 2);
         ctx.fillStyle = `rgba(150, 230, 255, ${Math.sin(time + p) * 0.4 + 0.1})`;
         ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 pointer-events-none" 
    />
  );
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [oauthEnabled, setOauthEnabled] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuth } = useAuth();

  useEffect(() => {
    fetchPublicSettings().then(data => {
      if (data && data.ENABLE_OAUTH !== undefined) {
        setOauthEnabled(data.ENABLE_OAUTH);
      }
    }).catch(err => console.error("Failed to fetch public settings", err));
  }, []);

  useEffect(() => {
    // If we're redirected from OAuth callback, we'll have a token in the URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    if (token) {
      localStorage.setItem('cocoindex_token', token);
      if (refreshToken) localStorage.setItem('cocoindex_refresh_token', refreshToken);
      refreshAuth();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate('/query', { replace: true });
    }
  }, [location, navigate, refreshAuth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const loginRes = await loginApi(username, password);
      if (loginRes.data.token) {
        localStorage.setItem('cocoindex_token', loginRes.data.token);
        if (loginRes.data.refresh_token) {
          localStorage.setItem('cocoindex_refresh_token', loginRes.data.refresh_token);
        }
        await refreshAuth();
        navigate('/query');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-bgMain flex z-[1000] overflow-hidden">
      {/* ─── Floating code animation styles ─── */}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.12; }
          90% { opacity: 0.12; }
          100% { transform: translateY(-120px) rotate(3deg); opacity: 0; }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: fade-in-up 0.5s ease-out;
        }
        .login-input-focused {
          box-shadow: 4px 4px 0px #4F85AC !important;
          border-color: #4F85AC !important;
        }
        .sso-btn {
          box-shadow: 3px 3px 0px #1A1A1A;
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .sso-btn:active {
          transform: translate(3px, 3px);
          box-shadow: 0px 0px 0px #1A1A1A;
        }
      `}</style>

      {/* ─── Left Panel: Branding ─── */}
      <div className="hidden lg:flex w-[48%] relative flex-col justify-center items-center overflow-hidden" 
           style={{ background: 'linear-gradient(145deg, #070B19 0%, #101B36 40%, #152648 100%)' }}>
        
        {/* Animated Abstract Wave Mesh (MinIO style) */}
        <WaveMesh />

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-0" 
             style={{
               backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
               backgroundSize: '40px 40px',
             }} 
        />

        {/* Logo + Text */}
        <div className="relative z-10 flex flex-col items-center px-12 text-center mt-[-40px]">
          <div style={{ animation: 'logo-float 4s ease-in-out infinite' }}>
            <img 
              src="/logo.png" 
              alt="Evocodex Logo" 
              className="w-36 h-36 object-contain drop-shadow-2xl mb-6 opacity-90"
              style={{ filter: 'drop-shadow(0 8px 32px rgba(100,200,255,0.3))' }}
            />
          </div>
          <h1 className="text-white text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Inter, sans-serif', textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            Evocodex
          </h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            High-Performance Semantic Code Indexing & Intelligent Search
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 mt-10 justify-center">
            {['Semantic Search', 'Code Embedding', 'Real-Time Index'].map((f) => (
              <span key={f} className="px-4 py-2 text-xs font-bold tracking-wide uppercase text-white/90 border border-white/10 rounded-full bg-white/[0.03] backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom decorative bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 z-20" 
             style={{ background: 'linear-gradient(90deg, transparent, #0EA5E9, #38BDF8, #0EA5E9, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 4s linear infinite', opacity: 0.8 }} 
        />
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 relative">
        {/* Subtle texture dots */}
        <div className="absolute inset-0 pointer-events-none" 
             style={{
               backgroundImage: 'radial-gradient(#1A1A1A 0.5px, transparent 0.5px)',
               backgroundSize: '16px 16px',
               opacity: 0.03,
             }} 
        />

        <div className="login-card w-full max-w-[420px] relative z-10">
          {/* Mobile logo (shown only on small screens) */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <img src="/logo.png" alt="Evocodex Logo" className="h-12 w-auto" />
            <h2 className="text-primary text-3xl font-bold tracking-tight">Evocodex</h2>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-textMain tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              Welcome back
            </h2>
            <p className="text-textMuted text-sm mt-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-[#FAECEF] border-2 border-danger p-3.5 mb-5 text-sm text-[#8B2240]" 
                 style={{ boxShadow: '3px 3px 0px #E35876' }}>
              <Shield size={16} className="mt-0.5 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold text-textMain mb-2 uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" />
                <input 
                  type="text" 
                  className={`w-full pl-10 pr-4 py-3 border-2 border-borderColor bg-bgPanel text-[15px] text-textMain focus:outline-none transition-all ${focusedField === 'username' ? 'login-input-focused' : ''}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username"
                  required 
                  autoComplete="username"
                  style={{ boxShadow: focusedField === 'username' ? '4px 4px 0px #4F85AC' : '3px 3px 0px #1A1A1A' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-textMain mb-2 uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className={`w-full pl-10 pr-12 py-3 border-2 border-borderColor bg-bgPanel text-[15px] text-textMain focus:outline-none transition-all ${focusedField === 'password' ? 'login-input-focused' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  style={{ boxShadow: focusedField === 'password' ? '4px 4px 0px #4F85AC' : '3px 3px 0px #1A1A1A' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary mt-1 flex justify-center items-center gap-2 h-[48px] text-[15px]"
              disabled={loading}
            >
              {loading ? (
                <div className="loader border-t-white"></div>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {oauthEnabled && (
            <>
              {/* Divider */}
              <div className="flex items-center my-7">
                <div className="flex-1 border-t-2 border-borderColor/20"></div>
                <span className="px-4 text-xs font-bold text-textMuted uppercase tracking-widest">or</span>
                <div className="flex-1 border-t-2 border-borderColor/20"></div>
              </div>

              {/* SSO Button */}
              <button 
                type="button" 
                onClick={() => {
                  const apiBase = getApiBaseUrl();
                  const currentOrigin = window.location.origin;
                  window.location.href = `${apiBase}/oauth/login?origin=${encodeURIComponent(currentOrigin)}`;
                }}
                className="sso-btn w-full flex justify-center items-center gap-2.5 h-[48px] border-2 border-borderColor bg-bgPanel text-[15px] font-bold text-textMain hover:bg-bgHover"
              >
                <Shield size={18} />
                Continue with SSO
              </button>
            </>
          )}

          {/* Footer text */}
          <p className="text-center text-xs text-textMuted mt-8" style={{ fontFamily: 'Inter, sans-serif' }}>
            Powered by <span className="font-bold text-primary">CocoIndex</span> · Semantic Code Intelligence
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

