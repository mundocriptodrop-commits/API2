import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, HelpCircle, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Left Side - Logo and Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-50 via-white to-cyan-50 relative overflow-hidden items-center justify-center">
        {/* Animated gradient orbs - Enhanced */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gradient-to-tl from-blue-500/25 to-cyan-500/25 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
        </div>

        {/* Geometric shapes background */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 border-2 border-blue-300/20 rounded-3xl rotate-12 animate-spin-slow" />
          <div className="absolute bottom-32 right-32 w-24 h-24 border-2 border-cyan-300/20 rounded-2xl -rotate-12 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '25s' }} />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 border-2 border-blue-400/30 rounded-xl rotate-45 animate-pulse" />
        </div>

        {/* Decorative curved lines with animation */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 0.2 }} />
            </linearGradient>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 0.15 }} />
              <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.15 }} />
            </linearGradient>
            <linearGradient id="gradient3" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#0ea5e9', stopOpacity: 0.18 }} />
              <stop offset="100%" style={{ stopColor: '#2563eb', stopOpacity: 0.18 }} />
            </linearGradient>
          </defs>
          <path
            d="M -100,200 Q 150,50 350,120 T 700,180"
            stroke="url(#gradient1)"
            strokeWidth="4"
            fill="none"
            className="animate-draw"
          />
          <path
            d="M -50,280 Q 200,120 400,190 T 750,260"
            stroke="url(#gradient2)"
            strokeWidth="3"
            fill="none"
            className="animate-draw"
            style={{ animationDelay: '0.3s' }}
          />
          <path
            d="M 0,360 Q 250,200 450,270 T 800,340"
            stroke="url(#gradient3)"
            strokeWidth="3"
            fill="none"
            className="animate-draw"
            style={{ animationDelay: '0.6s' }}
          />
        </svg>

        {/* Floating particles - Enhanced */}
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-blue-400/40 rounded-full animate-float-particle"
              style={{
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${5 + Math.random() * 5}s`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Logo container with enhanced effects */}
        <div className="relative z-10 flex flex-col items-center justify-center animate-fade-in px-8">
          {/* Decorative rings around logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[500px] h-[500px] border border-blue-300/20 rounded-full animate-ping-slow" />
            <div className="absolute w-[450px] h-[450px] border border-cyan-300/20 rounded-full animate-ping-slow" style={{ animationDelay: '1s' }} />
            <div className="absolute w-[400px] h-[400px] border border-blue-400/20 rounded-full animate-ping-slow" style={{ animationDelay: '2s' }} />
          </div>

          {/* Logo with enhanced animation */}
          <div className="relative">
            {/* Glow effect behind logo */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-600/20 blur-3xl rounded-full animate-pulse-glow" />

            {/* Additional shadow layers */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/10 via-cyan-400/10 to-blue-500/10 blur-2xl rounded-full" />

            {/* Logo */}
            <div className="relative">
              <img
                src="/Logo_login.png"
                alt="EVA.Send Logo"
                className="w-[340px] h-auto object-contain relative z-10 drop-shadow-2xl transform transition-all duration-700 hover:scale-105 hover:drop-shadow-[0_0_40px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>

          {/* Decorative text below logo */}
          <div className="mt-12 text-center space-y-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-gray-600 text-sm font-medium">
              WhatsApp Management Platform
            </p>
            <div className="flex items-center justify-center space-x-2 mt-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Sistema Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 lg:from-blue-600 lg:via-blue-700 lg:to-blue-900 p-6 sm:p-8 relative overflow-hidden">
        {/* Mobile Background - Same as left side */}
        <div className="lg:hidden absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-blue-500/25 to-cyan-500/25 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
        </div>

        {/* Mobile Geometric shapes */}
        <div className="lg:hidden absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 border-2 border-blue-300/20 rounded-3xl rotate-12 animate-spin-slow" />
          <div className="absolute bottom-20 right-10 w-16 h-16 border-2 border-cyan-300/20 rounded-2xl -rotate-12 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '25s' }} />
        </div>

        {/* Mobile Decorative curved lines */}
        <svg className="lg:hidden absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gradient-mobile-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 0.2 }} />
            </linearGradient>
            <linearGradient id="gradient-mobile-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 0.15 }} />
              <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.15 }} />
            </linearGradient>
          </defs>
          <path
            d="M -50,150 Q 100,50 250,100 T 450,140"
            stroke="url(#gradient-mobile-1)"
            strokeWidth="3"
            fill="none"
            className="animate-draw"
          />
          <path
            d="M 0,220 Q 120,100 270,150 T 500,200"
            stroke="url(#gradient-mobile-2)"
            strokeWidth="2"
            fill="none"
            className="animate-draw"
            style={{ animationDelay: '0.3s' }}
          />
        </svg>

        {/* Mobile Floating particles */}
        <div className="lg:hidden absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-blue-400/40 rounded-full animate-float-particle"
              style={{
                width: `${Math.random() * 6 + 3}px`,
                height: `${Math.random() * 6 + 3}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${5 + Math.random() * 5}s`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Desktop Animated background pattern */}
        <div className="hidden lg:block absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }} />
        </div>

        {/* Desktop Floating gradient orbs */}
        <div className="hidden lg:block absolute top-20 right-20 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="hidden lg:block absolute bottom-20 left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8 animate-fade-in">
            {/* Decorative rings around mobile logo */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center -z-10">
                <div className="w-[280px] h-[280px] border border-blue-300/20 rounded-full animate-ping-slow" />
                <div className="absolute w-[240px] h-[240px] border border-cyan-300/20 rounded-full animate-ping-slow" style={{ animationDelay: '1s' }} />
              </div>

              {/* Mobile Logo with glow */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-600/20 blur-3xl rounded-full animate-pulse-glow" />
                <img
                  src="/Logo_login.png"
                  alt="EVA.Send Logo"
                  className="w-52 sm:w-64 h-auto object-contain drop-shadow-2xl relative z-10"
                />
              </div>
            </div>

            {/* Mobile subtitle */}
            <div className="mt-6 text-center space-y-1">
              <p className="text-gray-700 text-xs sm:text-sm font-medium">
                WhatsApp Management Platform
              </p>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] sm:text-xs text-gray-600">Sistema Online</span>
              </div>
            </div>
          </div>

          {/* Login Card with enhanced design */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 animate-slide-up">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Bem-vindo</h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                Informe suas credenciais para acessar a aplicação
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input with enhanced focus effect */}
              <div className="relative group">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Login
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full px-4 py-3 pr-20 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 rounded-xl focus:outline-none transition-all duration-300 text-gray-700 placeholder-gray-400 ${
                      focusedField === 'email'
                        ? 'border-blue-500 shadow-lg shadow-blue-200/50 scale-[1.02]'
                        : 'border-blue-200 hover:border-blue-300'
                    }`}
                    placeholder="seu@email.com"
                    required
                  />
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2 transition-all duration-300 ${
                    focusedField === 'email' ? 'scale-110' : ''
                  }`}>
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      focusedField === 'email' ? 'bg-blue-100' : 'bg-transparent'
                    }`}>
                      <User className={`w-5 h-5 transition-colors ${
                        focusedField === 'email' ? 'text-blue-600' : 'text-blue-500'
                      }`} />
                    </div>
                    <button
                      type="button"
                      className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Ajuda"
                    >
                      <HelpCircle className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Input with enhanced focus effect */}
              <div className="relative group">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full px-4 py-3 pr-14 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 rounded-xl focus:outline-none transition-all duration-300 text-gray-700 placeholder-gray-400 ${
                      focusedField === 'password'
                        ? 'border-blue-500 shadow-lg shadow-blue-200/50 scale-[1.02]'
                        : 'border-blue-200 hover:border-blue-300'
                    }`}
                    placeholder="••••••••"
                    required
                  />
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-300 ${
                    focusedField === 'password' ? 'scale-110' : ''
                  }`}>
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      focusedField === 'password' ? 'bg-blue-100' : 'bg-transparent'
                    }`}>
                      <Lock className={`w-5 h-5 transition-colors ${
                        focusedField === 'password' ? 'text-blue-600' : 'text-blue-500'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Error Message */}
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2 animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Enhanced Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                <span className="relative flex items-center justify-center space-x-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </span>
              </button>
            </form>

            {/* Additional links */}
            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>
          </div>

          {/* Enhanced Footer */}
          <div className="mt-8 text-center text-white space-y-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <p className="text-blue-100 text-sm font-medium">
                API Online
              </p>
            </div>
            <p className="text-xs text-blue-200 opacity-75">
              Versão 1.0.1 • EVA.Send
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
