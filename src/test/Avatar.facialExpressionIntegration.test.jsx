/**
 * Integration test for Avatar component facial expression and lipsync compatibility
 * Tests that wawa-lipsync and facial expressions work together without interference
 * 
 * Requirements tested:
 * - 6.1: wawa-lipsync doesn't interfere with facial expression morph targets
 * - 6.2: Lipsync and facial expressions work simultaneously
 * - 6.3: Smooth blending between different morph target systems
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import React from 'react';

// Mock the useChat hook
vi.mock('../hooks/useChat', () => ({
  useChat: vi.fn()
}));

// Mock GLTF loading with comprehensive morph target setup
const mockMorphTargetInfluences = {
  // Viseme targets (used by lipsync)
  viseme_AA: 0,
  viseme_E: 1, 
  viseme_I: 2,
  viseme_O: 3,
  viseme_U: 4,
  viseme_PP: 5,
  viseme_FF: 6,
  viseme_sil: 7,
  
  // Facial expression targets (should not conflict)
  browInnerUp: 8,
  eyeSquintLeft: 9,
  eyeSquintRight: 10,
  mouthSmileLeft: 11,
  mouthSmileRight: 12,
  mouthFrownLeft: 13,
  mouthFrownRight: 14,
  eyeBlinkLeft: 15,
  eyeBlinkRight: 16,
  
  // Mixed targets (used by both systems)
  mouthPressLeft: 17,
  mouthPressRight: 18
};

const mockMorphTargetValues = new Array(Object.keys(mockMorphTargetInfluences).length).fill(0);

const mockSkinnedMesh = {
  isSkinnedMesh: true,
  morphTargetDictionary: mockMorphTargetInfluences,
  morphTargetInfluences: mockMorphTargetValues,
  traverse: vi.fn()
};

const mockScene = {
  traverse: vi.fn((callback) => {
    callback(mockSkinnedMesh);
  })
};

vi.mock('@react-three/drei', () => ({
  useGLTF: vi.fn(() => ({
    nodes: {
      Hips: {},
      Wolf3D_Body: { geometry: {}, skeleton: {} },
      Wolf3D_Outfit_Bottom: { geometry: {}, skeleton: {} },
      Wolf3D_Outfit_Footwear: { geometry: {}, skeleton: {} },
      Wolf3D_Outfit_Top: { geometry: {}, skeleton: {} },
      Wolf3D_Hair: { geometry: {}, skeleton: {} },
      EyeLeft: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: mockMorphTargetInfluences,
        morphTargetInfluences: [...mockMorphTargetValues]
      },
      EyeRight: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: mockMorphTargetInfluences,
        morphTargetInfluences: [...mockMorphTargetValues]
      },
      Wolf3D_Head: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: mockMorphTargetInfluences,
        morphTargetInfluences: [...mockMorphTargetValues]
      },
      Wolf3D_Teeth: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: mockMorphTargetInfluences,
        morphTargetInfluences: [...mockMorphTargetValues]
      }
    },
    materials: {
      Wolf3D_Body: {},
      Wolf3D_Outfit_Bottom: {},
      Wolf3D_Outfit_Footwear: {},
      Wolf3D_Outfit_Top: {},
      Wolf3D_Hair: {},
      Wolf3D_Eye: {},
      Wolf3D_Skin: {},
      Wolf3D_Teeth: {}
    },
    scene: mockScene
  })),
  useAnimations: vi.fn(() => ({
    actions: {
      Idle: {
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis()
      },
      Talking_1: {
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis()
      }
    },
    mixer: {
      stats: {
        actions: {
          inUse: 0
        }
      }
    }
  }))
}));

// Mock Leva controls
vi.mock('leva', () => ({
  useControls: vi.fn(() => [vi.fn(), vi.fn()]),
  button: vi.fn((fn) => fn)
}));

// Mock wawa-lipsync with controllable behavior
const mockLipsyncInstance = {
  connectAudio: vi.fn(),
  processAudio: vi.fn(),
  features: { test: 'data' },
  getAveragedFeatures: vi.fn(() => ({ averaged: 'data' })),
  computeVisemeScores: vi.fn(() => ({}))
};

vi.mock('wawa-lipsync', () => ({
  Lipsync: vi.fn(() => mockLipsyncInstance)
}));

// Mock useFrame to control animation loop
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn()
  };
});

// Import Avatar after mocks are set up
import { Avatar } from '../components/Avatar';
import { Lipsync } from 'wawa-lipsync';
import { useFrame } from '@react-three/fiber';
import { useChat } from '../hooks/useChat';

describe('Avatar Facial Expression and Lipsync Integration', () => {
  let frameCallback;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset morph target values
    mockMorphTargetValues.fill(0);
    mockSkinnedMesh.morphTargetInfluences = [...mockMorphTargetValues];
    
    // Setup console mocks
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Setup successful lipsync mock
    vi.mocked(Lipsync).mockImplementation(() => mockLipsyncInstance);
    
    // Capture useFrame callback
    vi.mocked(useFrame).mockImplementation((callback) => {
      frameCallback = callback;
    });
    
    // Setup default useChat mock
    vi.mocked(useChat).mockReturnValue({
      message: null,
      onMessagePlayed: vi.fn(),
      chat: vi.fn()
    });
  });

  afterEach(() => {
    frameCallback = null;
  });

  describe('Requirement 6.1: Non-interference with facial expressions', () => {
    it('should not modify facial expression morph targets when lipsync is inactive', () => {
      // Setup facial expression without lipsync
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Idle',
          facialExpression: 'smile'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock no lipsync activity
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({});

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate frame update
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Verify facial expression targets are applied
      const browInnerUpIndex = mockMorphTargetInfluences.browInnerUp;
      const eyeSquintLeftIndex = mockMorphTargetInfluences.eyeSquintLeft;
      
      expect(mockSkinnedMesh.morphTargetInfluences[browInnerUpIndex]).toBeGreaterThan(0);
      expect(mockSkinnedMesh.morphTargetInfluences[eyeSquintLeftIndex]).toBeGreaterThan(0);
      
      // Verify viseme targets remain neutral
      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBe(0);
    });

    it('should preserve facial expression targets that are not viseme-related', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'smile'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock active lipsync
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        viseme_E: 0.3
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate frame update
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Non-viseme facial expression targets should still be applied
      const browInnerUpIndex = mockMorphTargetInfluences.browInnerUp;
      expect(mockSkinnedMesh.morphTargetInfluences[browInnerUpIndex]).toBeGreaterThan(0);
      
      // Viseme targets should be controlled by lipsync
      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeGreaterThan(0);
    });
  });

  describe('Requirement 6.2: Simultaneous operation', () => {
    it('should blend facial expressions and lipsync when both are active', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'smile'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock active lipsync with viseme that might conflict with facial expression
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.7,
        mouthSmileLeft: 0.4  // This might conflict with smile expression
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate frame update
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Both systems should contribute to the final result
      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      const mouthSmileLeftIndex = mockMorphTargetInfluences.mouthSmileLeft;
      
      expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeGreaterThan(0);
      expect(mockSkinnedMesh.morphTargetInfluences[mouthSmileLeftIndex]).toBeGreaterThan(0);
    });

    it('should maintain eye blinking independently of lipsync and expressions', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'angry'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock active lipsync
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_PP: 0.9
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate frame update
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Eye blinking should work independently
      const eyeBlinkLeftIndex = mockMorphTargetInfluences.eyeBlinkLeft;
      const eyeBlinkRightIndex = mockMorphTargetInfluences.eyeBlinkRight;
      
      // These should be controlled by the blinking system, not lipsync or expressions
      expect(mockSkinnedMesh.morphTargetInfluences[eyeBlinkLeftIndex]).toBeDefined();
      expect(mockSkinnedMesh.morphTargetInfluences[eyeBlinkRightIndex]).toBeDefined();
    });
  });

  describe('Requirement 6.3: Smooth blending between systems', () => {
    it('should smoothly transition when lipsync starts during facial expression', () => {
      // Start with just facial expression
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Idle',
          facialExpression: 'smile'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Initially no lipsync
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({});

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // First frame - only facial expression
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      const mouthSmileLeftIndex = mockMorphTargetInfluences.mouthSmileLeft;
      const initialSmileValue = mockSkinnedMesh.morphTargetInfluences[mouthSmileLeftIndex];
      
      // Now activate lipsync
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8
      });

      // Second frame - lipsync becomes active
      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Facial expression should still be present but potentially blended
      const newSmileValue = mockSkinnedMesh.morphTargetInfluences[mouthSmileLeftIndex];
      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      const visemeValue = mockSkinnedMesh.morphTargetInfluences[visemeAAIndex];
      
      expect(visemeValue).toBeGreaterThan(0); // Lipsync is active
      expect(newSmileValue).toBeGreaterThanOrEqual(0); // Smile is still present or blended
    });

    it('should handle rapid changes in lipsync values smoothly', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'default'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate rapid viseme changes
      const visemeSequence = [
        { viseme_AA: 0.9, viseme_E: 0.0 },
        { viseme_AA: 0.1, viseme_E: 0.8 },
        { viseme_AA: 0.0, viseme_E: 0.0 },
        { viseme_AA: 0.7, viseme_E: 0.2 }
      ];

      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      const visemeEIndex = mockMorphTargetInfluences.viseme_E;
      
      visemeSequence.forEach((visemes, index) => {
        mockLipsyncInstance.computeVisemeScores.mockReturnValue(visemes);
        
        if (frameCallback) {
          act(() => {
            frameCallback();
          });
        }

        // Values should change but remain within valid range
        expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeGreaterThanOrEqual(0);
        expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeLessThanOrEqual(1);
        expect(mockSkinnedMesh.morphTargetInfluences[visemeEIndex]).toBeGreaterThanOrEqual(0);
        expect(mockSkinnedMesh.morphTargetInfluences[visemeEIndex]).toBeLessThanOrEqual(1);
      });
    });

    it('should gracefully handle conflicting morph target values', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'smile' // This sets mouthSmileLeft
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock lipsync that might also affect mouth shape
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,  // Open mouth
        mouthSmileLeft: 0.3  // Potential conflict with smile expression
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Should handle the conflict gracefully without errors
      const mouthSmileLeftIndex = mockMorphTargetInfluences.mouthSmileLeft;
      const visemeAAIndex = mockMorphTargetInfluences.viseme_AA;
      
      expect(mockSkinnedMesh.morphTargetInfluences[mouthSmileLeftIndex]).toBeGreaterThanOrEqual(0);
      expect(mockSkinnedMesh.morphTargetInfluences[mouthSmileLeftIndex]).toBeLessThanOrEqual(1);
      expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeGreaterThanOrEqual(0);
      expect(mockSkinnedMesh.morphTargetInfluences[visemeAAIndex]).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should continue facial expressions when lipsync fails', () => {
      vi.mocked(useChat).mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'sad'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock lipsync failure
      mockLipsyncInstance.computeVisemeScores.mockImplementation(() => {
        throw new Error('Lipsync processing failed');
      });

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      if (frameCallback) {
        act(() => {
          frameCallback();
        });
      }

      // Facial expressions should still work
      const mouthFrownLeftIndex = mockMorphTargetInfluences.mouthFrownLeft;
      expect(mockSkinnedMesh.morphTargetInfluences[mouthFrownLeftIndex]).toBeGreaterThan(0);
    });

    it('should handle missing morph targets gracefully', () => {
      // Remove some morph targets to simulate incomplete model
      const incompleteMorphTargets = { ...mockMorphTargetInfluences };
      delete incompleteMorphTargets.viseme_AA;
      delete incompleteMorphTargets.mouthSmileLeft;
      
      mockSkinnedMesh.morphTargetDictionary = incompleteMorphTargets;

      mockUseChat.mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'smile'
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.8,
        mouthSmileLeft: 0.6
      });

      expect(() => {
        render(
          <Canvas>
            <Avatar />
          </Canvas>
        );

        if (frameCallback) {
          act(() => {
            frameCallback();
          });
        }
      }).not.toThrow();
    });

    it('should maintain performance with complex expressions and lipsync', () => {
      mockUseChat.mockReturnValue({
        message: {
          text: 'Hello',
          audio: 'base64audiodata',
          animation: 'Talking_1',
          facialExpression: 'crazy' // Complex expression with many morph targets
        },
        onMessagePlayed: vi.fn(),
        chat: vi.fn()
      });

      // Mock complex lipsync with multiple active visemes
      mockLipsyncInstance.computeVisemeScores.mockReturnValue({
        viseme_AA: 0.7,
        viseme_E: 0.4,
        viseme_I: 0.2,
        viseme_O: 0.1,
        viseme_PP: 0.3
      });

      const startTime = performance.now();

      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );

      // Simulate multiple frame updates
      for (let i = 0; i < 10; i++) {
        if (frameCallback) {
          act(() => {
            frameCallback();
          });
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 10 frames
    });
  });
});