import { describe, it, expect } from 'vitest';
import { quickValidate } from '../contentValidator';

describe('ContentValidator - Integration Tests', () => {
  describe('quickValidate', () => {
    it('should detect medical law violations and return ValidationResult', () => {
      const result = quickValidate('100% 완치 가능합니다!');
      
      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.isValid).toBe(false);
    });

    it('should return clean validation for safe content', () => {
      const result = quickValidate('저희 병원은 환자분들의 건강을 최우선으로 생각합니다.');
      
      expect(result).toBeDefined();
      expect(result.violations.length).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it('should detect multiple violations', () => {
      const result = quickValidate('최고의 병원! 100% 완치됩니다!');
      
      expect(result.violations.length).toBeGreaterThan(1);
      expect(result.isValid).toBe(false);
    });

    it('should calculate score based on violations', () => {
      const result = quickValidate('1위 병원에서 확실히 치료됩니다');
      
      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should provide warnings for medium severity issues', () => {
      const text = `
        저희는 최고의 병원입니다.
        100% 완치가 가능하며,
        확실한 효과를 보장합니다.
      `;
      
      const result = quickValidate(text);
      expect(result.violations.length + result.warnings.length).toBeGreaterThan(0);
    });
  });
});
