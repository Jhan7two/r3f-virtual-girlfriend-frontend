/**
 * Integration tests for complete chat flow with lipsync synchronization
 * 
 * Tests Requirements:
 * - 2.3: Real-time lipsync processing and automatic stopping
 * - 3.4: Complete frontend lipsync processing without backend dependency
 * - 6.4: Integration with existing chat and animation systems
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, screen } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import React from 'react';
import { Avatar } from '../components/Avatar';
import { ChatProvider, useChat } from '../hooks/useChat';

// Mock fetch for chat API
global.fetch = vi.fn();

// Mock wawa-lipsync
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

// Mock Three.js and R3F components
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
          viseme_AA: 0, viseme_E: 1, viseme_I: 2, viseme_sil: 3,
          browInnerUp: 4, eyeBlinkLeft: 5, eyeBlinkRight: 6
        },
        morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0]
      },
      EyeRight: {}, Hips: {}
    },
    materials: {},
    scene: {
      traverse: vi.fn((callback) => {
        callback({
          isSkinnedMesh: true,
          morphTargetDictionary: {
            viseme_AA: 0, viseme_E: 1, viseme_I: 2, viseme_sil: 3,
            browInnerUp: 4, eyeBlinkLeft: 5, eyeBlinkRight: 6
          },
          morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0]
        });
      })
    }
  })
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="canvas">{children}</div>,
  useFrame: (callback) => {
    global.mockUseFrameCallback = callback;
  }
}));

vi.mock('leva', () => ({
  useControls: () => [{}, vi.fn()],
  button: (fn) => fn
}));

// Mock Audio API with enhanced functionality
const createMockAudio = (duration = 5) => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  duration,
  paused: false,
  ended: false,
  onended: null,
  onerror: null,
  onloadedmetadata: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
});

global.Audio = vi.fn(() => createMockAudio());

// Test component that uses chat functionality
const ChatTestComponent = () => {
  const { chat, message, loading, onMessagePlayed } = useChat();
  
  return (
    <div>
      <button 
        onClick={() => chat("Hello")} 
        data-testid="chat-button"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Send Message'}
      </button>
      <div data-testid="current-message">
        {message ? message.text : 'No message'}
      </div>
      <button 
        onClick={onMessagePlayed} 
        data-testid="message-played-button"
      >
        Message Played
      </button>
      <Canvas>
        <Avatar />
      </Canvas>
    </div>
  );
};

describe('Chat Flow with Lipsync Integration Tests', () => {
  let mockAudio;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset fetch mock
    global.fetch.mockClear();
    
    // Reset wawa-lipsync mocks
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
    mockAudio = createMockAudio();
    global.Audio.mockReturnValue(mockAudio);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Complete chat to lipsync flow', () => {
    it('should handle complete flow from chat request to lipsync synchronization', async () => {
      // Mock successful chat response
      const mockChatResponse = {
        messages: [{
          text: "Hello there!",
          audio: "base64encodedaudio",
          audioMime: "audio/mpeg",
          facialExpression: "smile",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockChatResponse
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Step 1: Send chat message
      const chatButton = screen.getByTestId('chat-button');
      
      await act(async () => {
        chatButton.click();
      });

      // Verify chat API was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hello' })
        })
      );

      // Step 2: Verify message is received and processed
      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('Hello there!');
      });

      // Step 3: Verify audio is created and connected to wawa-lipsync
      expect(global.Audio).toHaveBeenCalledWith('data:audio/mp3;base64,base64encodedaudio');
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledWith(mockAudio);

      // Step 4: Verify audio playback starts
      expect(mockAudio.play).toHaveBeenCalled();

      // Step 5: Simulate lipsync processing during playback
      mockAudio.paused = false;
      mockAudio.ended = false;

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();

      // Step 6: Simulate audio ending
      mockAudio.ended = true;
      mockAudio.paused = true;

      await act(() => {
        if (mockAudio.onended) {
          mockAudio.onended();
        }
      });

      // Step 7: Verify cleanup
      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('No message');
      });
    });

    it('should handle multiple messages in sequence', async () => {
      const mockResponses = [
        {
          messages: [{
            text: "First message",
            audio: "audio1base64",
            audioMime: "audio/mpeg",
            facialExpression: "smile",
            animation: "Talking_1"
          }]
        },
        {
          messages: [{
            text: "Second message", 
            audio: "audio2base64",
            audioMime: "audio/mpeg",
            facialExpression: "surprised",
            animation: "Talking_2"
          }]
        }
      ];

      global.fetch
        .mockResolvedValueOnce({ json: async () => mockResponses[0] })
        .mockResolvedValueOnce({ json: async () => mockResponses[1] });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      const chatButton = screen.getByTestId('chat-button');

      // Send first message
      await act(async () => {
        chatButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('First message');
      });

      // Verify first audio connection
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(1);

      // Complete first message
      await act(() => {
        if (mockAudio.onended) {
          mockAudio.onended();
        }
      });

      // Send second message
      const mockAudio2 = createMockAudio();
      global.Audio.mockReturnValue(mockAudio2);

      await act(async () => {
        chatButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('Second message');
      });

      // Verify second audio connection
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(2);
      expect(mockWawaLipsync.connectAudio).toHaveBeenLastCalledWith(mockAudio2);
    });

    it('should handle queued messages correctly', async () => {
      const mockResponse = {
        messages: [
          {
            text: "Message 1",
            audio: "audio1base64",
            audioMime: "audio/mpeg",
            facialExpression: "smile",
            animation: "Talking_1"
          },
          {
            text: "Message 2",
            audio: "audio2base64", 
            audioMime: "audio/mpeg",
            facialExpression: "happy",
            animation: "Talking_2"
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      // Send chat that returns multiple messages
      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      // Should show first message
      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('Message 1');
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(1);

      // Complete first message
      await act(() => {
        if (mockAudio.onended) {
          mockAudio.onended();
        }
      });

      // Should automatically show second message
      const mockAudio2 = createMockAudio();
      global.Audio.mockReturnValue(mockAudio2);

      await waitFor(() => {
        expect(screen.getByTestId('current-message')).toHaveTextContent('Message 2');
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(2);
    });
  });

  describe('Lipsync synchronization during chat', () => {
    it('should synchronize lipsync with audio playback timing', async () => {
      const mockResponse = {
        messages: [{
          text: "Testing synchronization",
          audio: "synctestaudio",
          audioMime: "audio/mpeg",
          facialExpression: "neutral",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      await waitFor(() => {
        expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();
      });

      // Simulate different audio playback states
      const testStates = [
        { paused: false, ended: false, currentTime: 1.0 },
        { paused: false, ended: false, currentTime: 2.5 },
        { paused: false, ended: false, currentTime: 4.0 },
        { paused: true, ended: true, currentTime: 5.0 }
      ];

      for (const state of testStates) {
        Object.assign(mockAudio, state);

        await act(() => {
          if (global.mockUseFrameCallback) {
            global.mockUseFrameCallback();
          }
        });

        if (!state.paused && !state.ended) {
          expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
        }
      }

      // Verify processing stopped when audio ended
      mockWawaLipsync.processAudio.mockClear();
      
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it('should handle real-time viseme updates', async () => {
      const mockResponse = {
        messages: [{
          text: "Real-time test",
          audio: "realtimeaudio",
          audioMime: "audio/mpeg",
          facialExpression: "neutral",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      // Mock changing viseme scores over time
      const visemeSequence = [
        { viseme_sil: 0.8, viseme_AA: 0.1 },
        { viseme_AA: 0.9, viseme_sil: 0.1 },
        { viseme_E: 0.7, viseme_AA: 0.2 },
        { viseme_I: 0.6, viseme_E: 0.3 },
        { viseme_sil: 0.9, viseme_I: 0.1 }
      ];

      let sequenceIndex = 0;
      mockWawaLipsync.computeVisemeScores.mockImplementation(() => {
        const scores = visemeSequence[sequenceIndex % visemeSequence.length];
        sequenceIndex++;
        return scores;
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      mockAudio.paused = false;
      mockAudio.ended = false;

      // Simulate multiple frame updates
      for (let i = 0; i < visemeSequence.length; i++) {
        await act(() => {
          if (global.mockUseFrameCallback) {
            global.mockUseFrameCallback();
          }
        });

        expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
      }

      // Verify all viseme sequences were processed
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalledTimes(visemeSequence.length);
    });
  });

  describe('Error handling in chat flow', () => {
    it('should handle chat API errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      // Should not crash and should not attempt lipsync
      expect(mockWawaLipsync.connectAudio).not.toHaveBeenCalled();
      expect(screen.getByTestId('current-message')).toHaveTextContent('No message');
    });

    it('should handle audio creation errors', async () => {
      const mockResponse = {
        messages: [{
          text: "Audio error test",
          audio: "invalidaudiodata",
          audioMime: "audio/mpeg",
          facialExpression: "neutral",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      // Mock Audio constructor to throw error
      global.Audio.mockImplementationOnce(() => {
        throw new Error('Invalid audio data');
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      // Should handle error gracefully
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fallback mode')
      );
      
      // Should not crash the application
      expect(screen.getByTestId('current-message')).toHaveTextContent('No message');
    });

    it('should handle wawa-lipsync connection errors', async () => {
      const mockResponse = {
        messages: [{
          text: "Connection error test",
          audio: "testaudio",
          audioMime: "audio/mpeg",
          facialExpression: "neutral",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      // Mock wawa-lipsync connection error
      mockWawaLipsync.connectAudio.mockImplementationOnce(() => {
        throw new Error('Audio context error');
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      // Should attempt connection but handle error
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error')
      );

      // Audio should still play even if lipsync fails
      expect(mockAudio.play).toHaveBeenCalled();
    });
  });

  describe('Performance during chat flow', () => {
    it('should maintain performance with rapid message updates', async () => {
      const rapidMessages = Array.from({ length: 10 }, (_, i) => ({
        text: `Message ${i + 1}`,
        audio: `audio${i}base64`,
        audioMime: "audio/mpeg",
        facialExpression: "neutral",
        animation: "Talking_1"
      }));

      global.fetch.mockResolvedValue({
        json: async () => ({ messages: rapidMessages })
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      const startTime = performance.now();

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      // Process all messages rapidly
      for (let i = 0; i < rapidMessages.length; i++) {
        await act(() => {
          if (mockAudio.onended) {
            mockAudio.onended();
          }
        });

        // Create new audio for next message
        const newMockAudio = createMockAudio();
        global.Audio.mockReturnValue(newMockAudio);
        mockAudio = newMockAudio;
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(rapidMessages.length);
    });

    it('should handle concurrent lipsync processing efficiently', async () => {
      const mockResponse = {
        messages: [{
          text: "Performance test message",
          audio: "performancetestaudio",
          audioMime: "audio/mpeg",
          facialExpression: "neutral",
          animation: "Talking_1"
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      const TestWrapper = () => (
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      render(<TestWrapper />);

      await act(async () => {
        screen.getByTestId('chat-button').click();
      });

      mockAudio.paused = false;
      mockAudio.ended = false;

      // Simulate high-frequency frame updates
      const frameCount = 120; // 2 seconds at 60 FPS
      const startTime = performance.now();

      for (let i = 0; i < frameCount; i++) {
        await act(() => {
          if (global.mockUseFrameCallback) {
            global.mockUseFrameCallback();
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should maintain 60 FPS performance
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(mockWawaLipsync.processAudio).toHaveBeenCalledTimes(frameCount);
    });
  });

  describe('Integration with existing systems', () => {
    it('should work with different facial expressions during chat', async () => {
      const expressionMessages = [
        { facialExpression: "smile", text: "Happy message" },
        { facialExpression: "sad", text: "Sad message" },
        { facialExpression: "surprised", text: "Surprised message" },
        { facialExpression: "angry", text: "Angry message" }
      ];

      for (const msgData of expressionMessages) {
        const mockResponse = {
          messages: [{
            text: msgData.text,
            audio: "expressionaudio",
            audioMime: "audio/mpeg",
            facialExpression: msgData.facialExpression,
            animation: "Talking_1"
          }]
        };

        global.fetch.mockResolvedValueOnce({
          json: async () => mockResponse
        });

        const TestWrapper = () => (
          <ChatProvider>
            <ChatTestComponent />
          </ChatProvider>
        );

        const { unmount } = render(<TestWrapper />);

        await act(async () => {
          screen.getByTestId('chat-button').click();
        });

        // Should connect audio regardless of facial expression
        expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();

        // Should process lipsync with facial expressions
        mockAudio.paused = false;
        mockAudio.ended = false;

        await act(() => {
          if (global.mockUseFrameCallback) {
            global.mockUseFrameCallback();
          }
        });

        expect(mockWawaLipsync.processAudio).toHaveBeenCalled();

        unmount();
        vi.clearAllMocks();
        mockWawaLipsync.connectAudio.mockClear();
        mockWawaLipsync.processAudio.mockClear();
      }
    });

    it('should work with different animation types during chat', async () => {
      const animationMessages = [
        { animation: "Talking_1", text: "Animation 1" },
        { animation: "Talking_2", text: "Animation 2" },
        { animation: "Idle", text: "Idle animation" }
      ];

      for (const msgData of animationMessages) {
        const mockResponse = {
          messages: [{
            text: msgData.text,
            audio: "animationaudio",
            audioMime: "audio/mpeg",
            facialExpression: "neutral",
            animation: msgData.animation
          }]
        };

        global.fetch.mockResolvedValueOnce({
          json: async () => mockResponse
        });

        const TestWrapper = () => (
          <ChatProvider>
            <ChatTestComponent />
          </ChatProvider>
        );

        const { unmount } = render(<TestWrapper />);

        await act(async () => {
          screen.getByTestId('chat-button').click();
        });

        // Should work with any animation type
        expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();

        unmount();
        vi.clearAllMocks();
        mockWawaLipsync.connectAudio.mockClear();
      }
    });
  });
});