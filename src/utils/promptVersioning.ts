/**
 * AI 프롬프트 버전 관리 & A/B 테스트
 */

interface PromptVersion {
  id: string;
  version: string;
  prompt: string;
  createdAt: number;
  performance: {
    avgQualityScore: number;
    userSatisfaction: number;
    usageCount: number;
  };
}

export class PromptManager {
  private versions: Map<string, PromptVersion[]> = new Map();
  private activeVersions: Map<string, string> = new Map();

  registerPrompt(id: string, version: string, prompt: string) {
    const versions = this.versions.get(id) || [];
    versions.push({
      id,
      version,
      prompt,
      createdAt: Date.now(),
      performance: {
        avgQualityScore: 0,
        userSatisfaction: 0,
        usageCount: 0,
      },
    });
    this.versions.set(id, versions);
  }

  getPrompt(id: string, enableABTest = false): string {
    const versions = this.versions.get(id) || [];
    if (versions.length === 0) return '';

    if (enableABTest) {
      const random = Math.floor(Math.random() * versions.length);
      return versions[random].prompt;
    }

    const active = this.activeVersions.get(id);
    const version = versions.find(v => v.version === active) || versions[versions.length - 1];
    return version.prompt;
  }

  recordPerformance(id: string, version: string, score: number) {
    const versions = this.versions.get(id);
    if (!versions) return;

    const target = versions.find(v => v.version === version);
    if (target) {
      const perf = target.performance;
      perf.avgQualityScore = 
        (perf.avgQualityScore * perf.usageCount + score) / (perf.usageCount + 1);
      perf.usageCount++;
    }
  }

  getBestVersion(id: string): PromptVersion | null {
    const versions = this.versions.get(id) || [];
    if (versions.length === 0) return null;

    return versions.reduce((best, current) => 
      current.performance.avgQualityScore > best.performance.avgQualityScore 
        ? current 
        : best
    );
  }
}

export const promptManager = new PromptManager();
