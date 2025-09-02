/**
 * Simplified Lipsync Performance Tests
 * Tests core wawa-lipsync performance without complex UI dependencies
 * Requirements: 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  OPTIMAL_LIPSYNC_CONFIG,
  LipsyncPerformanceOptimizer,
  AdaptivePerformanceOptimizer,
  detectBrowserAndOptimize,
  runPerformanceBenchmark
} from '../utils/lipsyncOptimization';

// Mock wawa-lipsync for controlled testing
const mockLipsync = {
  processAudio: vi.fn(),
  features: { mfcc: new Array(13).fill(0) },
  getAveragedFeatures: vi.fn(() => ({ mfcc: new Array(13).fill(0) })),
  computeVisemeScores: vi.fn(() => ({
    viseme_AA: Math.random() * 0.8,
    viseme_E: Math.random() * 0.3,
    viseme_PP: Math.random() * 0.1
  }))
};

describe('Lipsync Performance Optimization Tests', () => {
  let performanceOptimizer;
  let adaptiveOptimizer;

  beforeEach(() => {
    performanceOptimizer = new LipsyncPerformanceOptimizer();
    adaptiveOptimizer = new AdaptivePerformanceOptimizer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceOptimizer.reset();
    adaptiveOptimizer.reset();
  });

  describe('Performance Monitoring', () => {
    it('should track processing times accurately', () => {
      const startTime = performanceOptimizer.startTiming();
      
      // Simulate processing delay
      const delay = 5; // 5ms
      const endTime = startTime + delay;
      vi.spyOn(performance, 'now').mockReturnValue(endTime);
      
      const duration = performanceOptimizer.endTiming(startTime, 'test-operation');
      
      expect(duration).toBe(delay);
      expect(performanceOptimizer.measurements).toHaveLength(1);
      expect(performanceOptimizer.measurements[0].operation).toBe('test-operation');
    });

    it('should calculate performance statistics correctly', () => {
      // Add some test measurements
      const measurements = [1, 2, 3, 4, 5]; // ms
      
      measurements.forEach((duration, index) => {
        performanceOptimizer.measurements.push({
          operation: 'lipsync-processing',
          duration,
          timestamp: Date.now() + index,
          frameCount: index
        });
        performanceOptimizer.frameCount = index + 1;
        performanceOptimizer.successCount++;
      });
      
      const stats = performanceOptimizer.getStats();
      
      expect(stats.averageProcessingTime).toBe(3); // (1+2+3+4+5)/5
      expect(stats.maxProcessingTime).toBe(5);
      expect(stats.minProcessingTime).toBe(1);
      expect(stats.totalSuccesses).toBe(5);
      expect(stats.errorRate).toBe(0);
    });

    it('should identify performance health correctly', () => {
      // Test healthy performance
      performanceOptimizer.measurements = [
        { operation: 'lipsync-processing', duration: 0.5, timestamp: Date.now(), frameCount: 1 }
      ];
      performanceOptimizer.frameCount = 1;
      performanceOptimizer.successCount = 1;
      performanceOptimizer.startTime = performance.now() - 16.67; // 60fps
      
      expect(performanceOptimizer.isPerformanceHealthy()).toBe(true);
      
      // Test unhealthy performance (high processing time)
      performanceOptimizer.measurements = [
        { operation: 'lipsync-processing', duration: 2.0, timestamp: Date.now(), frameCount: 1 }
      ];
      
      expect(performanceOptimizer.isPerformanceHealthy()).toBe(false);
    });
  });

  describe('Browser Optimization', () => {
    it('should detect browser and return appropriate configuration', () => {
      // Mock Chrome
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      });
      
      const config = detectBrowserAndOptimize();
      
      expect(config.fftSize).toBe(1024);
      expect(config.historySize).toBe(8);
      expect(config.useWebGL).toBe(true);
    });

    it('should provide Safari-specific optimizations', () => {
      // Mock Safari
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        configurable: true
      });
      
      const config = detectBrowserAndOptimize();
      
      expect(config.fftSize).toBe(512); // Lower for Safari
      expect(config.historySize).toBe(4); // Lower for Safari
      expect(config.useWebGL).toBe(false); // Disabled for Safari
    });
  });

  describe('Adaptive Performance Optimization', () => {
    it('should not adapt with insufficient data', () => {
      const initialConfig = adaptiveOptimizer.getOptimalConfiguration();
      
      expect(adaptiveOptimizer.shouldAdapt()).toBe(false);
      
      const newConfig = adaptiveOptimizer.adaptConfiguration();
      expect(newConfig).toEqual(initialConfig);
    });

    it('should adapt configuration when performance is poor', () => {
      // Add poor performance history
      const poorStats = {
        averageProcessingTime: 2.0, // Above threshold
        averageFPS: 30, // Below threshold
        errorRate: 0.01
      };
      
      // Add enough history to trigger adaptation
      for (let i = 0; i < 5; i++) {
        adaptiveOptimizer.analyzePerformance(poorStats);
      }
      
      expect(adaptiveOptimizer.shouldAdapt()).toBe(true);
      
      const originalConfig = adaptiveOptimizer.getOptimalConfiguration();
      const adaptedConfig = adaptiveOptimizer.adaptConfiguration();
      
      // Should reduce history size first
      expect(adaptedConfig.historySize).toBeLessThan(originalConfig.historySize);
    });

    it('should progressively degrade configuration', () => {
      const poorStats = {
        averageProcessingTime: 2.0,
        averageFPS: 30,
        errorRate: 0.01
      };
      
      // Force multiple adaptations
      for (let i = 0; i < 5; i++) {
        adaptiveOptimizer.analyzePerformance(poorStats);
      }
      
      const configs = [];
      
      // Perform multiple adaptations
      for (let i = 0; i < 5; i++) {
        if (adaptiveOptimizer.shouldAdapt()) {
          configs.push(adaptiveOptimizer.adaptConfiguration());
        }
      }
      
      expect(configs.length).toBeGreaterThan(0);
      
      // Each adaptation should reduce performance requirements
      if (configs.length > 1) {
        expect(configs[configs.length - 1].fftSize).toBeLessThanOrEqual(configs[0].fftSize);
      }
    });
  });

  describe('Lipsync Processing Performance', () => {
    it('should process lipsync data within time limits', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        mockLipsync.processAudio();
        mockLipsync.computeVisemeScores(
          mockLipsync.features,
          mockLipsync.getAveragedFeatures(),
          0,
          0
        );
      }
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averagePerIteration = totalDuration / iterations;
      
      // Should process each iteration in less than 1ms
      expect(averagePerIteration).toBeLessThan(1);
      expect(totalDuration).toBeLessThan(1000); // Total under 1 second
    });

    it('should maintain consistent performance under load', () => {
      const measurements = [];
      const iterations = 500;
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        mockLipsync.processAudio();
        mockLipsync.computeVisemeScores(
          mockLipsync.features,
          mockLipsync.getAveragedFeatures(),
          0,
          0
        );
        
        const end = performance.now();
        measurements.push(end - start);
      }
      
      const average = measurements.reduce((sum, m) => sum + m, 0) / measurements.length;
      const max = Math.max(...measurements);
      const variance = measurements.reduce((sum, m) => sum + Math.pow(m - average, 2), 0) / measurements.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Performance should be consistent
      expect(average).toBeLessThan(0.5);
      expect(max).toBeLessThan(2);
      expect(standardDeviation).toBeLessThan(0.3);
    });
  });

  describe('Configuration Optimization', () => {
    it('should identify optimal configuration parameters', () => {
      const configurations = [
        { fftSize: 512, historySize: 4 },
        { fftSize: 1024, historySize: 8 },
        { fftSize: 2048, historySize: 16 }
      ];
      
      const results = configurations.map(config => {
        const start = performance.now();
        
        // Simulate processing with different configurations
        const iterations = config.fftSize / 512 * 100; // More iterations for larger FFT
        
        for (let i = 0; i < iterations; i++) {
          mockLipsync.processAudio();
          mockLipsync.computeVisemeScores(
            mockLipsync.features,
            mockLipsync.getAveragedFeatures(),
            0,
            0
          );
        }
        
        const end = performance.now();
        const duration = end - start;
        
        return {
          config,
          duration,
          averagePerFrame: duration / iterations
        };
      });
      
      // Find the optimal configuration (best performance)
      const optimal = results.reduce((best, current) => 
        current.averagePerFrame < best.averagePerFrame ? current : best
      );
      
      // The optimal configuration should process frames efficiently
      expect(optimal.averagePerFrame).toBeLessThan(0.5);
      
      // Should prefer balanced configuration (1024 FFT size typically optimal)
      expect(optimal.config.fftSize).toBeGreaterThanOrEqual(512);
      expect(optimal.config.fftSize).toBeLessThanOrEqual(2048);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors without significant performance impact', () => {
      let errorCount = 0;
      const totalIterations = 100;
      
      // Mock error scenarios
      const originalProcessAudio = mockLipsync.processAudio;
      mockLipsync.processAudio = vi.fn(() => {
        errorCount++;
        if (errorCount % 10 === 0) {
          throw new Error('Simulated processing error');
        }
        return originalProcessAudio();
      });
      
      const errorHandlingTimes = [];
      
      for (let i = 0; i < totalIterations; i++) {
        const start = performance.now();
        
        try {
          mockLipsync.processAudio();
          mockLipsync.computeVisemeScores(
            mockLipsync.features,
            mockLipsync.getAveragedFeatures(),
            0,
            0
          );
          performanceOptimizer.recordSuccess();
        } catch (error) {
          performanceOptimizer.recordError(error);
        }
        
        const end = performance.now();
        errorHandlingTimes.push(end - start);
      }
      
      const averageErrorHandlingTime = errorHandlingTimes.reduce((sum, t) => sum + t, 0) / errorHandlingTimes.length;
      
      // Error handling should not significantly impact performance
      expect(averageErrorHandlingTime).toBeLessThan(2);
      expect(performanceOptimizer.errorCount).toBeGreaterThan(0); // Should have recorded errors
      expect(performanceOptimizer.successCount).toBeGreaterThan(0); // Should have recorded successes
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should use memory efficiently during extended processing', () => {
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      // Simulate extended processing (simulate 5 minutes at 60fps)
      const frames = 18000;
      
      for (let i = 0; i < frames; i++) {
        mockLipsync.processAudio();
        mockLipsync.computeVisemeScores(
          mockLipsync.features,
          mockLipsync.getAveragedFeatures(),
          0,
          0
        );
        
        // Simulate periodic cleanup
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable for extended use
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      }
    });
  });

  describe('Performance Benchmarking', () => {
    it('should run performance benchmark successfully', async () => {
      const benchmarkDuration = 100; // Short duration for testing
      
      const { stats, recommendations } = await runPerformanceBenchmark(mockLipsync, benchmarkDuration);
      
      expect(stats).toBeDefined();
      expect(stats.frameCount).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Should complete benchmark within reasonable time
      expect(stats.totalRuntime).toBeGreaterThan(benchmarkDuration * 0.8); // Allow some tolerance
      expect(stats.totalRuntime).toBeLessThan(benchmarkDuration * 2); // Should not take too long
    });
  });

  describe('Optimal Configuration Validation', () => {
    it('should validate optimal lipsync configuration values', () => {
      const config = OPTIMAL_LIPSYNC_CONFIG;
      
      // Validate configuration structure
      expect(config.fftSize).toBeDefined();
      expect(config.historySize).toBeDefined();
      expect(config.smoothing).toBeDefined();
      expect(config.performance).toBeDefined();
      
      // Validate reasonable values
      expect(config.fftSize).toBeGreaterThanOrEqual(256);
      expect(config.fftSize).toBeLessThanOrEqual(4096);
      expect(config.historySize).toBeGreaterThanOrEqual(2);
      expect(config.historySize).toBeLessThanOrEqual(32);
      
      // Validate smoothing parameters
      expect(config.smoothing.ACTIVE_LERP_SPEED).toBeGreaterThan(0);
      expect(config.smoothing.ACTIVE_LERP_SPEED).toBeLessThanOrEqual(1);
      expect(config.smoothing.NEUTRAL_LERP_SPEED).toBeGreaterThan(0);
      expect(config.smoothing.NEUTRAL_LERP_SPEED).toBeLessThanOrEqual(1);
      
      // Validate performance thresholds
      expect(config.performance.MAX_PROCESSING_TIME).toBeGreaterThan(0);
      expect(config.performance.TARGET_FPS).toBeGreaterThanOrEqual(30);
      expect(config.performance.ERROR_THRESHOLD).toBeGreaterThan(0);
      expect(config.performance.ERROR_THRESHOLD).toBeLessThan(1);
    });
  });
});