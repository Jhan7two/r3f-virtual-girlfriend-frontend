# Lipsync Error Handling Documentation

## Overview

This document describes the comprehensive error handling system implemented for wawa-lipsync integration in the Avatar component. The system provides graceful degradation, fallback behaviors, and recovery mechanisms to ensure the avatar continues functioning even when lipsync fails.

## Error Handling Features

### 1. Browser Compatibility Detection

The system automatically detects browser support for Web Audio API and related features:

```javascript
import { detectBrowserSupport } from '../utils/lipsyncErrorHandler';

const support = detectBrowserSupport();
if (!support.isSupported) {
  console.warn("Browser not supported:", support.missingFeatures);
  // Enable fallback mode
}
```

**Supported Features Checked:**
- Web Audio API (AudioContext)
- MediaStream API
- AnalyserNode creation
- Browser-specific compatibility (Safari, Firefox, Mobile)

### 2. Error Categorization

Errors are automatically categorized for appropriate handling:

```javascript
import { categorizeError, LIPSYNC_ERROR_TYPES } from '../utils/lipsyncErrorHandler';

const errorType = categorizeError(error);
// Returns one of: INITIALIZATION_FAILED, AUDIO_CONNECTION_FAILED, 
// PROCESSING_ERROR, BROWSER_UNSUPPORTED, CONTEXT_ERROR, UNKNOWN_ERROR
```

### 3. Recovery Strategies

Each error type has a specific recovery strategy:

```javascript
import { getRecoveryStrategy } from '../utils/lipsyncErrorHandler';

const strategy = getRecoveryStrategy(errorType);
// Returns: { delay, maxRetries, fallbackConfig, description }
```

**Recovery Strategies:**
- **Initialization Failed**: Retry with reduced settings (3 attempts)
- **Audio Connection Failed**: Retry connection (2 attempts)
- **Processing Error**: Skip frame and continue (1 attempt)
- **Context Error**: Reinitialize with minimal settings (2 attempts)
- **Browser Unsupported**: Use fallback animation permanently (0 retries)

### 4. Fallback Animation System

When wawa-lipsync fails, the system provides a simple oscillating mouth animation:

```javascript
import { generateFallbackLipsync } from '../utils/lipsyncErrorHandler';

const fallbackVisemes = generateFallbackLipsync(audioElement, 0.5);
// Returns: { viseme_AA: 0.35, viseme_E: 0.15, viseme_I: 0.1, viseme_O: 0.2 }
```

### 5. Performance Monitoring

The system tracks performance metrics and warns about issues:

```javascript
import { LipsyncPerformanceMonitor } from '../utils/lipsyncErrorHandler';

const monitor = new LipsyncPerformanceMonitor();
const startTime = monitor.startTiming();
// ... processing ...
monitor.endTiming(startTime, 'wawa-lipsync processing');

const stats = monitor.getStats();
// Returns: { averageProcessingTime, errorRate, totalErrors, totalSuccesses, lastError }
```

## Implementation in Avatar Component

### State Management

The Avatar component maintains error handling state:

```javascript
const [lipsyncError, setLipsyncError] = useState(null);
const [browserSupported, setBrowserSupported] = useState(true);
const [fallbackMode, setFallbackMode] = useState(false);
const [retryCount, setRetryCount] = useState(0);
```

### Initialization with Error Handling

```javascript
useEffect(() => {
  // Check browser compatibility
  const supported = checkBrowserSupport();
  setBrowserSupported(supported);
  
  if (!supported) {
    setFallbackMode(true);
    return;
  }
  
  try {
    wawaLipsyncRef.current = new Lipsync({
      fftSize: 1024,
      historySize: 8
    });
    setLipsyncError(null);
    setFallbackMode(false);
  } catch (error) {
    logLipsyncError(error, "initialization");
    setLipsyncError(error.message);
    setFallbackMode(true);
    
    // Attempt recovery based on error type
    const errorType = categorizeError(error);
    const strategy = getRecoveryStrategy(errorType);
    
    if (retryCount < strategy.maxRetries) {
      setTimeout(() => {
        // Retry with fallback configuration
        setRetryCount(prev => prev + 1);
        // ... retry logic
      }, strategy.delay);
    }
  }
}, []);
```

### Audio Processing with Error Handling

```javascript
// In useFrame hook
if (wawaLipsyncRef.current && audioRef.current && !fallbackMode) {
  try {
    wawaLipsyncRef.current.processAudio();
    const visemeScores = wawaLipsyncRef.current.computeVisemeScores(
      currentFeatures,
      averagedFeatures,
      0, 0
    );
    
    // Apply viseme values
    Object.entries(visemeScores).forEach(([viseme, value]) => {
      const morphTarget = mapVisemeToMorphTarget(viseme);
      if (morphTarget) {
        applyVisemeValue(morphTarget, value, scene);
      }
    });
    
  } catch (error) {
    logLipsyncError(error, "processing");
    setLipsyncError(error.message);
    
    // Enable temporary fallback mode
    const errorType = categorizeError(error);
    if (errorType === LIPSYNC_ERROR_TYPES.PROCESSING_ERROR) {
      setFallbackMode(true);
      setTimeout(() => {
        setFallbackMode(false);
        setLipsyncError(null);
      }, 2000);
    }
  }
} else if (fallbackMode && audioRef.current) {
  // Use fallback animation
  const fallbackVisemes = generateFallbackLipsync(audioRef.current, 0.5);
  Object.entries(fallbackVisemes).forEach(([viseme, value]) => {
    const morphTarget = mapVisemeToMorphTarget(viseme);
    if (morphTarget) {
      applyVisemeValue(morphTarget, value, scene, 0.2);
    }
  });
}
```

## Debug Controls

The Avatar component includes debug controls for testing error handling:

```javascript
useControls("Lipsync Status", {
  browserSupported: { value: browserSupported, disabled: true },
  fallbackMode: { value: fallbackMode, disabled: true },
  lipsyncError: { value: lipsyncError || "None", disabled: true },
  retryCount: { value: retryCount, disabled: true },
  resetLipsync: button(() => {
    // Manual reset functionality
  }),
  toggleFallback: button(() => {
    setFallbackMode(!fallbackMode);
  }),
  testBrowserSupport: button(() => {
    const supported = checkBrowserSupport();
    setBrowserSupported(supported);
  }),
  showPerformanceStats: button(() => {
    const stats = performanceMonitor.current.getStats();
    console.log("Performance Stats:", stats);
  })
});
```

## Testing

### Unit Tests

The error handling utilities are thoroughly tested:

```bash
npm test -- --run src/test/lipsyncErrorHandling.test.js
```

### Integration Tests

Simplified integration tests verify the error handling works correctly:

```bash
npm test -- --run src/test/Avatar.errorHandling.simple.test.js
```

## Error Scenarios Handled

### 1. Browser Incompatibility
- **Scenario**: User opens app in unsupported browser
- **Handling**: Detect missing features, enable fallback mode permanently
- **User Experience**: Avatar works with simple mouth animation

### 2. AudioContext Initialization Failure
- **Scenario**: Browser blocks AudioContext creation
- **Handling**: Retry with reduced settings, fallback if all attempts fail
- **User Experience**: Brief delay, then either recovery or fallback mode

### 3. Audio Connection Failure
- **Scenario**: Cannot connect audio to wawa-lipsync analyzer
- **Handling**: Retry connection, use fallback for current message
- **User Experience**: Current message uses fallback, next message may recover

### 4. Processing Errors
- **Scenario**: wawa-lipsync throws error during audio analysis
- **Handling**: Skip current frame, continue processing
- **User Experience**: Brief interruption, then normal operation resumes

### 5. Performance Issues
- **Scenario**: Lipsync processing takes too long
- **Handling**: Log performance warnings, monitor for degradation
- **User Experience**: Potential frame drops, but system continues

## Best Practices

### 1. Graceful Degradation
- Always provide fallback functionality
- Never let lipsync errors break the entire avatar
- Maintain facial expressions and animations even without lipsync

### 2. User Communication
- Log errors appropriately (console warnings/errors)
- Provide debug controls for development
- Monitor performance metrics

### 3. Recovery Mechanisms
- Implement retry logic with exponential backoff
- Use different strategies for different error types
- Limit retry attempts to prevent infinite loops

### 4. Performance Monitoring
- Track processing times and error rates
- Warn about performance issues
- Provide statistics for debugging

## Configuration

### Error Handling Settings

```javascript
const LIPSYNC_SMOOTHING = {
  ACTIVE_LERP_SPEED: 0.3,     // Speed for transitioning to active visemes
  NEUTRAL_LERP_SPEED: 0.2,    // Speed for returning to neutral
  MIN_THRESHOLD: 0.02,        // Minimum threshold to avoid micro-movements
  MAX_BLEND_VISEMES: 3        // Maximum number of visemes to blend simultaneously
};
```

### Recovery Configuration

```javascript
const recoveryStrategies = {
  [LIPSYNC_ERROR_TYPES.INITIALIZATION_FAILED]: {
    delay: 2000,
    maxRetries: 3,
    fallbackConfig: { fftSize: 512, historySize: 4 }
  },
  // ... other strategies
};
```

## Conclusion

This comprehensive error handling system ensures that the Avatar component remains functional and provides a good user experience even when wawa-lipsync encounters issues. The system is designed to be resilient, recoverable, and maintainable while providing detailed debugging information for development.