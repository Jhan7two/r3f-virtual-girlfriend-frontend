import { vi } from 'vitest'

// Mock Three.js
vi.mock('three', () => ({
  MathUtils: {
    lerp: (a, b, t) => a + (b - a) * t
  }
}))

// Mock wawa-lipsync
vi.mock('wawa-lipsync', () => ({
  Lipsync: vi.fn().mockImplementation(() => ({
    connectAudio: vi.fn(),
    processAudio: vi.fn(),
    features: {},
    getAveragedFeatures: vi.fn(() => ({})),
    computeVisemeScores: vi.fn(() => ({}))
  }))
}))

// Setup global mocks
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}