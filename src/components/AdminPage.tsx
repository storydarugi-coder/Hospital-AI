import React, { useState, useEffect } from 'react';

const AdminPage: React.FC = () => {
  const [configValues, setConfigValues] = useState({
    geminiKey: '',
    naverClientId: '',
    naverClientSecret: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const localGemini = localStorage.getItem('GEMINI_API_KEY');
    const localNaverId = localStorage.getItem('NAVER_CLIENT_ID');
    const localNaverSecret = localStorage.getItem('NAVER_CLIENT_SECRET');

    setConfigValues({
      geminiKey: localGemini || '',
      naverClientId: localNaverId || '',
      naverClientSecret: localNaverSecret || ''
    });
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('GEMINI_API_KEY', configValues.geminiKey);
    localStorage.setItem('NAVER_CLIENT_ID', configValues.naverClientId);
    localStorage.setItem('NAVER_CLIENT_SECRET', configValues.naverClientSecret);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearConfig = () => {
    if (confirm('모든 API 키를 삭제하시겠습니까?')) {
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('NAVER_CLIENT_ID');
      localStorage.removeItem('NAVER_CLIENT_SECRET');
      setConfigValues({
        geminiKey: '',
        naverClientId: '',
        naverClientSecret: ''
      });
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl shadow-2xl shadow-emerald-500/30 mb-6">
            <span className="text-4xl">⚙️</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Admin Settings</h1>
          <p className="text-slate-400 font-medium">HospitalAI API 설정</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border border-white/10">
          
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${configValues.geminiKey ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-bold text-slate-300">
                {configValues.geminiKey ? 'API 연결됨' : 'API 미연결'}
              </span>
            </div>
            <a 
              href="#app" 
              className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2"
            >
              앱으로 이동 →
            </a>
          </div>

          <div className="space-y-6">
            {/* Gemini API Key */}
            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 rounded-2xl border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-black text-blue-300 uppercase tracking-widest">
                  Google Gemini API
                </label>
                <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded-full">필수</span>
              </div>
              <input 
                type="password" 
                value={configValues.geminiKey}
                onChange={(e) => setConfigValues({...configValues, geminiKey: e.target.value})}
                placeholder="AI Studio에서 발급받은 API Key"
                className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
              />
              {configValues.geminiKey && (
                <p className="text-[11px] text-blue-400 mt-2 font-mono">
                  현재 키: {maskApiKey(configValues.geminiKey)}
                </p>
              )}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-400 mt-2 font-bold hover:text-blue-300"
              >
                🔗 Google AI Studio에서 키 발급받기
              </a>
            </div>

            {/* Naver API */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/20">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-black text-green-300 uppercase tracking-widest">
                  Naver Developers API
                </label>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-500/20 px-2 py-1 rounded-full">선택</span>
              </div>
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={configValues.naverClientId}
                  onChange={(e) => setConfigValues({...configValues, naverClientId: e.target.value})}
                  placeholder="Client ID"
                  className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none transition-colors"
                />
                <input 
                  type="password" 
                  value={configValues.naverClientSecret}
                  onChange={(e) => setConfigValues({...configValues, naverClientSecret: e.target.value})}
                  placeholder="Client Secret"
                  className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-mono text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-green-400/70 mt-2 font-medium">
                ※ 추후 정확한 검색량 조회를 위해 사용됩니다.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <button 
              onClick={handleClearConfig} 
              className="flex-1 py-4 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30"
            >
              🗑️ 전체 삭제
            </button>
            <button 
              onClick={handleSaveConfig} 
              className={`flex-1 py-4 font-bold rounded-xl transition-all shadow-lg ${
                saved 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-emerald-500/30 hover:shadow-xl'
              }`}
            >
              {saved ? '✅ 저장됨!' : '💾 저장하기'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm font-medium">
            API 키는 브라우저의 LocalStorage에 저장됩니다.
          </p>
          <p className="text-slate-600 text-xs mt-1">
            서버에 전송되지 않으며, 브라우저에서만 사용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
