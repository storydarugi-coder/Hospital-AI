import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Tailwind CSS
import './index.css'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}

// Service Worker 등록 (PWA 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker 등록 성공:', registration.scope)
        
        // 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 새 버전 알림 (선택적)
                console.log('🔄 새 버전이 준비되었습니다. 새로고침하세요.')
              }
            })
          }
        })
      })
      .catch((error) => {
        console.warn('Service Worker 등록 실패:', error)
      })
  })
}
