import { CssTheme } from '../types';

export const CSS_THEMES: Record<CssTheme, {
  name: string;
  description: string;
  containerStyle: string;
  mainTitleStyle: string;
  h3Style: string;
  pStyle: string;
  imageWrapperStyle: string;
  imgStyle: string;
}> = {
  modern: {
    name: '모던 카드',
    description: '카드형 박스 + 그림자 효과',
    mainTitleStyle: 'font-size:32px; font-weight:900; color:#1a1a1a; margin-bottom:30px; padding-bottom:20px; border-bottom:1px solid #ddd; line-height:1.4;',
    containerStyle: 'max-width:800px; margin:0 auto; padding:40px; background:#fff; font-family:Malgun Gothic,sans-serif; line-height:1.9;',
    h3Style: 'padding-left:15px; border-left:4px solid #787fff;',
    pStyle: 'font-size:17px; color:#333; margin-bottom:25px; line-height:1.85;',
    imageWrapperStyle: 'margin:40px 0; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1);'
  },
  
  premium: {
    name: '프리미엄 라인',
    description: '얇은 테두리 + 넓은 여백',
    mainTitleStyle: 'font-size:34px; font-weight:700; color:#2c2c2c; margin-bottom:35px; padding-bottom:25px; border-bottom:2px solid #787fff; line-height:1.4;',
    containerStyle: 'max-width:850px; margin:0 auto; padding:60px; background:#fefefe; font-family:Malgun Gothic,sans-serif; line-height:2.0; border:1px solid #e5e5e5;',
    h3Style: 'padding-left:15px; border-left:4px solid #787fff;',
    pStyle: 'font-size:17px; color:#444; margin-bottom:30px; line-height:2.0; letter-spacing:-0.3px;',
    imageWrapperStyle: 'margin:50px 0; padding:20px; background:#fafafa; text-align:center;',
    imgStyle: 'max-width:100%; border:1px solid #ddd;'
  },
  
  minimal: {
    name: '미니멀 클린',
    description: '여백 중심 + 최소 장식',
    mainTitleStyle: 'font-size:30px; font-weight:700; color:#222; margin-bottom:25px; padding-bottom:18px; border-bottom:1px solid #ddd; line-height:1.4;',
    containerStyle: 'max-width:750px; margin:0 auto; padding:30px 20px; background:#fff; font-family:Malgun Gothic,sans-serif; line-height:1.95;',
    h3Style: 'padding-left:15px; border-left:4px solid #787fff;',
    pStyle: 'font-size:16px; color:#555; margin-bottom:22px; line-height:1.9;',
    imageWrapperStyle: 'margin:45px 0; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:4px;'
  },
  
  warm: {
    name: '따뜻한 박스',
    description: '둥근 박스 + 부드러운 배경',
    mainTitleStyle: 'font-size:32px; font-weight:800; color:#c46d3d; margin-bottom:30px; padding:20px 25px; background:#fff; border-radius:15px; line-height:1.4; box-shadow:0 2px 10px rgba(196,109,61,0.1);',
    containerStyle: 'max-width:820px; margin:0 auto; padding:45px 35px; background:#fffbf5; font-family:Malgun Gothic,sans-serif; line-height:1.9; border-radius:20px;',
    h3Style: 'padding-left:15px; border-left:4px solid #787fff;',
    pStyle: 'font-size:17px; color:#4a4a4a; margin-bottom:26px; line-height:1.9;',
    imageWrapperStyle: 'margin:38px 0; padding:15px; background:#fff; border-radius:15px; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:12px;'
  },
  
  professional: {
    name: '의료 전문',
    description: '신뢰감 있는 블루 포인트',
    mainTitleStyle: 'font-size:32px; font-weight:800; color:#0066cc; margin-bottom:30px; padding:20px 25px; background:#fff; border-left:6px solid #787fff; border-radius:8px; line-height:1.4;',
    containerStyle: 'max-width:880px; margin:0 auto; padding:50px 40px; background:#f7f9fb; font-family:Malgun Gothic,sans-serif; line-height:1.95; border-top:4px solid #787fff;',
    h3Style: 'padding-left:15px; border-left:4px solid #787fff;',
    pStyle: 'font-size:17px; color:#3a3a3a; margin-bottom:28px; line-height:1.95; background:#fff; padding:20px; border-radius:8px;',
    imageWrapperStyle: 'margin:42px 0; padding:25px; background:#fff; border-radius:10px; text-align:center; border:2px solid #e3ecf5;',
    imgStyle: 'max-width:100%; border-radius:8px;'
  }
};

export function applyThemeToHtml(html: string, theme: CssTheme): string {
  const t = CSS_THEMES[theme];
  
  let result = html;
  
  // 🎨 컨테이너가 없으면 자동으로 감싸기
  if (!result.includes('class="naver-post-container"')) {
    result = `<div class="naver-post-container" style="${t.containerStyle}">${result}</div>`;
  } else {
    // 컨테이너 스타일 적용 (class 기반)
    result = result.replace(
      /<div class="naver-post-container"[^>]*>/g,
      `<div class="naver-post-container" style="${t.containerStyle}">`
    );
  }
  
  // 메인 제목 (h2.main-title) 스타일 적용
  result = result.replace(
    /<h2 class="main-title"[^>]*>/g,
    `<h2 class="main-title" style="${t.mainTitleStyle}">`
  );
  
  // 🔥 h2 태그 (main-title 클래스 없는 경우) 스타일 적용
  result = result.replace(
    /<h2(?![^>]*class="main-title")([^>]*)>/g,
    (match, attrs) => {
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      return `<h2${cleaned} style="${t.mainTitleStyle}">`;
    }
  );
  
  // h3 태그 스타일 적용 (기존 style 속성 제거 후 새로 적용)
  const h3Matches = result.match(/<h3(\s+[^>]*)?>/g);
  console.log('🔍 [cssThemes] h3 태그 매칭:', h3Matches?.length || 0, '개', h3Matches);
  
  result = result.replace(
    /<h3(\s+[^>]*)?>/g,
    (match, attrs) => {
      // 기존 style 속성 제거
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      const newTag = `<h3${cleaned} style="${t.h3Style}">`;
      console.log('✅ [cssThemes] h3 변환:', match, '→', newTag);
      return newTag;
    }
  );
  
  // p 태그 스타일 적용 (기존 style 속성 제거 후 새로 적용)
  result = result.replace(
    /<p(\s+[^>]*)?>/g,
    (match, attrs) => {
      // 기존 style 속성 제거
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      return `<p${cleaned} style="${t.pStyle}">`;
    }
  );
  
  // 🔥 ul, ol 리스트 스타일 추가 (네이버 블로그 최적화)
  result = result.replace(
    /<ul(\s+[^>]*)?>/g,
    (match, attrs) => {
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      return `<ul${cleaned} style="margin:20px 0; padding-left:30px; line-height:1.9;">`;
    }
  );
  
  result = result.replace(
    /<ol(\s+[^>]*)?>/g,
    (match, attrs) => {
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      return `<ol${cleaned} style="margin:20px 0; padding-left:30px; line-height:1.9;">`;
    }
  );
  
  result = result.replace(
    /<li(\s+[^>]*)?>/g,
    (match, attrs) => {
      const cleaned = attrs ? attrs.replace(/\s*style="[^"]*"/gi, '') : '';
      return `<li${cleaned} style="font-size:17px; color:#333; margin-bottom:12px; line-height:1.85;">`;
    }
  );
  
  // 이미지 wrapper 스타일 적용
  result = result.replace(
    /<div class="content-image-wrapper"[^>]*>/g,
    `<div class="content-image-wrapper" style="${t.imageWrapperStyle}">`
  );
  
  // img 태그 스타일 적용 (기존 style 병합)
  result = result.replace(
    /<img([^>]*)>/g,
    (match, attrs) => {
      // 기존 style 제거하고 새로 적용
      const cleaned = attrs.replace(/\s*style="[^"]*"/gi, '');
      return `<img${cleaned} style="${t.imgStyle}">`;
    }
  );
  
  return result;
}
