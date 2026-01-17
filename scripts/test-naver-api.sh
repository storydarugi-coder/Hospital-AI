#!/bin/bash

# 네이버 API 엔드포인트 테스트 스크립트

echo "🧪 네이버 API 엔드포인트 테스트"
echo ""

# 테스트할 URL 목록
URLS=(
  "https://hospital-ai.pages.dev/api/naver-news?query=병원&display=3"
  "https://storydarugi-coder-hospital-ai.pages.dev/api/naver-news?query=병원&display=3"
)

for URL in "${URLS[@]}"; do
  echo "───────────────────────────────────────────"
  echo "📍 테스트 URL: $URL"
  echo ""
  
  # HTTP 상태 코드 확인
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  echo "HTTP Status: $HTTP_CODE"
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 성공!"
    echo ""
    echo "응답 내용:"
    curl -s "$URL" | jq '.' 2>/dev/null || curl -s "$URL"
    echo ""
    echo "🎉 네이버 API가 정상 작동합니다!"
    exit 0
  elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ 서버 오류 (500)"
    echo ""
    echo "응답 내용:"
    curl -s "$URL" | jq '.' 2>/dev/null || curl -s "$URL"
    echo ""
    echo "⚠️ 환경 변수가 설정되지 않았을 수 있습니다."
  elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ 엔드포인트를 찾을 수 없음 (404)"
    echo "다른 URL을 시도합니다..."
  else
    echo "⚠️ 예상치 못한 응답: $HTTP_CODE"
  fi
  echo ""
done

echo "───────────────────────────────────────────"
echo "❌ 모든 URL 테스트 실패"
echo ""
echo "📝 해결 방법:"
echo "1. Cloudflare Pages 대시보드에서 환경 변수 확인"
echo "   https://dash.cloudflare.com/"
echo ""
echo "2. 환경 변수 설정 (아직 안 했다면):"
echo "   - NAVER_CLIENT_ID: OWaRJ7Eu9DxITLQj3yxx"
echo "   - NAVER_CLIENT_SECRET: jprWSZyNyK"
echo ""
echo "3. 재배포 필요 (환경 변수는 배포 후 적용)"
echo "   git commit --allow-empty -m 'chore: trigger redeploy'"
echo "   git push"
echo ""
echo "4. 또는 자동 설정 스크립트 실행:"
echo "   bash scripts/setup-naver-api.sh"
