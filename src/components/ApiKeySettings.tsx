import React, { useState, useEffect } from 'react';
import { saveApiKeys, getApiKeys, deleteApiKeys } from '../services/apiService';

interface ApiKeySettingsProps {
  onClose: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onClose }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const apiKeys = await getApiKeys();
      setHasGeminiKey(!!apiKeys.gemini);
      setHasOpenaiKey(!!apiKeys.openai);
      
      // 보안상 실제 키는 표시하지 않고 마스킹
      if (apiKeys.gemini) {
        setGeminiKey('••••••••••••••••');
      }
      if (apiKeys.openai) {
        setOpenaiKey('••••••••••••••••');
      }
    } catch (error) {
      console.error('API 키 로드 실패:', error);
    }
  };

  const handleSave = async () => {
    if (!geminiKey && !openaiKey) {
      setMessage({ type: 'error', text: '최소 하나의 API 키를 입력해주세요.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // 마스킹된 키가 아닐 때만 저장
      const geminiToSave = geminiKey && !geminiKey.includes('•') ? geminiKey : undefined;
      const openaiToSave = openaiKey && !openaiKey.includes('•') ? openaiKey : undefined;

      const result = await saveApiKeys(geminiToSave, openaiToSave);

      if (result.success) {
        setMessage({ type: 'success', text: 'API 키가 저장되었습니다!' });
        
        // 1.5초 후 자동으로 닫기 (페이지 새로고침 제거)
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.error || '저장 실패' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '저장 중 오류 발생' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: 'gemini' | 'openai') => {
    if (!confirm(`${type === 'gemini' ? 'Gemini' : 'OpenAI'} API 키를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteApiKeys(type);
      
      if (type === 'gemini') {
        setGeminiKey('');
        setHasGeminiKey(false);
      } else {
        setOpenaiKey('');
        setHasOpenaiKey(false);
      }
      
      setMessage({ type: 'success', text: 'API 키가 삭제되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'API 키 삭제 실패' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">⚙️ API 키 설정</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Gemini API Key */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              🤖 Gemini API Key <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {hasGeminiKey && (
                <button
                  onClick={() => handleDelete('gemini')}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                Gemini API 키 발급받기 →
              </a>
            </p>
          </div>

          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              🧠 OpenAI API Key <span className="text-slate-400">(선택사항)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {hasOpenaiKey && (
                <button
                  onClick={() => handleDelete('openai')}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                OpenAI API 키 발급받기 →
              </a>
            </p>
          </div>

          {/* 메시지 */}
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 안내사항</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• API 키는 서버에 암호화되어 저장됩니다.</li>
              <li>• Gemini API 키는 필수이며, OpenAI는 선택사항입니다.</li>
              <li>• 저장된 키는 브라우저를 닫아도 유지됩니다.</li>
              <li>• 키를 변경하려면 새 키를 입력하고 저장하세요.</li>
            </ul>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                isSaving
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
