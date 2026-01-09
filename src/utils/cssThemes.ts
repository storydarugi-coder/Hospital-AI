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
  ulStyle?: string;
  liStyle?: string;
}> = {
  modern: {
    name: '모던 카드',
    description: '카드형 박스 + 그림자 효과',
    mainTitleStyle: 'font-size:32px; font-weight:900; color:#1a1a1a; margin-bottom:30px; padding-bottom:20px; border-bottom:3px solid #4a90e2; line-height:1.4;',
    containerStyle: 'max-width:800px; margin:0 auto; padding:40px; background:#fff; font-family:Malgun Gothic,sans-serif; line-height:1.9;',
    h3Style: 'font-size:26px; font-weight:800; color:#1a1a1a; margin:50px 0 20px; padding:15px 20px; background:#f8f9fa; border-left:5px solid #4a90e2; border-radius:8px;',
    pStyle: 'font-size:17px; color:#333; margin-bottom:25px; line-height:1.85;',
    imageWrapperStyle: 'margin:40px 0; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1);',
    ulStyle: 'margin:30px 0; padding-left:0; list-style:none;',
    liStyle: 'margin:15px 0; padding:18px 20px; background:#f8f9fa; border-left:4px solid #4a90e2; border-radius:8px; font-size:16px; line-height:1.7;'
  },
  
  premium: {
    name: '프리미엄 라인',
    description: '얇은 테두리 + 넓은 여백',
    mainTitleStyle: 'font-size:34px; font-weight:700; color:#2c2c2c; margin-bottom:35px; padding-bottom:25px; border-bottom:2px solid #8b7ec7; line-height:1.4;',
    containerStyle: 'max-width:850px; margin:0 auto; padding:60px; background:#fefefe; font-family:Malgun Gothic,sans-serif; line-height:2.0; border:1px solid #e5e5e5;',
    h3Style: 'font-size:28px; font-weight:700; color:#2c2c2c; margin:60px 0 25px; padding-bottom:15px; border-bottom:2px solid #8b7ec7;',
    pStyle: 'font-size:17px; color:#444; margin-bottom:30px; line-height:2.0; letter-spacing:-0.3px;',
    imageWrapperStyle: 'margin:50px 0; padding:20px; background:#fafafa; text-align:center;',
    imgStyle: 'max-width:100%; border:1px solid #ddd;',
    ulStyle: 'margin:35px 0; padding-left:0; list-style:none;',
    liStyle: 'margin:18px 0; padding:20px 25px; border:1px solid #e0e0e0; border-radius:4px; font-size:16px; line-height:1.8;'
  },
  
  minimal: {
    name: '미니멀 클린',
    description: '여백 중심 + 최소 장식',
    mainTitleStyle: 'font-size:30px; font-weight:700; color:#222; margin-bottom:25px; padding-bottom:18px; border-bottom:1px solid #ddd; line-height:1.4;',
    containerStyle: 'max-width:750px; margin:0 auto; padding:30px 20px; background:#fff; font-family:Malgun Gothic,sans-serif; line-height:1.95;',
    h3Style: 'font-size:24px; font-weight:700; color:#222; margin:55px 0 18px; padding:0;',
    pStyle: 'font-size:16px; color:#555; margin-bottom:22px; line-height:1.9;',
    imageWrapperStyle: 'margin:45px 0; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:4px;',
    ulStyle: 'margin:28px 0 28px 20px; padding-left:0; list-style:disc;',
    liStyle: 'margin:12px 0; font-size:16px; line-height:1.75; color:#444;'
  },
  
  warm: {
    name: '따뜻한 박스',
    description: '둥근 박스 + 부드러운 배경',
    mainTitleStyle: 'font-size:32px; font-weight:800; color:#c46d3d; margin-bottom:30px; padding:20px 25px; background:#fff; border-radius:15px; line-height:1.4; box-shadow:0 2px 10px rgba(196,109,61,0.1);',
    containerStyle: 'max-width:820px; margin:0 auto; padding:45px 35px; background:#fffbf5; font-family:Malgun Gothic,sans-serif; line-height:1.9; border-radius:20px;',
    h3Style: 'font-size:26px; font-weight:800; color:#c46d3d; margin:45px 0 22px; padding:18px 24px; background:#fff; border-radius:15px; box-shadow:0 2px 10px rgba(196,109,61,0.1);',
    pStyle: 'font-size:17px; color:#4a4a4a; margin-bottom:26px; line-height:1.9;',
    imageWrapperStyle: 'margin:38px 0; padding:15px; background:#fff; border-radius:15px; text-align:center;',
    imgStyle: 'max-width:100%; border-radius:12px;',
    ulStyle: 'margin:32px 0; padding-left:0; list-style:none;',
    liStyle: 'margin:16px 0; padding:16px 22px; background:#fff; border-radius:12px; font-size:16px; line-height:1.75; box-shadow:0 1px 5px rgba(0,0,0,0.05);'
  },
  
  professional: {
    name: '의료 전문',
    description: '신뢰감 있는 블루 포인트',
    mainTitleStyle: 'font-size:32px; font-weight:800; color:#0066cc; margin-bottom:30px; padding:20px 25px; background:#fff; border-left:6px solid #0066cc; border-radius:8px; line-height:1.4;',
    containerStyle: 'max-width:880px; margin:0 auto; padding:50px 40px; background:#f7f9fb; font-family:Malgun Gothic,sans-serif; line-height:1.95; border-top:4px solid #0066cc;',
    h3Style: 'font-size:25px; font-weight:800; color:#0066cc; margin:50px 0 20px; padding:16px 22px; background:#fff; border-left:6px solid #0066cc; border-radius:6px;',
    pStyle: 'font-size:17px; color:#3a3a3a; margin-bottom:28px; line-height:1.95; background:#fff; padding:20px; border-radius:8px;',
    imageWrapperStyle: 'margin:42px 0; padding:25px; background:#fff; border-radius:10px; text-align:center; border:2px solid #e3ecf5;',
    imgStyle: 'max-width:100%; border-radius:8px;',
    ulStyle: 'margin:35px 0; padding-left:0; list-style:none;',
    liStyle: 'margin:18px 0; padding:20px 24px; background:#fff; border-left:5px solid #0066cc; border-radius:8px; font-size:16px; line-height:1.8; box-shadow:0 2px 8px rgba(0,102,204,0.08);'
  }
};

export function applyThemeToHtml(html: string, theme: CssTheme): string {
  const t = CSS_THEMES[theme];
  
  let result = html;
  
  result = result.replace(
    /<div class="naver-post-container"[^>]*>/g,
    `<div style="${t.containerStyle}">`
  );
  
  // 메인 제목 (h2.main-title) 스타일 적용
  result = result.replace(
    /<h2 class="main-title"[^>]*>/g,
    `<h2 style="${t.mainTitleStyle}">`
  );
  
  result = result.replace(
    /<h3[^>]*>/g,
    `<h3 style="${t.h3Style}">`
  );
  
  result = result.replace(
    /<p[^>]*>/g,
    `<p style="${t.pStyle}">`
  );
  
  result = result.replace(
    /<div class="content-image-wrapper"[^>]*>/g,
    `<div style="${t.imageWrapperStyle}">`
  );
  
  result = result.replace(
    /<img([^>]*)>/g,
    `<img style="${t.imgStyle}" $1>`
  );
  
  if (t.ulStyle) {
    result = result.replace(
      /<ul[^>]*>/g,
      `<ul style="${t.ulStyle}">`
    );
  }
  
  if (t.liStyle) {
    result = result.replace(
      /<li[^>]*>/g,
      `<li style="${t.liStyle}">`
    );
  }
  
  return result;
}
