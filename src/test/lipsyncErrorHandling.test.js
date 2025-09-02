/**
 * Test suite for lipsync error handling functionality
 * Tests fallback behaviors, browser compatibility, and recovery mechanisms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectBrowserSupport, 
  categorizeError, 
  generateFallbackLipsync, 
  getRecoveryStrategy,
  LipsyncPerformanceMonitor,
  LIPSYNC_ERROR_TYPES 
} from '../utils/lipsyncErrorHandler';

// Mock browser APIs
const mockAudioContext = vi.fn();
const mockMediaStream = vi.fn();

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Setup default browser environment
  global.window = {
    AudioContext: mockAudioContext,
    webkitAudioContext: mockAudioContext,
    MediaStream: mockMediaStream,
    MediaStreamAudioSourceNode: vi.fn()
  };
  
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
  
  global.performance = {
    now: vi.fn(() => Date.now())
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Browser Support Detection', () => {
  it('should detect supported browser correctly', () => {
    const support = detectBrowserSupport();
    
    expect(support.isSupported).toBe(true);
    expect(support.missingFeatures).toHaveLength(0);
  });

  it('should detect unsupported browser when AudioContext is missing', () => {
    delete global.window.AudioContext;
    delete global.window.webkitAudioContext;
    
    const support = detectBrowserSupport();
    
    expect(support.isSupported).toBe(false);
    expect(support.missingFeatures).toContain('Web Audio API');
  });

  it('should detect Safari and add warnings', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
    
    const support = detectBrowserSupport();
    
    expect(support.warnings.some(w => w.includes('Safari'))).toBe(true);
  });

  it('should detect mobile browsers and add warnings', () => {
    global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    
    const support = detectBrowserSupport();
    
    expect(support.warnings.some(w => w.includes('Mobile'))).toBe(true);
  });
});

describe('Error Categorization', () => {
  it('should categorize context errors correctly', () => {
    const error = new Error('AudioContext state error');
    error.name = 'InvalidStateError';
    
    const category = categorizeError(error);
    
    expect(category).toBe(LIPSYNC_ERROR_TYPES.CONTEXT_ERROR);
  });

  it('should categorize audio connection errors', () => {
    const error = new Error('Failed to connect audio source');
    
    const category = categorizeError(error);
    
    expect(category).toBe(LIPSYNC_ERROR_TYPES.AUDIO_CONNECTION_FAILED);
  });

  it('should categorize browser support errors', () => {
    const error = new Error('Feature not supported in this browser');
    
    const category = categorizeError(error);
    
    expect(category).toBe(LIPSYNC_ERROR_TYPES.BROWSER_UNSUPPORTED);
  });

  it('should return unknown error for unrecognized errors', () => {
    const error = new Error('Some random error');
    
    const category = categorizeError(error);
    
    expect(category).toBe(LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR);
  });
});

describe('Fallback Lipsync Generation', () => {
  let mockAudio;

  beforeEach(() => {
    mockAudio = {
      paused: false,
      ended: false,
      currentTime: 1.5,
      duration: 10.0
    };
  });

  it('should generate fallback visemes for active audio', () => {
    const visemes = generateFallbackLipsync(mockAudio, 0.5);
    
    expect(Object.keys(visemes)).toContain('viseme_AA');
    expect(Object.keys(visemes)).toContain('viseme_E');
    expect(visemes.viseme_AA).toBeGreaterThan(0);
    expect(visemes.viseme_AA).toBeLessThanOrEqual(1);
  });

  it('should return empty object for paused audio', () => {
    mockAudio.paused = true;
    
    const visemes = generateFallbackLipsync(mockAudio);
    
    expect(Object.keys(visemes)).toHaveLength(0);
  });

  it('should return empty object for ended audio', () => {
    mockAudio.ended = true;
    
    const visemes = generateFallbackLipsync(mockAudio);
    
    expect(Object.keys(visemes)).toHaveLength(0);
  });

  it('should handle audio without duration gracefully', () => {
    mockAudio.duration = null;
    
    const visemes = generateFallbackLipsync(mockAudio);
    
    expect(Object.keys(visemes)).toHaveLength(0);
  });
});

describe('Recovery Strategies', () => {
  it('should provide appropriate strategy for initialization errors', () => {
    const strategy = getRecoveryStrategy(LIPSYNC_ERROR_TYPES.INITIALIZATION_FAILED);
    
    expect(strategy.maxRetries).toBeGreaterThan(0);
    expect(strategy.delay).toBeGreaterThan(0);
    expect(strategy.fallbackConfig).toBeDefined();
  });

  it('should provide no retry strategy for unsupported browsers', () => {
    const strategy = getRecoveryStrategy(LIPSYNC_ERROR_TYPES.BROWSER_UNSUPPORTED);
    
    expect(strategy.maxRetries).toBe(0);
    expect(strategy.delay).toBe(0);
  });

  it('should provide context error recovery with longer delay', () => {
    const strategy = getRecoveryStrategy(LIPSYNC_ERROR_TYPES.CONTEXT_ERROR);
    
    expect(strategy.delay).toBeGreaterThan(3000);
    expect(strategy.fallbackConfig).toBeDefined();
  });
});

describe('Performance Monitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new LipsyncPerformanceMonitor();
  });

  it('should track processing times', () => {
    vi.useFakeTimers();
    
    // Mock performance.now to return incrementing values
    let timeCounter = 0;
    global.performance.now = vi.fn(() => timeCounter++);
    
    const startTime = monitor.startTiming();
    monitor.endTiming(startTime);
    
    const stats = monitor.getStats();
    expect(parseFloat(stats.averageProcessingTime)).toBeGreaterThan(0);
    
    vi.useRealTimers();
  });

  it('should track success and error counts', () => {
    monitor.recordSuccess();
    monitor.recordSuccess();
    monitor.recordError(new Error('Test error'));
    
    const stats = monitor.getStats();
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.totalErrors).toBe(1);
    expect(stats.errorRate).toBeCloseTo(0.33, 2);
  });

  it('should store last error information', () => {
    const testError = new Error('Test error message');
    monitor.recordError(testError);
    
    const stats = monitor.getStats();
    expect(stats.lastError.message).toBe('Test error message');
    expect(stats.lastError.type).toBe(LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR);
  });

  it('should reset statistics correctly', () => {
    monitor.recordSuccess();
    monitor.recordError(new Error('Test'));
    
    monitor.reset();
    
    const stats = monitor.getStats();
    expect(stats.totalSuccesses).toBe(0);
    expect(stats.totalErrors).toBe(0);
    expect(stats.lastError).toBeNull();
  });

  it('should limit processing time history', () => {
    // Add more than 100 measurements
    for (let i = 0; i < 150; i++) {
      const startTime = monitor.startTiming();
      monitor.endTiming(startTime);
    }
    
    // Should only keep last 100
    expect(monitor.metrics.processingTime.length).toBe(100);
  });
});

describe('Integration Tests', () => {
  it('should handle complete error flow', () => {
    // Simulate initialization error
    const initError = new Error('AudioContext initialization failed');
    initError.name = 'InvalidStateError';
    
    const errorType = categorizeError(initError);
    const strategy = getRecoveryStrategy(errorType);
    
    expect(errorType).toBe(LIPSYNC_ERROR_TYPES.CONTEXT_ERROR);
    expect(strategy.maxRetries).toBeGreaterThan(0);
    expect(strategy.fallbackConfig).toBeDefined();
  });

  it('should provide fallback when browser is unsupported', () => {
    // Remove browser support
    delete global.window.AudioContext;
    delete global.window.webkitAudioContext;
    
    const support = detectBrowserSupport();
    expect(support.isSupported).toBe(false);
    
    // Should still be able to generate fallback animation
    const mockAudio = {
      paused: false,
      ended: false,
      currentTime: 1.0,
      duration: 5.0
    };
    
    const fallback = generateFallbackLipsync(mockAudio);
    expect(Object.keys(fallback).length).toBeGreaterThan(0);
  });
});