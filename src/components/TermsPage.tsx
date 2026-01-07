import React from 'react';

interface TermsPageProps {
  onClose: () => void;
}

const TermsPage: React.FC<TermsPageProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">📋 이용약관</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6 text-sm text-slate-700 leading-relaxed">
          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제1조 (목적)</h3>
            <p>이 약관은 미쁘다(이하 "회사")가 운영하는 HospitalAI 서비스(이하 "서비스")의 이용조건 및 절차, 회사와 이용자의 권리, 의무, 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제2조 (정의)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>"서비스"란 회사가 제공하는 AI 기반 병원 콘텐츠 생성 서비스를 말합니다.</li>
              <li>"이용자"란 서비스에 접속하여 이 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li>"회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며, 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
              <li>"콘텐츠"란 서비스를 통해 생성되는 블로그 글, 카드뉴스, 보도자료, 이미지 등을 말합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제3조 (약관의 효력 및 변경)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 이 약관을 변경할 수 있습니다.</li>
              <li>변경된 약관은 공지사항을 통해 공지함으로써 효력이 발생합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제4조 (서비스의 제공)</h3>
            <p className="mb-2">회사는 다음과 같은 서비스를 제공합니다:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>AI 기반 병원 블로그 글 생성</li>
              <li>AI 기반 카드뉴스 생성</li>
              <li>AI 기반 보도자료 생성</li>
              <li>AI 이미지 생성</li>
              <li>기타 회사가 정하는 서비스</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제5조 (이용요금)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>서비스 이용요금은 회사가 정한 요금정책에 따릅니다.</li>
              <li>유료 서비스의 이용요금은 서비스 내 안내 페이지에 게시합니다.</li>
              <li>이용권의 유효기간은 결제일로부터 90일입니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제6조 (환불 규정)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>미사용 시:</strong> 결제일로부터 7일 이내 전액 환불</li>
              <li><strong>사용 시:</strong> 사용 횟수를 제외한 잔여분 비례 환불</li>
              <li>환불 요청은 이메일(story.darugi@gmail.com)로 접수해주세요.</li>
              <li>환불은 요청일로부터 영업일 기준 3~5일 내에 처리됩니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제7조 (이용자의 의무)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>이용자는 서비스 이용 시 관련 법령, 이 약관, 서비스 이용안내 등을 준수해야 합니다.</li>
              <li>이용자는 생성된 콘텐츠의 의료광고법 준수 여부를 최종 확인할 책임이 있습니다.</li>
              <li>이용자는 타인의 개인정보를 무단으로 수집, 이용하거나 서비스를 부정하게 이용해서는 안 됩니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제8조 (콘텐츠의 저작권)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>서비스를 통해 생성된 콘텐츠의 저작권은 이용자에게 귀속됩니다.</li>
              <li>이용자는 생성된 콘텐츠를 자유롭게 사용, 수정, 배포할 수 있습니다.</li>
              <li>단, 서비스의 기술적 구조 및 AI 모델에 대한 권리는 회사에 귀속됩니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제9조 (면책조항)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>회사는 천재지변 또는 이에 준하는 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
              <li>회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.</li>
              <li>AI가 생성한 콘텐츠의 의료광고법 위반 여부에 대한 최종 책임은 이용자에게 있습니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-900 mb-3">제10조 (분쟁해결)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>회사와 이용자 간에 발생한 분쟁에 관한 소송은 서울중앙지방법원을 관할법원으로 합니다.</li>
              <li>회사와 이용자 간에 제기된 소송에는 대한민국 법을 적용합니다.</li>
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl">
            <p className="text-slate-600">
              <strong>부칙</strong><br />
              이 약관은 2025년 1월 1일부터 시행합니다.
            </p>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h4 className="font-bold text-emerald-800 mb-2">📞 문의처</h4>
            <p className="text-emerald-700">
              상호: 미쁘다 | 대표: 이지안<br />
              이메일: story.darugi@gmail.com<br />
              전화: 010-3238-8284<br />
              주소: 서울특별시 송파구 거마로 56 17층
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
