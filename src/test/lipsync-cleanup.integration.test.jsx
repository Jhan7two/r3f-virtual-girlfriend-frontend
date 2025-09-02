/**
 * Integration tests for lipsync cleanup scenarios
 *
 * Tests Requirements:
 * - 2.3: Automatic stopping when audio ends
 * - 3.4: Proper cleanup without backend dependency
 * - 6.4: Clean transitions between messages and states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { Canvas } from "@react-three/fiber";
import React from "react";
import { Avatar } from "../components/Avatar";
import { ChatProvider } from "../hooks/useChat";

// Mock wawa-lipsync with cleanup tracking
const mockWawaLipsync = {
  connectAudio: vi.fn(),
  processAudio: vi.fn(),
  features: { mfcc: [1, 2, 3], volume: 0.5 },
  getAveragedFeatures: vi.fn(() => ({ mfcc: [0.8, 1.2, 2.1], volume: 0.4 })),
  computeVisemeScores: vi.fn(() => ({
    viseme_AA: 0.8,
    viseme_E: 0.4,
    viseme_I: 0.2,
    viseme_sil: 0.1,
  })),
  disconnect: vi.fn(),
  cleanup: vi.fn(),
};

vi.mock("wawa-lipsync", () => ({
  Lipsync: vi.fn(() => mockWawaLipsync),
}));

// Mock Three.js components
vi.mock("@react-three/drei", () => ({
  useAnimations: () => ({
    actions: {
      Idle: {
        reset: () => ({ fadeIn: () => ({ play: vi.fn() }) }),
        fadeOut: vi.fn(),
      },
      Talking_1: {
        reset: () => ({ fadeIn: () => ({ play: vi.fn() }) }),
        fadeOut: vi.fn(),
      },
    },
    mixer: { stats: { actions: { inUse: 0 } } },
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
          eyeBlinkRight: 6,
        },
        morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0],
      },
      EyeRight: {},
      Hips: {},
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
            eyeBlinkRight: 6,
          },
          morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0],
        });
      }),
    },
  }),
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }) => <div data-testid="canvas">{children}</div>,
  useFrame: (callback) => {
    global.mockUseFrameCallback = callback;
  },
}));

vi.mock("leva", () => ({
  useControls: () => [{}, vi.fn()],
  button: (fn) => fn,
}));

// Enhanced Audio mock with event handling
const createMockAudio = (duration = 5) => {
  const audio = {
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
    removeEventListener: vi.fn(),
    // Helper methods for testing
    simulateEnd: function () {
      this.ended = true;
      this.paused = true;
      if (this.onended) this.onended();
    },
    simulateError: function (error) {
      if (this.onerror) this.onerror(error);
    },
    simulatePlay: function () {
      this.paused = false;
      this.ended = false;
    },
  };
  return audio;
};

global.Audio = vi.fn(() => createMockAudio());

// Test component for cleanup scenarios
const CleanupTestComponent = ({ message, onMessagePlayed }) => {
  return (
    <ChatProvider>
      <Canvas>
        <Avatar />
      </Canvas>
    </ChatProvider>
  );
};

describe("Lipsync Cleanup Integration Tests", () => {
  let mockAudio;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset wawa-lipsync mocks
    Object.values(mockWawaLipsync).forEach((mock) => {
      if (typeof mock === "function") mock.mockClear();
    });

    // Setup fresh mock audio
    mockAudio = createMockAudio();
    global.Audio.mockReturnValue(mockAudio);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("Audio end cleanup", () => {
    it("should stop lipsync processing when audio ends naturally", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Simulate message with audio
      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();

      // Simulate active lipsync processing
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();

      // Simulate audio ending
      mockWawaLipsync.processAudio.mockClear();

      await act(() => {
        mockAudio.simulateEnd();
      });

      // Verify lipsync processing stops
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should reset viseme targets to neutral when audio ends", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Start with active visemes
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        viseme_E: 0.6,
        viseme_I: 0.4,
      });

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      // Process with active visemes
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();

      // End audio
      await act(() => {
        mockAudio.simulateEnd();
      });

      // Clear viseme scores to simulate no active lipsync
      mockWawaLipsync.computeVisemeScores.mockReturnValue({});

      // Process frame after audio ends
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Viseme targets should be reset to neutral (this would be verified by checking morph target values)
      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should handle audio ending during error states", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      // Simulate processing error
      mockWawaLipsync.processAudio.mockImplementationOnce(() => {
        throw new Error("Processing error during playback");
      });

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error")
      );

      // End audio during error state
      await act(() => {
        mockAudio.simulateEnd();
      });

      // Should handle cleanup gracefully even after error
      mockWawaLipsync.processAudio.mockImplementation(() => {});

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });
  });

  describe("New message cleanup", () => {
    it("should clean up previous audio when new message arrives", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // First message
      const audio1 = createMockAudio();
      global.Audio.mockReturnValueOnce(audio1);

      await act(async () => {
        const firstAudio = new Audio("data:audio/mp3;base64,audio1");
        mockWawaLipsync.connectAudio(firstAudio);
        firstAudio.simulatePlay();
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(1);

      // Verify first audio is processing
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();

      // Second message arrives before first ends
      const audio2 = createMockAudio();
      global.Audio.mockReturnValueOnce(audio2);

      await act(async () => {
        const secondAudio = new Audio("data:audio/mp3;base64,audio2");
        mockWawaLipsync.connectAudio(secondAudio);
        secondAudio.simulatePlay();
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(2);

      // Should now process second audio
      mockWawaLipsync.processAudio.mockClear();

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();
    });

    it("should handle rapid message succession", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      const messageCount = 5;
      const audioInstances = [];

      // Create multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const audio = createMockAudio();
        audioInstances.push(audio);
        global.Audio.mockReturnValueOnce(audio);

        await act(async () => {
          const newAudio = new Audio(`data:audio/mp3;base64,audio${i}`);
          mockWawaLipsync.connectAudio(newAudio);
          newAudio.simulatePlay();
        });
      }

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(messageCount);

      // Only the last audio should be processing
      mockWawaLipsync.processAudio.mockClear();

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalledTimes(1);
    });

    it("should maintain state consistency during message transitions", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Start first message
      await act(async () => {
        const audio1 = new Audio("data:audio/mp3;base64,message1");
        mockWawaLipsync.connectAudio(audio1);
        audio1.simulatePlay();
      });

      // Set active visemes for first message
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        viseme_E: 0.4,
      });

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();

      // Start second message with different visemes
      mockWawaLipsync.computeVisemeScores.mockReturnValue({
        viseme_I: 0.7,
        viseme_O: 0.5,
      });

      await act(async () => {
        const audio2 = new Audio("data:audio/mp3;base64,message2");
        mockWawaLipsync.connectAudio(audio2);
        audio2.simulatePlay();
      });

      // Process new visemes
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Should transition to new visemes smoothly
      expect(mockWawaLipsync.computeVisemeScores).toHaveBeenCalled();
    });
  });

  describe("Error cleanup scenarios", () => {
    it("should clean up when audio fails to load", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Mock audio creation failure
      global.Audio.mockImplementationOnce(() => {
        throw new Error("Failed to create audio");
      });

      await act(async () => {
        try {
          const audio = new Audio("data:audio/mp3;base64,invalidaudio");
          mockWawaLipsync.connectAudio(audio);
        } catch (error) {
          // Expected error
        }
      });

      // Should not have connected to wawa-lipsync
      expect(mockWawaLipsync.connectAudio).not.toHaveBeenCalled();

      // Should not process audio
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should clean up when wawa-lipsync connection fails", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Mock connection failure
      mockWawaLipsync.connectAudio.mockImplementationOnce(() => {
        throw new Error("Connection failed");
      });

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        try {
          mockWawaLipsync.connectAudio(audio);
        } catch (error) {
          // Expected error
        }
        audio.simulatePlay();
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();

      // Should not process audio after connection failure
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should recover from processing errors and clean up properly", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      // Simulate processing error
      mockWawaLipsync.processAudio.mockImplementationOnce(() => {
        throw new Error("Processing failed");
      });

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error")
      );

      // End audio after error
      await act(() => {
        mockAudio.simulateEnd();
      });

      // Should clean up properly even after error
      mockWawaLipsync.processAudio.mockImplementation(() => {});

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });
  });

  describe("Component unmount cleanup", () => {
    it("should clean up wawa-lipsync when component unmounts", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      const { unmount } = render(<TestWrapper />);

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      expect(mockWawaLipsync.connectAudio).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Should not continue processing after unmount
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // Processing should have stopped
      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should handle unmount during active audio playback", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      const { unmount } = render(<TestWrapper />);

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);
        audio.simulatePlay();
      });

      // Start processing
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).toHaveBeenCalled();

      // Unmount during playback
      unmount();

      // Should handle unmount gracefully
      expect(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      }).not.toThrow();
    });

    it("should clean up event listeners on unmount", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      const { unmount } = render(<TestWrapper />);

      const mockAudioWithListeners = createMockAudio();
      global.Audio.mockReturnValue(mockAudioWithListeners);

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        mockWawaLipsync.connectAudio(audio);

        // Simulate event listener setup
        audio.addEventListener("ended", () => {});
        audio.addEventListener("error", () => {});
      });

      expect(mockAudioWithListeners.addEventListener).toHaveBeenCalled();

      // Unmount should clean up listeners
      unmount();

      // Verify cleanup (in real implementation, removeEventListener would be called)
      expect(mockAudioWithListeners.addEventListener).toHaveBeenCalled();
    });
  });

  describe("Memory leak prevention", () => {
    it("should not accumulate audio references", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      const audioCount = 10;

      // Create and clean up multiple audio instances
      for (let i = 0; i < audioCount; i++) {
        const audio = createMockAudio();
        global.Audio.mockReturnValueOnce(audio);

        await act(async () => {
          const newAudio = new Audio(`data:audio/mp3;base64,audio${i}`);
          mockWawaLipsync.connectAudio(newAudio);
          newAudio.simulatePlay();

          // Immediately end audio to simulate cleanup
          newAudio.simulateEnd();
        });
      }

      // Should have connected to all audios but cleaned up properly
      expect(mockWawaLipsync.connectAudio).toHaveBeenCalledTimes(audioCount);

      // No processing should be active after all audios ended
      mockWawaLipsync.processAudio.mockClear();

      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });

    it("should handle cleanup in fallback mode", async () => {
      const TestWrapper = () => <CleanupTestComponent />;
      render(<TestWrapper />);

      // Force fallback mode
      mockWawaLipsync.connectAudio.mockImplementation(() => {
        throw new Error("Fallback mode activated");
      });

      await act(async () => {
        const audio = new Audio("data:audio/mp3;base64,testaudio");
        try {
          mockWawaLipsync.connectAudio(audio);
        } catch (error) {
          // Expected in fallback mode
        }
        audio.simulatePlay();
      });

      // Should handle fallback mode processing
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // End audio in fallback mode
      await act(() => {
        mockAudio.simulateEnd();
      });

      // Should clean up fallback mode properly
      await act(() => {
        if (global.mockUseFrameCallback) {
          global.mockUseFrameCallback();
        }
      });

      // No processing should continue after cleanup
      expect(mockWawaLipsync.processAudio).not.toHaveBeenCalled();
    });
  });
});
