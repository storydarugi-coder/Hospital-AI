#!/bin/bash

echo "🔍 Hospital-AI 배포 상태 확인"
echo "================================"
echo ""

# 1. Git 상태 확인
echo "1️⃣ Git 상태"
echo "functions 폴더 커밋 상태:"
git ls-files functions/ | wc -l
echo "파일 개수"
echo ""

# 2. functions/api/medical-law 확인
echo "2️⃣ Medical Law API 파일"
ls -lh functions/api/medical-law/
echo ""

# 3. wrangler.toml 확인
echo "3️⃣ Wrangler 설정"
cat wrangler.toml
echo ""

# 4. package.json 스크립트 확인
echo "4️⃣ 빌드 스크립트"
cat package.json | grep -A 3 '"scripts"'
echo ""

# 5. 프로덕션 API 테스트
echo "5️⃣ 프로덕션 API 테스트"
echo "Testing: https://story-darugi.com/api/medical-law/fetch"
curl -X POST https://story-darugi.com/api/medical-law/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=230993"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s -o /dev/null
echo ""

echo "================================"
echo "✅ 체크 완료!"
