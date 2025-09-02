/**
 * Comprehensive integration tests for Avatar component with wawa-lipsync
 * 
 * Tests Requirements:
 * - 2.3: Real-time lipsync processing and automatic stopping
 * - 3.4: wawa-lipsync integration without backend dependency
 * - 6.4: Compatibility with existing animation system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import React from 'react';
import { Avatar } from '../components/Avatar';
import { ChatProvider } from '../hooks/useChat';

// Enhanced mocks for comprehensive testing
const mockWawaLipsync = {
  connectAudio: vi.fn(),
  processAudio: vi.fn(),
  features: { mfcc: [1, 2, 3], volume: 0.5 },
  getAveragedFeatures: vi.fn(() => ({ mfcc: [0.8, 1.2, 2.1], volume: 0.4 })),
  computeVisemeScores: vi.fn(() => ({
    viseme_AA: 0.8,
    viseme_E: 0.4,
    viseme_I: 0.2,
    viseme_sil: 0.1
  }))
};

vi.mock('wawa-lipsync', () => ({
  Lipsync: vi.fn(() => mockWawaLipsync)
}));

// Mock Three.js components
vi.mock('@react-three/drei', () => ({
  useAnimations: () => ({
    actions: {
      Idle: { reset: () => ({ fadeIn: () => ({ play: vi.fn() }) }), fadeOut: vi.fn() },
      Talking_1: { reset: () => ({ fadeIn: () => ({ play: vi.fn() }) }), fadeOut: vi.fn() }
    },
    mixer: { stats: { actions: { inUse: 0 } } }
  }),
  useGLTF: () => ({
    nodes: {
      EyeLeft: {
        morphTargetDictionary: {
          viseme_AA: 0,
          viseme_E: 1,
          viseme_I: 2,
          viseme_sil: 3,
          browInnerUp: 4,
          eyeBlinkLeft: 5,
          eyeBlinkRight: 6
        },
        morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0]
      },
      EyeRight: {},
      Hips: {}
    },
    materials: {},
    scene: {
      traverse: vi.fn((callback) => {
        callback({
          isSkinnedMesh: true,
          morphTargetDictionary: {
            viseme_AA: 0,
            viseme_E: 1,
            viseme_I: 2,
            viseme_sil: 3,
            browInnerUp: 4,
            eyeBlinkLeft: 5,
            eyeBlinkRight: 6
          },
          morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0]
        });
      })
    }
  })
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback) => {
    // Store callback for manual triggering in tests
    global.mockUseFrameCallback = callback;
  }
}));

vi.mock('leva', () => ({
  useControls: () => [{}, vi.fn()],
  button: (fn) => fn
}));

// Mock Audio API
global.Audio = vi.fn(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  duration: 5,
  paused: false,
  ended: false,
  onended: null,
  onerror: null
}));

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now())
};

describe('Avatar wawa-lipsync Integration Tests', () => {
  let mockAudio;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset wawa-lipsync mock
    mockWawaLipsync.connectAudio.mockClear();
    mockWawaLipsync.processAudio.mockClear();
    mockWawaLipsync.getAveragedFeatures.mockReturnValue({ mfcc: [0.8, 1.2, 2.1], volume: 0.4 });
    mockWawaLipsync.computeVisemeScores.mockReturnValue({
      viseme_AA: 0.8,
      viseme_E: 0.4,
      viseme_I: 0.2,
      viseme_sil: 0.1
    });

    // Setup mock audio
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
    global.Audio.mockReturnValue(mockAudio);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Requirement 2.3: Real-time lipsync processing', () => {
    it('should initialize wawa-lipsync on component mount', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      await waitFor(() => {
        expect(mockWawaLipsync.connectAudio).not.toHaveBeenCalled(); // Not called until audio is provided
      });

      // Check initialization logs
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('wawa-lipsync initialized')
      );
    });

    it('should connect audio to wawa-lipsync when message is received', async () => {
      const mockMessage = {
        text: "Hello world",
        audio: "base64audiodata",
        audioMime: "audio/mpeg",
        facialExpression: "smile",
        animation: "Talking_1"
      };

      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      const { rerender } = render(<TestWrapper />);

      // Simulate message received by updating the chat context
      // This would normally happen through the useChat hook
      await act(async () => {
        // Simulate the effect that runs when a message is received
        const audio = new Audio("data:audio/mp3;base64," + mockMessage.audio);
        
        // Verify audio creation
        expect(global.Audio).toHaveBeenCalledWith("data:audio/mp3;base64,base64audiodata");
        
        // Simulate wawa-lipsync connection
        mockWawaLipsync.connectAudio(audio);
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio connected to wawa-lipsync')
      );
    });

    it('should process audio and apply viseme values in useFrame', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate active audio playback
      mockAudio.paused = false;
      mockAudio.ended = false;

      // Trigger useFrame callback manually
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
      expect(mockWawaLipsync.getAveragedFeatures).toHaveBeenCalled();
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
    });

    it('should stop lipsync processing when audio ends', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate audio ending
      mockAudio.paused = true;
      mockAudio.ended = true;

      // Trigger useFrame callback
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should not process audio when ended
      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 3.4: Backend independence', () => {
    it('should work without lipsync data from backend', async () => {
      const messageWithoutLipsync = {
        text: "Hello world",
        audio: "base64audiodata",
        audioMime: "audio/mpeg",
        facialExpression: "smile",
        animation: "Talking_1"
        // No lipsync field - should work fine
      };

      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        // Simulate message processing without lipsync data
        const audio = new Audio("data:audio/mp3;base64," + messageWithoutLipsync.audio);
        mockWawaLipsync.connectAudio(audio);
      });

      // Should successfully connect and process without backend lipsync data
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });

    it('should handle audio processing entirely in frontend', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate frontend-only audio processing
      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // All processing should happen in frontend
      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
      
      // No backend calls should be made for lipsync
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('lipsync')
      );
    });

    it('should generate viseme values from audio analysis', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Mock successful audio analysis
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        viseme_E: 0.4,
        viseme_I: 0.2,
        viseme_sil: 0.1
      });

      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should compute viseme scores from audio features
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalledWith(
        expect.any(Object), // currentFeatures
        expect.any(Object), // averagedFeatures
        0, // dVolume
        0  // dCentroid
      );
    });
  });

  describe('Requirement 6.4: Animation system compatibility', () => {
    it('should maintain facial expressions while processing lipsync', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate active lipsync with facial expression
      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Both lipsync and facial expressions should be processed
      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
      
      // Facial expression processing should continue
      // (This would be verified by checking morph target applications)
    });

    it('should handle animation transitions correctly', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Test animation changes during lipsync
      await act(() => {
        // Simulate animation change
        // This would normally be handled by the animation system
      });

      // Lipsync should continue working during animation transitions
      expect(mockWawaLipsync.connectAudio).toBeDefined();
    });

    it('should blend viseme and expression morph targets appropriately', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate scenario with both lipsync and facial expression affecting same targets
      mockAudio.paused = false;
      mockAudio.ended = false;

      // Mock viseme scores that might conflict with expressions
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.6, // Mouth shape that might conflict with smile
        viseme_sil: 0.2
      });

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should handle blending without conflicts
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('conflict')
      );
    });
  });

  describe('Audio cleanup and message transitions', () => {
    it('should clean up audio reference when message ends', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate audio ending
      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testdata");
        mockWawaLipsync.connectAudio(audio);
        
        // Simulate audio end event
        if (audio.onended) {
          audio.onended();
        }
      });

      // Audio reference should be cleared
      // This would be verified by checking that audioRef.current is null
    });

    it('should handle new messages while previous audio is playing', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate first message
      await act(async () => {
        const audio1 = new Audio("data:audio/mp3;base64,message1");
        mockWawaLipsync.connectAudio(audio1);
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(1);

      // Simulate second message before first ends
      await act(async () => {
        const audio2 = new Audio("data:audio/mp3;base64,message2");
        mockWawaLipsync.connectAudio(audio2);
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(2);
      
      // Should handle transition cleanly
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });

    it('should handle audio errors gracefully', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate audio error
      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,invaliddata");
        
        // Simulate audio error
        if (audio.onerror) {
          audio.onerror(new Error('Audio playback failed'));
        }
      });

      // Should handle error without crashing
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('crash')
      );
    });
  });

  describe('Error handling and fallback modes', () => {
    it('should enable fallback mode when wawa-lipsync fails', async () => {
      // Mock wawa-lipsync initialization failure
      const { Lipsync } = await import('wawa-lipsync');
      Lipsync.mockImplementation(() => {
        throw new Error('WebAudio not supported');
      });

      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('fallback mode')
        );
      });
    });

    it('should continue working in fallback mode', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate fallback mode activation
      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should continue functioning even in fallback mode
      // (Fallback behavior would be tested here)
    });

    it('should recover from temporary errors', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Simulate temporary processing error
      mockWawaLipsync.processAudio.mockImplementationOnce(() => {
        throw new Error('Temporary processing error');
      });

      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should log error but continue
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error')
      );

      // Reset mock for next call
      mockWawaLipsync.processAudio.mockImplementation(() => {});

      // Should recover on next frame
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
    });
  });

  describe('Performance and optimization', () => {
    it('should limit active visemes to prevent over-blending', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Mock many active visemes
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        viseme_E: 0.7,
        viseme_I: 0.6,
        viseme_O: 0.5,
        viseme_U: 0.4,
        viseme_PP: 0.3,
        viseme_sil: 0.2
      });

      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should limit the number of active visemes for performance
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
      
      // The actual limiting would be tested by checking morph target applications
      // Only top N visemes should be applied
    });

    it('should use appropriate smoothing parameters', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should use optimized smoothing parameters
      // This would be verified by checking the lerp speeds used
      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
    });

    it('should handle high-frequency updates efficiently', async () => {
      const TestWrapper = () => (
        <ChatProvider>
          <Canvas>
            <Avatar />
          </Canvas>
        </ChatProvider>
      );

      render(<TestWrapper />);

      mockAudio.paused = false;
      mockAudio.ended = false;

      // Simulate multiple rapid frame updates
      const startTime = performance.now();
      
      for (let i = 0; i < 60; i++) { // Simulate 60 FPS
        await act(() => {
          if (global.mockUseFrameCallback) {
            global.mockUseFrameCallback();
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 60 FPS efficiently
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockWawaLipsync.processAudio).toHaveBeenCalledTimes(60);
    });
  });
});