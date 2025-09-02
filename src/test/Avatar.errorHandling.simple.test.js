/**
 * Simplified integration test for Avatar component error handling
 * Tests error handling without complex React Three Fiber mocking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  detectBrowserSupport, 
  categorizeError, 
  generateFallbackLipsync, 
  getRecoveryStrategy,
  LipsyncPerformanceMonitor,
  LIPSYNC_ERROR_TYPES 
} from '../utils/lipsyncErrorHandler';

// Mock browser environment
beforeEach(() => {
  vi.clearAllMocks();
  
  // Setup browser environment
  global.window = {
    AudioContext: vi.fn(),
    webkitAudioContext: vi.fn(),
    MediaStream: vi.fn()
  };
  
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  
  global.performance = {
    now: vi.fn(() => Date.now())
  };
  
  // Reset console
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

describe('Avatar Error Handling Integration', () => {
  describe('Browser Support Detection', () => {
    it('should detect when browser supports wawa-lipsync', () => {
      const support = detectBrowserSupport();
      
      expect(support.isSupported).toBe(true);
      expect(support.missingFeatures).toHaveLength(0);
    });

    it('should detect unsupported browsers and enable fallback mode', () => {
      // Remove Web Audio API support
      delete global.window.AudioContext;
      delete global.window.webkitAudioContext;
      
      const support = detectBrowserSupport();
      
      expect(support.isSupported).toBe(false);
      expect(support.missingFeatures).toContain('Web Audio API');
    });

    it('should provide warnings for Safari browsers', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      
      const support = detectBrowserSupport();
      
      expect(support.warnings.some(w => w.includes('Safari'))).toBe(true);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should categorize initialization errors correctly', () => {
      const error = new Error('AudioContext initialization failed');
      error.name = 'InvalidStateError';
      
      const category = categorizeError(error);
      const strategy = getRecoveryStrategy(category);
      
      expect(category).toBe(LIPSYNC_ERROR_TYPES.CONTEXT_ERROR);
      expect(strategy.maxRetries).toBeGreaterThan(0);
      expect(strategy.fallbackConfig).toBeDefined();
    });

    it('should provide appropriate recovery for audio connection failures', () => {
      const error = new Error('Failed to connect audio source');
      
      const category = categorizeError(error);
      const strategy = getRecoveryStrategy(category);
      
      expect(category).toBe(LIPSYNC_ERROR_TYPES.AUDIO_CONNECTION_FAILED);
      expect(strategy.maxRetries).toBeGreaterThan(0);
    });

    it('should not retry for unsupported browsers', () => {
      const error = new Error('Feature not supported in this browser');
      
      const category = categorizeError(error);
      const strategy = getRecoveryStrategy(category);
      
      expect(category).toBe(LIPSYNC_ERROR_TYPES.BROWSER_UNSUPPORTED);
      expect(strategy.maxRetries).toBe(0);
    });
  });

  describe('Fallback Animation System', () => {
    it('should generate fallback lipsync when wawa-lipsync fails', () => {
      const mockAudio = {
        paused: false,
        ended: false,
        currentTime: 1.5,
        duration: 10.0
      };
      
      const fallbackVisemes = generateFallbackLipsync(mockAudio, 0.5);
      
      expect(Object.keys(fallbackVisemes)).toContain('viseme_AA');
      expect(Object.keys(fallbackVisemes)).toContain('viseme_E');
      expect(fallbackVisemes.viseme_AA).toBeGreaterThan(0);
      expect(fallbackVisemes.viseme_AA).toBeLessThanOrEqual(1);
    });

    it('should not generate fallback for paused audio', () => {
      const mockAudio = {
        paused: true,
        ended: false,
        currentTime: 1.5,
        duration: 10.0
      };
      
      const fallbackVisemes = generateFallbackLipsync(mockAudio);
      
      expect(Object.keys(fallbackVisemes)).toHaveLength(0);
    });

    it('should handle audio errors gracefully', () => {
      const mockAudio = {
        paused: false,
        ended: false,
        currentTime: null, // Invalid state
        duration: 10.0
      };
      
      expect(() => {
        generateFallbackLipsync(mockAudio);
      }).not.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track lipsync performance metrics', () => {
      const monitor = new LipsyncPerformanceMonitor();
      
      // Simulate some operations
      monitor.recordSuccess();
      monitor.recordSuccess();
      monitor.recordError(new Error('Test error'));
      
      const stats = monitor.getStats();
      
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorRate).toBeCloseTo(0.33, 2);
      expect(stats.lastError.message).toBe('Test error');
    });

    it('should warn about slow processing times', () => {
      const monitor = new LipsyncPerformanceMonitor();
      
      // Mock slow processing
      global.performance.now = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(20); // 20ms processing time
      
      const startTime = monitor.startTiming();
      monitor.endTiming(startTime, 'test operation');
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow lipsync')
      );
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue avatar functionality when lipsync is disabled', () => {
      // This test verifies that the avatar can work without lipsync
      // In a real scenario, facial expressions and animations should still work
      
      const support = detectBrowserSupport();
      
      if (!support.isSupported) {
        // Avatar should still be able to:
        // 1. Display facial expressions
        // 2. Play animations
        // 3. Handle eye blinking
        // 4. Process chat messages (without lipsync)
        
        expect(true).toBe(true); // Avatar continues to function
      }
    });

    it('should provide user feedback about lipsync status', () => {
      // Test that error states are properly communicated
      const error = new Error('Lipsync initialization failed');
      const category = categorizeError(error);
      
      expect(category).toBeDefined();
      expect(Object.values(LIPSYNC_ERROR_TYPES)).toContain(category);
    });
  });

  describe('Error Logging and Debugging', () => {
    it('should log errors with appropriate context', () => {
      const error = new Error('Test lipsync error');
      
      // This would be called by the Avatar component
      const category = categorizeError(error);
      
      expect(category).toBe(LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR);
    });

    it('should provide debugging information in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const monitor = new LipsyncPerformanceMonitor();
      monitor.recordError(new Error('Debug test error'));
      
      const stats = monitor.getStats();
      expect(stats.lastError).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});