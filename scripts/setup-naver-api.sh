#!/bin/bash

# 네이버 API 키를 Cloudflare Pages에 설정하는 스크립트

echo "🔧 네이버 API 키를 Cloudflare Pages에 설정합니다..."
echo ""

# Cloudflare 로그인 확인
echo "1️⃣ Cloudflare 로그인 확인 중..."
npx wrangler whoami

if [ $? -ne 0 ]; then
  echo "❌ Cloudflare 로그인이 필요합니다."
  echo "다음 명령어로 로그인하세요:"
  echo "  npx wrangler login"
  exit 1
fi

echo "✅ Cloudflare 로그인 확인 완료"
echo ""

# 프로젝트 이름 확인
PROJECT_NAME="hospital-ai"
echo "2️⃣ 프로젝트: $PROJECT_NAME"
echo ""

# NAVER_CLIENT_ID 설정
echo "3️⃣ NAVER_CLIENT_ID 설정 중..."
echo "OWaRJ7Eu9DxITLQj3yxx" | npx wrangler pages secret put NAVER_CLIENT_ID --project-name=$PROJECT_NAME

if [ $? -eq 0 ]; then
  echo "✅ NAVER_CLIENT_ID 설정 완료"
else
  echo "❌ NAVER_CLIENT_ID 설정 실패"
  exit 1
fi

echo ""

# NAVER_CLIENT_SECRET 설정
echo "4️⃣ NAVER_CLIENT_SECRET 설정 중..."
echo "jprWSZyNyK" | npx wrangler pages secret put NAVER_CLIENT_SECRET --project-name=$PROJECT_NAME

if [ $? -eq 0 ]; then
  echo "✅ NAVER_CLIENT_SECRET 설정 완료"
else
  echo "❌ NAVER_CLIENT_SECRET 설정 실패"
  exit 1
fi

echo ""
echo "🎉 네이버 API 키 설정이 완료되었습니다!"
echo ""
echo "⚠️ 주의: 환경 변수는 다음 배포부터 적용됩니다."
echo "재배포가 필요합니다:"
echo "  git commit --allow-empty -m 'chore: trigger redeploy for env vars'"
echo "  git push"
echo ""
echo "또는 Cloudflare 대시보드에서 수동 재배포:"
echo "  https://dash.cloudflare.com/"
