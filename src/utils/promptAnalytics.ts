/**
 * 프롬프트 A/B 테스트 로깅 시스템
 * - AI 글쓰기 품질 추적
 * - 프롬프트 버전 비교
 * - 데이터 기반 개선
 */

export interface PromptAnalyticsData {
  // 메타데이터
  timestamp: string;
  sessionId: string;
  promptVersion: string; // 예: "v2.0_natural_writing"

  // 입력 정보
  category: string;
  topic: string;
  targetLength: number;
  imageCount: number;

  // 출력 품질
  actualLength: number;
  ai_smell_score: number;
  safety_score: number;
  fact_score: number;
  conversion_score: number;

  // 성능 지표
  generationTime: number; // milliseconds
  retryCount: number;
  errorOccurred: boolean;
  errorMessage?: string;

  // 사용자 행동
  wasEdited: boolean;
  wasSaved: boolean;
  editCount?: number;
}

export interface PromptVersionStats {
  version: string;
  totalGenerations: number;
  avgAiSmellScore: number;
  avgSafetyScore: number;
  avgFactScore: number;
  avgGenerationTime: number;
  successRate: number;
  editRate: number;
}

class PromptAnalytics {
  private logs: PromptAnalyticsData[] = [];
  private readonly STORAGE_KEY = 'prompt_analytics_logs';
  private readonly MAX_LOGS = 500;

  constructor() {
    this.loadLogs();
  }

  /**
   * 로그 기록
   */
  log(data: PromptAnalyticsData): void {
    this.logs.push(data);

    // 최대 로그 개수 유지
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    this.saveLogs();

    // 콘솔에도 중요 지표 출력
    console.log(`📊 [Prompt Analytics] ${data.promptVersion}`);
    console.log(`   🤖 AI Smell: ${data.ai_smell_score}/100`);
    console.log(`   🛡️ Safety: ${data.safety_score}/100`);
    console.log(`   📝 Length: ${data.actualLength}/${data.targetLength}`);
    console.log(`   ⏱️ Time: ${data.generationTime}ms`);
  }

  /**
   * 버전별 통계 조회
   */
  getVersionStats(version: string): PromptVersionStats | null {
    const versionLogs = this.logs.filter(log => log.promptVersion === version);

    if (versionLogs.length === 0) return null;

    const totalGenerations = versionLogs.length;
    const successLogs = versionLogs.filter(log => !log.errorOccurred);
    const editedLogs = versionLogs.filter(log => log.wasEdited);

    return {
      version,
      totalGenerations,
      avgAiSmellScore: this.average(successLogs.map(l => l.ai_smell_score)),
      avgSafetyScore: this.average(successLogs.map(l => l.safety_score)),
      avgFactScore: this.average(successLogs.map(l => l.fact_score)),
      avgGenerationTime: this.average(versionLogs.map(l => l.generationTime)),
      successRate: (successLogs.length / totalGenerations) * 100,
      editRate: (editedLogs.length / totalGenerations) * 100
    };
  }

  /**
   * 모든 버전 비교
   */
  compareVersions(): PromptVersionStats[] {
    const versions = [...new Set(this.logs.map(log => log.promptVersion))];
    return versions
      .map(v => this.getVersionStats(v))
      .filter((stats): stats is PromptVersionStats => stats !== null)
      .sort((a, b) => b.avgAiSmellScore - a.avgAiSmellScore);
  }

  /**
   * 최근 N개 로그 조회
   */
  getRecentLogs(count: number = 10): PromptAnalyticsData[] {
    return this.logs.slice(-count);
  }

  /**
   * CSV 내보내기 (데이터 분석용)
   */
  exportToCSV(): string {
    if (this.logs.length === 0) return '';

    const headers = Object.keys(this.logs[0]).join(',');
    const rows = this.logs.map(log =>
      Object.values(log).map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * 성능 트렌드 분석
   */
  getTrend(metric: keyof PromptAnalyticsData, windowSize: number = 50): number[] {
    const recentLogs = this.logs.slice(-windowSize);
    return recentLogs.map(log => log[metric] as number).filter(v => typeof v === 'number');
  }

  /**
   * 로그 초기화 (테스트용)
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  // Private helpers
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load analytics logs:', error);
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save analytics logs:', error);
    }
  }
}

// 싱글톤 인스턴스
export const promptAnalytics = new PromptAnalytics();

// 편의 함수
export function logPromptGeneration(data: Omit<PromptAnalyticsData, 'timestamp' | 'sessionId'>): void {
  const fullData: PromptAnalyticsData = {
    ...data,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId()
  };

  promptAnalytics.log(fullData);
}

// 세션 ID 생성/조회
function getSessionId(): string {
  const SESSION_KEY = 'analytics_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}
