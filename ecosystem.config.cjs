module.exports = {
  apps: [{
    name: 'hospital-ai',
    script: 'npx',
    args: 'wrangler pages dev ./dist --port 3000 --ip 0.0.0.0',
    cwd: '/home/user/webapp',
    env: {
      // GEMINI_API_KEY는 .dev.vars 파일에서 관리
      // .dev.vars 파일 예시:
      // GEMINI_API_KEY=your_api_key_here
    }
  }]
};
