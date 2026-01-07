import React from 'react';

interface PrivacyPageProps {
  onClose: () => void;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">🔒 개인정보처리방침</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6 text-sm text-slate-700 leading-relaxed">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="text-blue-800">
              미쁘다(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수하고 있습니다.
              회사는 개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며,
              개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제1조 (수집하는 개인정보 항목)</h3>
            <p className="mb-2">회사는 회원가입, 서비스 이용을 위해 아래와 같은 개인정보를 수집합니다.</p>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="font-bold text-slate-800 mb-2">필수항목</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>이메일 주소</li>
                <li>비밀번호</li>
                <li>서비스 이용 기록</li>
              </ul>
              <p className="font-bold text-slate-800 mt-4 mb-2">결제 시 추가 수집</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>결제 정보 (결제수단, 결제일시)</li>
                <li>환불 계좌 정보 (환불 요청 시)</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제2조 (개인정보의 수집 및 이용목적)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>회원 관리:</strong> 회원 가입의사 확인, 회원제 서비스 제공, 개인식별, 부정이용 방지</li>
              <li><strong>서비스 제공:</strong> 콘텐츠 생성, 서비스 이용 기록 관리</li>
              <li><strong>결제 처리:</strong> 유료 서비스 결제, 환불 처리</li>
              <li><strong>고객 지원:</strong> 문의 응대, 공지사항 전달</li>
              <li><strong>서비스 개선:</strong> 서비스 이용 통계 분석, 신규 서비스 개발</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제3조 (개인정보의 보유 및 이용기간)</h3>
            <p className="mb-2">회사는 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 아래와 같이 보관합니다.</p>
            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <p><strong>계약 또는 청약철회 등에 관한 기록:</strong> 5년 (전자상거래법)</p>
              <p><strong>대금결제 및 재화 등의 공급에 관한 기록:</strong> 5년 (전자상거래법)</p>
              <p><strong>소비자의 불만 또는 분쟁처리에 관한 기록:</strong> 3년 (전자상거래법)</p>
              <p><strong>웹사이트 방문기록:</strong> 3개월 (통신비밀보호법)</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제4조 (개인정보의 파기절차 및 방법)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>파기절차:</strong> 이용자가 회원가입 등을 위해 입력한 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</li>
              <li><strong>파기방법:</strong> 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제5조 (개인정보의 제3자 제공)</h3>
            <p>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제6조 (개인정보의 처리 위탁)</h3>
            <p className="mb-2">회사는 서비스 향상을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
            <div className="bg-slate-50 p-4 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-2">수탁업체</th>
                    <th className="text-left py-2">위탁업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-2">나이스페이먼츠</td>
                    <td className="py-2">결제 처리</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2">Supabase</td>
                    <td className="py-2">데이터 저장 및 관리</td>
                  </tr>
                  <tr>
                    <td className="py-2">Google (Gemini API)</td>
                    <td className="py-2">AI 콘텐츠 생성</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제7조 (이용자의 권리와 행사방법)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지 요구 등의 권리를 행사할 수 있습니다.</li>
              <li>권리 행사는 이메일(story.darugi@gmail.com)을 통해 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.</li>
              <li>이용자가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우, 회사는 정정 또는 삭제를 완료하기 전까지 당해 개인정보를 이용하거나 제공하지 않습니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제8조 (개인정보 보호책임자)</h3>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <p className="text-emerald-800">
                <strong>개인정보 보호책임자</strong><br />
                성명: 이지안<br />
                직책: 대표<br />
                연락처: 010-3238-8284<br />
                이메일: story.darugi@gmail.com
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제9조 (개인정보의 안전성 확보조치)</h3>
            <p className="mb-2">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>비밀번호 암호화:</strong> 이용자의 비밀번호는 암호화되어 저장 및 관리됩니다.</li>
              <li><strong>해킹 등에 대비한 기술적 대책:</strong> 보안 프로그램을 설치하고 주기적인 갱신·점검을 합니다.</li>
              <li><strong>접근통제:</strong> 개인정보에 대한 접근권한을 최소화하고 있습니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제10조 (개인정보처리방침 변경)</h3>
            <p>이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통해 고지할 것입니다.</p>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl">
            <p className="text-slate-600">
              <strong>부칙</strong><br />
              이 개인정보처리방침은 2025년 1월 1일부터 시행합니다.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-2">📞 개인정보 관련 문의</h4>
            <p className="text-blue-700">
              개인정보 관련 문의사항은 아래로 연락해 주세요.<br />
              이메일: story.darugi@gmail.com<br />
              전화: 010-3238-8284
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
