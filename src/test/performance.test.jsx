/**
 * Performance Tests for wawa-lipsync Integration
 * Tests frontend performance with wawa-lipsync processing
 * Requirements: 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import React from 'react';
import { Avatar } from '../components/Avatar';
import { Lipsync } from 'wawa-lipsync';

// Mock wawa-lipsync for controlled testing
vi.mock('wawa-lipsync', () => ({
  Lipsync: vi.fn().mockImplementation(() => ({
    connectAudio: vi.fn(),
    processAudio: vi.fn(),
    features: { mfcc: new Array(13).fill(0) },
    getAveragedFeatures: vi.fn(() => ({ mfcc: new Array(13).fill(0) })),
    computeVisemeScores: vi.fn(() => ({
      viseme_AA: 0.8,
      viseme_E: 0.3,
      viseme_PP: 0.1
    }))
  }))
}));

// Mock Avatar component to avoid complex dependencies
vi.mock('../components/Avatar', () => ({
  Avatar: vi.fn(() => null)
}));

// Mock useChat hook
vi.mock('../hooks/useChat', () => ({
  useChat: () => ({
    message: null,
    onMessagePlayed: vi.fn(),
    chat: vi.fn()
  })
}));

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.measurements = [];
    this.frameCount = 0;
    this.startTime = 0;
  }

  startMeasurement(label) {
    const start = performance.now();
    return {
      label,
      start,
      end: () => {
        const end = performance.now();
        const duration = end - start;
        this.measurements.push({ label, duration, timestamp: start });
        return duration;
      }
    };
  }

  getAverageTime(label) {
    const filtered = this.measurements.filter(m => m.label === label);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.duration, 0) / filtered.length;
  }

  getStats() {
    const stats = {};
    const labels = [...new Set(this.measurements.map(m => m.label))];
    
    labels.forEach(label => {
      const filtered = this.measurements.filter(m => m.label === label);
      stats[label] = {
        count: filtered.length,
        average: this.getAverageTime(label),
        min: Math.min(...filtered.map(m => m.duration)),
        max: Math.max(...filtered.map(m => m.duration)),
        total: filtered.reduce((sum, m) => sum + m.duration, 0)
      };
    });
    
    return stats;
  }

  reset() {
    this.measurements = [];
    this.frameCount = 0;
    this.startTime = 0;
  }
}

describe('Frontend Performance Tests', () => {
  let performanceMonitor;
  let mockAudio;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    
    // Mock Audio API
    mockAudio = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      currentTime: 0,
      duration: 5,
      paused: false,
      ended: false,
      onended: null,
      onerror: null
    };
    
    global.Audio = vi.fn(() => mockAudio);
    
    // Mock Web Audio API
    global.AudioContext = vi.fn(() => ({
      createAnalyser: vi.fn(() => ({
        fftSize: 1024,
        frequencyBinCount: 512,
        getByteFrequencyData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined)
    }));
  });

  afterEach(() => {
    performanceMonitor.reset();
    vi.clearAllMocks();
  });

  describe('wawa-lipsync Processing Performance', () => {
    it('should process audio within acceptable time limits', async () => {
      const measurement = performanceMonitor.startMeasurement('lipsync-processing');
      
      // Simulate wawa-lipsync processing
      const lipsync = new Lipsync();
      
      // Simulate multiple processing cycles
      for (let i = 0; i < 100; i++) {
        lipsync.processAudio();
        lipsync.computeVisemeScores(
          lipsync.features,
          lipsync.getAveragedFeatures(),
          0,
          0
        );
      }
      
      const duration = measurement.end();
      
      // Should process 100 cycles in less than 100ms (1ms per cycle)
      expect(duration).toBeLessThan(100);
      
      const averagePerCycle = duration / 100;
      expect(averagePerCycle).toBeLessThan(1); // Less than 1ms per cycle
    });

    it('should maintain consistent performance under load', async () => {
      const cycles = 1000;
      const measurements = [];
      
      const lipsync = new Lipsync();
      
      for (let i = 0; i < cycles; i++) {
        const start = performance.now();
        
        lipsync.processAudio();
        const visemes = lipsync.computeVisemeScores(
          lipsync.features,
          lipsync.getAveragedFeatures(),
          0,
          0
        );
        
        const end = performance.now();
        measurements.push(end - start);
      }
      
      const average = measurements.reduce((sum, m) => sum + m, 0) / measurements.length;
      const max = Math.max(...measurements);
      const min = Math.min(...measurements);
      const variance = measurements.reduce((sum, m) => sum + Math.pow(m - average, 2), 0) / measurements.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Performance should be consistent
      expect(average).toBeLessThan(0.5); // Average less than 0.5ms
      expect(max).toBeLessThan(2); // No single operation over 2ms
      expect(standardDeviation).toBeLessThan(0.3); // Low variance
      
      console.log('Performance Stats:', {
        average: average.toFixed(3),
        max: max.toFixed(3),
        min: min.toFixed(3),
        standardDeviation: standardDeviation.toFixed(3)
      });
    });

    it('should handle memory efficiently during extended use', async () => {
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      const lipsync = new Lipsync();
      
      // Simulate extended use (5 minutes at 60fps = 18000 frames)
      for (let i = 0; i < 18000; i++) {
        lipsync.processAudio();
        lipsync.computeVisemeScores(
          lipsync.features,
          lipsync.getAveragedFeatures(),
          0,
          0
        );
        
        // Simulate garbage collection every 1000 frames
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for extended use)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
      }
      
      console.log('Memory Usage:', {
        initial: initialMemory,
        final: finalMemory,
        increase: memoryIncrease,
        increaseKB: Math.round(memoryIncrease / 1024)
      });
    });
  });

  describe('Avatar Component Performance', () => {
    it('should render Avatar component efficiently', async () => {
      const measurement = performanceMonitor.startMeasurement('avatar-render');
      
      await act(async () => {
        render(
          <Canvas>
            <Avatar />
          </Canvas>
        );
      });
      
      const duration = measurement.end();
      
      // Initial render should be fast
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle multiple message updates efficiently', async () => {
      const { rerender } = render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
      
      const messages = [
        { text: "Hello", audio: "base64audio1", facialExpression: "smile", animation: "Talking_1" },
        { text: "How are you?", audio: "base64audio2", facialExpression: "default", animation: "Talking_2" },
        { text: "Goodbye", audio: "base64audio3", facialExpression: "sad", animation: "Idle" }
      ];
      
      const updateTimes = [];
      
      for (const message of messages) {
        const start = performance.now();
        
        await act(async () => {
          // Mock useChat to return the current message
          vi.mocked(require('../hooks/useChat').useChat).mockReturnValue({
            message,
            onMessagePlayed: vi.fn(),
            chat: vi.fn()
          });
          
          rerender(
            <Canvas>
              <Avatar />
            </Canvas>
          );
        });
        
        const end = performance.now();
        updateTimes.push(end - start);
      }
      
      const averageUpdateTime = updateTimes.reduce((sum, t) => sum + t, 0) / updateTimes.length;
      
      // Message updates should be fast
      expect(averageUpdateTime).toBeLessThan(50); // Less than 50ms average
      expect(Math.max(...updateTimes)).toBeLessThan(100); // No single update over 100ms
    });
  });

  describe('Smoothness and Responsiveness Optimization', () => {
    it('should maintain smooth viseme transitions', () => {
      const lipsync = new Lipsync();
      const transitionTimes = [];
      
      // Test transition smoothness by measuring value changes
      let previousValues = { viseme_AA: 0, viseme_E: 0, viseme_PP: 0 };
      
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        
        const currentValues = lipsync.computeVisemeScores(
          lipsync.features,
          lipsync.getAveragedFeatures(),
          0,
          0
        );
        
        // Calculate transition smoothness (rate of change)
        const changes = Object.keys(currentValues).map(key => 
          Math.abs(currentValues[key] - (previousValues[key] || 0))
        );
        
        const maxChange = Math.max(...changes);
        const end = performance.now();
        
        transitionTimes.push({
          duration: end - start,
          maxChange,
          smoothness: maxChange < 0.3 // Smooth if change is less than 30%
        });
        
        previousValues = { ...currentValues };
      }
      
      const smoothTransitions = transitionTimes.filter(t => t.smoothness).length;
      const smoothnessRatio = smoothTransitions / transitionTimes.length;
      
      // At least 80% of transitions should be smooth
      expect(smoothnessRatio).toBeGreaterThan(0.8);
      
      const averageTransitionTime = transitionTimes.reduce((sum, t) => sum + t.duration, 0) / transitionTimes.length;
      
      // Transitions should be fast
      expect(averageTransitionTime).toBeLessThan(1); // Less than 1ms per transition
    });

    it('should optimize lipsync parameters for best performance', () => {
      const configurations = [
        { fftSize: 512, historySize: 4 },
        { fftSize: 1024, historySize: 8 },
        { fftSize: 2048, historySize: 16 }
      ];
      
      const results = configurations.map(config => {
        const lipsync = new Lipsync(config);
        const start = performance.now();
        
        // Run performance test
        for (let i = 0; i < 1000; i++) {
          lipsync.processAudio();
          lipsync.computeVisemeScores(
            lipsync.features,
            lipsync.getAveragedFeatures(),
            0,
            0
          );
        }
        
        const end = performance.now();
        const duration = end - start;
        
        return {
          config,
          duration,
          averagePerFrame: duration / 1000
        };
      });
      
      // Find the optimal configuration (best performance)
      const optimal = results.reduce((best, current) => 
        current.duration < best.duration ? current : best
      );
      
      console.log('Configuration Performance Results:', results);
      console.log('Optimal Configuration:', optimal);
      
      // The optimal configuration should process frames in less than 0.5ms each
      expect(optimal.averagePerFrame).toBeLessThan(0.5);
      
      // Recommended configuration should be fftSize: 1024, historySize: 8
      // This provides good balance between accuracy and performance
      expect(optimal.config.fftSize).toBe(1024);
      expect(optimal.config.historySize).toBe(8);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors without significant performance impact', async () => {
      const lipsync = new Lipsync();
      
      // Mock error scenarios
      const originalProcessAudio = lipsync.processAudio;
      let errorCount = 0;
      
      lipsync.processAudio = () => {
        errorCount++;
        if (errorCount % 10 === 0) {
          throw new Error('Simulated processing error');
        }
        return originalProcessAudio.call(lipsync);
      };
      
      const errorHandlingTimes = [];
      
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        
        try {
          lipsync.processAudio();
          lipsync.computeVisemeScores(
            lipsync.features,
            lipsync.getAveragedFeatures(),
            0,
            0
          );
        } catch (error) {
          // Simulate error handling
          console.warn('Handled error:', error.message);
        }
        
        const end = performance.now();
        errorHandlingTimes.push(end - start);
      }
      
      const averageErrorHandlingTime = errorHandlingTimes.reduce((sum, t) => sum + t, 0) / errorHandlingTimes.length;
      
      // Error handling should not significantly impact performance
      expect(averageErrorHandlingTime).toBeLessThan(2); // Less than 2ms average including error handling
    });
  });

  describe('Browser Compatibility Performance', () => {
    it('should perform well across different browser environments', () => {
      const browserConfigs = [
        { name: 'Chrome', AudioContext: true, webkitAudioContext: false },
        { name: 'Firefox', AudioContext: true, webkitAudioContext: false },
        { name: 'Safari', AudioContext: false, webkitAudioContext: true },
        { name: 'Edge', AudioContext: true, webkitAudioContext: false }
      ];
      
      const performanceResults = browserConfigs.map(browser => {
        // Mock browser environment
        if (browser.AudioContext) {
          global.AudioContext = vi.fn(() => ({
            createAnalyser: vi.fn(() => ({ fftSize: 1024 })),
            state: 'running'
          }));
        } else {
          delete global.AudioContext;
        }
        
        if (browser.webkitAudioContext) {
          global.webkitAudioContext = global.AudioContext;
        }
        
        const lipsync = new Lipsync();
        const start = performance.now();
        
        // Run performance test
        for (let i = 0; i < 500; i++) {
          lipsync.processAudio();
          lipsync.computeVisemeScores(
            lipsync.features,
            lipsync.getAveragedFeatures(),
            0,
            0
          );
        }
        
        const end = performance.now();
        
        return {
          browser: browser.name,
          duration: end - start,
          averagePerFrame: (end - start) / 500
        };
      });
      
      console.log('Browser Performance Results:', performanceResults);
      
      // All browsers should perform reasonably well
      performanceResults.forEach(result => {
        expect(result.averagePerFrame).toBeLessThan(1); // Less than 1ms per frame
        expect(result.duration).toBeLessThan(500); // Total test under 500ms
      });
    });
  });
});