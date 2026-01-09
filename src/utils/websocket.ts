/**
 * WebSocket 실시간 통신
 * - 진행 상황 실시간 업데이트
 * - 스트리밍 결과
 */

type MessageHandler = (data: any) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WebSocket] Parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] Closed');
      this.attemptReconnect(url);
    };
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(url), delay);
  }

  private handleMessage(data: any) {
    const { type, payload } = data;
    const handlers = this.handlers.get(type) || [];
    handlers.forEach(handler => handler(payload));
  }

  on(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || [];
    const filtered = handlers.filter(h => h !== handler);
    this.handlers.set(type, filtered);
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WebSocket] Not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  // 편의 메서드들
  onProgress(callback: (progress: number) => void) {
    this.on('progress', callback);
  }

  onChunk(callback: (chunk: string) => void) {
    this.on('chunk', callback);
  }

  onComplete(callback: (result: any) => void) {
    this.on('complete', callback);
  }

  onError(callback: (error: string) => void) {
    this.on('error', callback);
  }
}

export const wsManager = new WebSocketManager();
