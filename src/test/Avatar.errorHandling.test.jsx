/**
 * Integration test for Avatar component error handling
 * Tests that the Avatar component gracefully handles lipsync errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import React from 'react';

// Mock the useChat hook
vi.mock('../hooks/useChat', () => ({
  useChat: vi.fn(() => ({
    message: null,
    onMessagePlayed: vi.fn(),
    chat: vi.fn()
  }))
}));

// Mock GLTF loading
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
        morphTargetDictionary: {
          'viseme_AA': 0,
          'viseme_E': 1,
          'viseme_I': 2,
          'viseme_O': 3,
          'viseme_U': 4,
          'eyeBlinkLeft': 5,
          'eyeBlinkRight': 6
        },
        morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0]
      },
      EyeRight: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: {},
        morphTargetInfluences: []
      },
      Wolf3D_Head: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: {},
        morphTargetInfluences: []
      },
      Wolf3D_Teeth: { 
        geometry: {}, 
        skeleton: {},
        morphTargetDictionary: {},
        morphTargetInfluences: []
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
    scene: {
      traverse: vi.fn((callback) => {
        // Mock traversing scene with a skinned mesh
        callback({
          isSkinnedMesh: true,
          morphTargetDictionary: {
            'viseme_AA': 0,
            'viseme_E': 1,
            'viseme_I': 2
          },
          morphTargetInfluences: [0, 0, 0]
        });
      })
    }
  })),
  useAnimations: vi.fn(() => ({
    actions: {
      Idle: {
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

// Mock wawa-lipsync with error scenarios
vi.mock('wawa-lipsync', () => ({
  Lipsync: vi.fn()
}));

// Import Avatar after mocks are set up
import { Avatar } from '../components/Avatar';
import { Lipsync } from 'wawa-lipsync';
import { useChat } from '../hooks/useChat';

describe('Avatar Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset console mocks
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Setup default successful Lipsync mock
    vi.mocked(Lipsync).mockImplementation(() => ({
      connectAudio: vi.fn(),
      processAudio: vi.fn(),
      features: { test: 'data' },
      getAveragedFeatures: vi.fn(() => ({ averaged: 'data' })),
      computeVisemeScores: vi.fn(() => ({
        viseme_AA: 0.5,
        viseme_E: 0.3
      }))
    }));
    
    // Setup default useChat mock
    vi.mocked(useChat).mockReturnValue({
      message: null,
      onMessagePlayed: vi.fn(),
      chat: vi.fn()
    });
  });

  it('should render without crashing when lipsync initialization fails', () => {
    // Mock Lipsync constructor to throw error
    vi.mocked(Lipsync).mockImplementation(() => {
      throw new Error('AudioContext initialization failed');
    });

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();

    // Should log the error
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle browser compatibility issues gracefully', () => {
    // Remove Web Audio API support
    const originalAudioContext = global.window?.AudioContext;
    delete global.window?.AudioContext;
    delete global.window?.webkitAudioContext;

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();

    // Should warn about browser support
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Browser not supported')
    );

    // Restore
    if (originalAudioContext) {
      global.window.AudioContext = originalAudioContext;
    }
  });

  it('should continue working when audio connection fails', () => {
    // Mock successful initialization but failed audio connection
    const mockInstance = {
      connectAudio: vi.fn(() => {
        throw new Error('Failed to connect audio source');
      }),
      processAudio: vi.fn(),
      features: {},
      getAveragedFeatures: vi.fn(() => ({})),
      computeVisemeScores: vi.fn(() => ({}))
    };
    
    vi.mocked(Lipsync).mockImplementation(() => mockInstance);

    // Mock a message to trigger audio connection
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

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();

    // Should log the connection error but continue
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to connect audio')
    );
  });

  it('should use fallback animation when processing fails', () => {
    // Mock processing to fail
    const mockInstance = {
      connectAudio: vi.fn(),
      processAudio: vi.fn(() => {
        throw new Error('Processing failed');
      }),
      features: {},
      getAveragedFeatures: vi.fn(() => ({})),
      computeVisemeScores: vi.fn(() => ({}))
    };
    
    vi.mocked(Lipsync).mockImplementation(() => mockInstance);

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();

    // Component should still render and function
  });

  it('should handle invalid audio data gracefully', () => {
    // Mock message with invalid audio
    vi.mocked(useChat).mockReturnValue({
      message: {
        text: 'Hello',
        audio: 'invalid-base64-data',
        animation: 'Talking_1',
        facialExpression: 'smile'
      },
      onMessagePlayed: vi.fn(),
      chat: vi.fn()
    });

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();
  });

  it('should recover from temporary errors', async () => {
    let callCount = 0;
    
    // Mock to fail first time, succeed second time
    vi.mocked(Lipsync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Temporary initialization error');
      }
      return {
        connectAudio: vi.fn(),
        processAudio: vi.fn(),
        features: {},
        getAveragedFeatures: vi.fn(() => ({})),
        computeVisemeScores: vi.fn(() => ({}))
      };
    });

    expect(() => {
      render(
        <Canvas>
          <Avatar />
        </Canvas>
      );
    }).not.toThrow();

    // Should attempt recovery
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Attempting recovery')
    );
  });
});