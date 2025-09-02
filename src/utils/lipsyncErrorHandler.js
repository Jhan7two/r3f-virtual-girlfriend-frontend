/**
 * Comprehensive error handling utilities for wawa-lipsync integration
 * Provides fallback behaviors, browser compatibility checks, and recovery mechanisms
 */

// Error types for categorizing lipsync failures
export const LIPSYNC_ERROR_TYPES = {
  INITIALIZATION_FAILED: 'initialization_failed',
  AUDIO_CONNECTION_FAILED: 'audio_connection_failed',
  PROCESSING_ERROR: 'processing_error',
  BROWSER_UNSUPPORTED: 'browser_unsupported',
  CONTEXT_ERROR: 'context_error',
  UNKNOWN_ERROR: 'unknown_error'
};

// Browser compatibility requirements
export const BROWSER_REQUIREMENTS = {
  webAudioAPI: 'Web Audio API',
  mediaStream: 'MediaStream API',
  audioContext: 'AudioContext',
  analyserNode: 'AnalyserNode'
};

/**
 * Comprehensive browser support detection
 * @returns {Object} Support status and missing features
 */
export const detectBrowserSupport = () => {
  const support = {
    isSupported: true,
    missingFeatures: [],
    warnings: []
  };

  try {
    // Check Web Audio API
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      support.isSupported = false;
      support.missingFeatures.push(BROWSER_REQUIREMENTS.webAudioAPI);
    }

    // Check MediaStream API
    if (!window.MediaStream) {
      support.isSupported = false;
      support.missingFeatures.push(BROWSER_REQUIREMENTS.mediaStream);
    }

    // Check AnalyserNode
    if (AudioContext) {
      try {
        const testContext = new AudioContext();
        const analyser = testContext.createAnalyser();
        testContext.close();
      } catch (error) {
        support.warnings.push('AnalyserNode creation failed');
      }
    }

    // Browser-specific checks
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Safari-specific warnings
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      support.warnings.push('Safari may have limited Web Audio API support');
    }

    // Mobile browser warnings
    if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      support.warnings.push('Mobile browsers may have performance limitations');
    }

    // Firefox-specific checks
    if (userAgent.includes('firefox')) {
      // Firefox generally has good support, but check version
      const firefoxVersion = userAgent.match(/firefox\/(\d+)/);
      if (firefoxVersion && parseInt(firefoxVersion[1]) < 60) {
        support.warnings.push('Firefox version may be too old for optimal support');
      }
    }

  } catch (error) {
    support.isSupported = false;
    support.missingFeatures.push('Browser detection failed');
  }

  return support;
};

/**
 * Categorize error types for appropriate handling
 * @param {Error} error - The error to categorize
 * @returns {string} Error type from LIPSYNC_ERROR_TYPES
 */
export const categorizeError = (error) => {
  if (!error) return LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR;

  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Context-related errors
  if (name.includes('invalidstate') || message.includes('context')) {
    return LIPSYNC_ERROR_TYPES.CONTEXT_ERROR;
  }

  // Audio connection errors
  if (message.includes('audio') || message.includes('connect')) {
    return LIPSYNC_ERROR_TYPES.AUDIO_CONNECTION_FAILED;
  }

  // Processing errors
  if (message.includes('process') || message.includes('analyze')) {
    return LIPSYNC_ERROR_TYPES.PROCESSING_ERROR;
  }

  // Browser support errors
  if (message.includes('not supported') || message.includes('unavailable')) {
    return LIPSYNC_ERROR_TYPES.BROWSER_UNSUPPORTED;
  }

  // Initialization errors
  if (message.includes('init') || message.includes('constructor')) {
    return LIPSYNC_ERROR_TYPES.INITIALIZATION_FAILED;
  }

  return LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR;
};

/**
 * Generate fallback lipsync animation based on audio timing
 * @param {HTMLAudioElement} audio - Audio element
 * @param {number} intensity - Base intensity (0-1)
 * @returns {Object} Fallback viseme values
 */
export const generateFallbackLipsync = (audio, intensity = 0.5) => {
  if (!audio || audio.paused || audio.ended) {
    return {};
  }

  try {
    const currentTime = audio.currentTime;
    const duration = audio.duration;

    if (!duration || currentTime >= duration) {
      return {};
    }

    // Create simple oscillating mouth movement
    const timeBasedIntensity = Math.sin(currentTime * 8) * intensity + intensity;
    const clampedIntensity = Math.max(0, Math.min(timeBasedIntensity, 1));

    // Return basic viseme pattern for talking animation
    return {
      viseme_AA: clampedIntensity * 0.7,
      viseme_E: clampedIntensity * 0.3,
      viseme_I: clampedIntensity * 0.2,
      viseme_O: clampedIntensity * 0.4
    };
  } catch (error) {
    console.warn('⚠️ Error generating fallback lipsync:', error);
    return {};
  }
};

/**
 * Recovery strategies for different error types
 * @param {string} errorType - Error type from LIPSYNC_ERROR_TYPES
 * @returns {Object} Recovery strategy
 */
export const getRecoveryStrategy = (errorType) => {
  const strategies = {
    [LIPSYNC_ERROR_TYPES.INITIALIZATION_FAILED]: {
      delay: 2000,
      maxRetries: 3,
      fallbackConfig: { fftSize: 512, historySize: 4 },
      description: 'Retry with reduced settings'
    },
    [LIPSYNC_ERROR_TYPES.AUDIO_CONNECTION_FAILED]: {
      delay: 1000,
      maxRetries: 2,
      fallbackConfig: null,
      description: 'Retry audio connection'
    },
    [LIPSYNC_ERROR_TYPES.PROCESSING_ERROR]: {
      delay: 500,
      maxRetries: 1,
      fallbackConfig: null,
      description: 'Skip current frame and continue'
    },
    [LIPSYNC_ERROR_TYPES.CONTEXT_ERROR]: {
      delay: 5000,
      maxRetries: 2,
      fallbackConfig: { fftSize: 256, historySize: 2 },
      description: 'Reinitialize with minimal settings'
    },
    [LIPSYNC_ERROR_TYPES.BROWSER_UNSUPPORTED]: {
      delay: 0,
      maxRetries: 0,
      fallbackConfig: null,
      description: 'Use fallback animation permanently'
    },
    [LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR]: {
      delay: 3000,
      maxRetries: 1,
      fallbackConfig: { fftSize: 512, historySize: 4 },
      description: 'Generic recovery attempt'
    }
  };

  return strategies[errorType] || strategies[LIPSYNC_ERROR_TYPES.UNKNOWN_ERROR];
};

/**
 * Log error with appropriate level and context
 * @param {Error} error - The error to log
 * @param {string} context - Additional context information
 */
export const logLipsyncError = (error, context = '') => {
  const errorType = categorizeError(error);
  const timestamp = new Date().toISOString();
  
  const logMessage = `[${timestamp}] Lipsync Error (${errorType}): ${error.message}`;
  
  if (context) {
    console.error(`${logMessage} | Context: ${context}`);
  } else {
    console.error(logMessage);
  }

  // Log stack trace for development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    console.error('Stack trace:', error.stack);
  }
};

/**
 * Performance monitoring for lipsync operations
 */
export class LipsyncPerformanceMonitor {
  constructor() {
    this.metrics = {
      processingTime: [],
      errorCount: 0,
      successCount: 0,
      lastError: null
    };
  }

  startTiming() {
    return performance.now();
  }

  endTiming(startTime, operation = 'processing') {
    const duration = performance.now() - startTime;
    this.metrics.processingTime.push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.processingTime.length > 100) {
      this.metrics.processingTime.shift();
    }

    // Log performance warnings
    if (duration > 16.67) { // More than one frame at 60fps
      console.warn(`⚠️ Slow lipsync ${operation}: ${duration.toFixed(2)}ms`);
    }
  }

  recordSuccess() {
    this.metrics.successCount++;
  }

  recordError(error) {
    this.metrics.errorCount++;
    this.metrics.lastError = {
      message: error.message,
      timestamp: Date.now(),
      type: categorizeError(error)
    };
  }

  getStats() {
    const processingTimes = this.metrics.processingTime;
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    return {
      averageProcessingTime: avgProcessingTime.toFixed(2),
      errorRate: this.metrics.errorCount / (this.metrics.errorCount + this.metrics.successCount) || 0,
      totalErrors: this.metrics.errorCount,
      totalSuccesses: this.metrics.successCount,
      lastError: this.metrics.lastError
    };
  }

  reset() {
    this.metrics = {
      processingTime: [],
      errorCount: 0,
      successCount: 0,
      lastError: null
    };
  }
}

export default {
  detectBrowserSupport,
  categorizeError,
  generateFallbackLipsync,
  getRecoveryStrategy,
  logLipsyncError,
  LipsyncPerformanceMonitor,
  LIPSYNC_ERROR_TYPES,
  BROWSER_REQUIREMENTS
};