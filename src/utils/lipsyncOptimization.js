/**
 * Lipsync Performance Optimization Utilities
 * Optimizes lipsync smoothness and responsiveness parameters
 * Requirements: 5.1, 5.2, 5.3
 */

// Optimal configuration based on performance testing
export const OPTIMAL_LIPSYNC_CONFIG = {
  // wawa-lipsync initialization parameters
  fftSize: 1024,        // Best balance between accuracy and performance
  historySize: 8,       // Smooth transitions without excessive lag
  
  // Smoothing parameters for enhanced performance
  smoothing: {
    ACTIVE_LERP_SPEED: 0.3,     // Speed for transitioning to active visemes
    NEUTRAL_LERP_SPEED: 0.2,    // Speed for returning to neutral
    MIN_THRESHOLD: 0.02,        // Minimum threshold to avoid micro-movements
    MAX_BLEND_VISEMES: 3,       // Maximum number of visemes to blend simultaneously
    EXPRESSION_BLEND_FACTOR: 0.3 // Blend factor for facial expressions during lipsync
  },
  
  // Performance monitoring thresholds
  performance: {
    MAX_PROCESSING_TIME: 1.0,   // Maximum processing time per frame (ms)
    MAX_MEMORY_INCREASE: 10,    // Maximum memory increase (MB)
    TARGET_FPS: 60,             // Target frame rate
    ERROR_THRESHOLD: 0.05       // Maximum acceptable error rate (5%)
  }
};

// Browser-specific optimizations
export const BROWSER_OPTIMIZATIONS = {
  chrome: {
    fftSize: 1024,
    historySize: 8,
    useWebGL: true,
    enableHardwareAcceleration: true
  },
  firefox: {
    fftSize: 1024,
    historySize: 6,
    useWebGL: true,
    enableHardwareAcceleration: false
  },
  safari: {
    fftSize: 512,
    historySize: 4,
    useWebGL: false,
    enableHardwareAcceleration: false
  },
  edge: {
    fftSize: 1024,
    historySize: 8,
    useWebGL: true,
    enableHardwareAcceleration: true
  }
};

// Performance monitoring class
export class LipsyncPerformanceOptimizer {
  constructor() {
    this.measurements = [];
    this.errorCount = 0;
    this.successCount = 0;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.memoryBaseline = this.getMemoryUsage();
  }

  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  startTiming() {
    return performance.now();
  }

  endTiming(startTime, operation = 'unknown') {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.measurements.push({
      operation,
      duration,
      timestamp: endTime,
      frameCount: this.frameCount++
    });
    
    return duration;
  }

  recordSuccess() {
    this.successCount++;
  }

  recordError(error) {
    this.errorCount++;
    console.warn('Lipsync performance error:', error);
  }

  getStats() {
    const totalTime = performance.now() - this.startTime;
    const currentMemory = this.getMemoryUsage();
    
    const processingTimes = this.measurements
      .filter(m => m.operation.includes('processing'))
      .map(m => m.duration);
    
    const stats = {
      // Timing statistics
      totalRuntime: totalTime,
      frameCount: this.frameCount,
      averageFPS: this.frameCount / (totalTime / 1000),
      
      // Processing performance
      averageProcessingTime: processingTimes.length > 0 
        ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length 
        : 0,
      maxProcessingTime: processingTimes.length > 0 ? Math.max(...processingTimes) : 0,
      minProcessingTime: processingTimes.length > 0 ? Math.min(...processingTimes) : 0,
      
      // Error statistics
      errorRate: this.errorCount / (this.errorCount + this.successCount),
      totalErrors: this.errorCount,
      totalSuccesses: this.successCount,
      
      // Memory statistics
      memoryIncrease: currentMemory && this.memoryBaseline 
        ? (currentMemory.used - this.memoryBaseline.used) / 1024 / 1024 
        : 0
    };
    
    return stats;
  }

  isPerformanceHealthy() {
    const totalTime = performance.now() - this.startTime;
    const currentMemory = this.getMemoryUsage();
    
    const processingTimes = this.measurements
      .filter(m => m.operation.includes('processing'))
      .map(m => m.duration);
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length 
      : 0;
    
    const averageFPS = this.frameCount / (totalTime / 1000);
    const errorRate = this.errorCount / (this.errorCount + this.successCount);
    const memoryIncrease = currentMemory && this.memoryBaseline 
      ? (currentMemory.used - this.memoryBaseline.used) / 1024 / 1024 
      : 0;
    
    const config = OPTIMAL_LIPSYNC_CONFIG.performance;
    
    return (
      averageProcessingTime < config.MAX_PROCESSING_TIME &&
      memoryIncrease < config.MAX_MEMORY_INCREASE &&
      averageFPS > config.TARGET_FPS * 0.9 && // Allow 10% tolerance
      errorRate < config.ERROR_THRESHOLD
    );
  }

  getOptimizationRecommendations() {
    const stats = this.getStats();
    const recommendations = [];
    
    if (stats.averageProcessingTime > OPTIMAL_LIPSYNC_CONFIG.performance.MAX_PROCESSING_TIME) {
      recommendations.push({
        issue: 'High processing time',
        recommendation: 'Reduce fftSize or historySize',
        priority: 'high'
      });
    }
    
    if (stats.memoryIncrease > OPTIMAL_LIPSYNC_CONFIG.performance.MAX_MEMORY_INCREASE) {
      recommendations.push({
        issue: 'High memory usage',
        recommendation: 'Implement memory cleanup or reduce buffer sizes',
        priority: 'medium'
      });
    }
    
    if (stats.averageFPS < OPTIMAL_LIPSYNC_CONFIG.performance.TARGET_FPS * 0.8) {
      recommendations.push({
        issue: 'Low frame rate',
        recommendation: 'Optimize rendering loop or reduce processing frequency',
        priority: 'high'
      });
    }
    
    if (stats.errorRate > OPTIMAL_LIPSYNC_CONFIG.performance.ERROR_THRESHOLD) {
      recommendations.push({
        issue: 'High error rate',
        recommendation: 'Improve error handling and fallback mechanisms',
        priority: 'critical'
      });
    }
    
    return recommendations;
  }

  reset() {
    this.measurements = [];
    this.errorCount = 0;
    this.successCount = 0;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.memoryBaseline = this.getMemoryUsage();
  }
}

// Browser detection and optimization
export const detectBrowserAndOptimize = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  let browserConfig = OPTIMAL_LIPSYNC_CONFIG;
  
  if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
    browserConfig = { ...browserConfig, ...BROWSER_OPTIMIZATIONS.chrome };
  } else if (userAgent.includes('firefox')) {
    browserConfig = { ...browserConfig, ...BROWSER_OPTIMIZATIONS.firefox };
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browserConfig = { ...browserConfig, ...BROWSER_OPTIMIZATIONS.safari };
  } else if (userAgent.includes('edge')) {
    browserConfig = { ...browserConfig, ...BROWSER_OPTIMIZATIONS.edge };
  }
  
  return browserConfig;
};

// Adaptive performance optimization
export class AdaptivePerformanceOptimizer {
  constructor() {
    this.performanceHistory = [];
    this.currentConfig = detectBrowserAndOptimize();
    this.adaptationCount = 0;
    this.maxAdaptations = 5;
  }

  analyzePerformance(stats) {
    this.performanceHistory.push({
      timestamp: Date.now(),
      stats: { ...stats },
      config: { ...this.currentConfig }
    });
    
    // Keep only recent history (last 10 measurements)
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }
  }

  shouldAdapt() {
    if (this.adaptationCount >= this.maxAdaptations) {
      return false; // Prevent infinite adaptation loops
    }
    
    if (this.performanceHistory.length < 3) {
      return false; // Need enough data to make decisions
    }
    
    const recentStats = this.performanceHistory.slice(-3);
    const averageProcessingTime = recentStats.reduce(
      (sum, entry) => sum + entry.stats.averageProcessingTime, 0
    ) / recentStats.length;
    
    const averageFPS = recentStats.reduce(
      (sum, entry) => sum + entry.stats.averageFPS, 0
    ) / recentStats.length;
    
    // Adapt if performance is consistently poor
    return (
      averageProcessingTime > OPTIMAL_LIPSYNC_CONFIG.performance.MAX_PROCESSING_TIME ||
      averageFPS < OPTIMAL_LIPSYNC_CONFIG.performance.TARGET_FPS * 0.8
    );
  }

  adaptConfiguration() {
    if (!this.shouldAdapt()) {
      return this.currentConfig;
    }
    
    this.adaptationCount++;
    
    // Progressive degradation strategy
    if (this.adaptationCount === 1) {
      // First adaptation: reduce history size
      this.currentConfig.historySize = Math.max(4, this.currentConfig.historySize - 2);
    } else if (this.adaptationCount === 2) {
      // Second adaptation: reduce FFT size
      this.currentConfig.fftSize = Math.max(512, this.currentConfig.fftSize / 2);
    } else if (this.adaptationCount === 3) {
      // Third adaptation: increase thresholds
      this.currentConfig.smoothing.MIN_THRESHOLD *= 1.5;
      this.currentConfig.smoothing.MAX_BLEND_VISEMES = Math.max(1, 
        this.currentConfig.smoothing.MAX_BLEND_VISEMES - 1);
    } else if (this.adaptationCount === 4) {
      // Fourth adaptation: reduce lerp speeds
      this.currentConfig.smoothing.ACTIVE_LERP_SPEED *= 0.8;
      this.currentConfig.smoothing.NEUTRAL_LERP_SPEED *= 0.8;
    } else {
      // Final adaptation: minimal configuration
      this.currentConfig = {
        fftSize: 256,
        historySize: 2,
        smoothing: {
          ACTIVE_LERP_SPEED: 0.1,
          NEUTRAL_LERP_SPEED: 0.1,
          MIN_THRESHOLD: 0.1,
          MAX_BLEND_VISEMES: 1,
          EXPRESSION_BLEND_FACTOR: 0.1
        }
      };
    }
    
    console.log(`🔧 Adapted lipsync configuration (attempt ${this.adaptationCount}):`, 
      this.currentConfig);
    
    return this.currentConfig;
  }

  getOptimalConfiguration() {
    return this.currentConfig;
  }

  reset() {
    this.performanceHistory = [];
    this.currentConfig = detectBrowserAndOptimize();
    this.adaptationCount = 0;
  }
}

// Performance testing utilities
export const runPerformanceBenchmark = async (lipsyncInstance, duration = 5000) => {
  const monitor = new LipsyncPerformanceOptimizer();
  const startTime = performance.now();
  const endTime = startTime + duration;
  
  console.log('🚀 Starting lipsync performance benchmark...');
  
  while (performance.now() < endTime) {
    const frameStart = monitor.startTiming();
    
    try {
      // Simulate lipsync processing
      lipsyncInstance.processAudio();
      const features = lipsyncInstance.getAveragedFeatures();
      lipsyncInstance.computeVisemeScores(
        lipsyncInstance.features,
        features,
        0,
        0
      );
      
      monitor.recordSuccess();
    } catch (error) {
      monitor.recordError(error);
    }
    
    monitor.endTiming(frameStart, 'lipsync-processing');
    
    // Simulate 60fps timing
    await new Promise(resolve => setTimeout(resolve, 16.67));
  }
  
  const stats = monitor.getStats();
  const recommendations = monitor.getOptimizationRecommendations();
  
  console.log('📊 Performance Benchmark Results:', stats);
  
  if (recommendations.length > 0) {
    console.log('💡 Optimization Recommendations:', recommendations);
  }
  
  return { stats, recommendations };
};

// Export performance monitoring instance for global use
export const globalPerformanceMonitor = new LipsyncPerformanceOptimizer();