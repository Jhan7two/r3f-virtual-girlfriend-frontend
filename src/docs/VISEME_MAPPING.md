# Viseme Mapping for wawa-lipsync Integration

## Overview

This document describes the viseme mapping system used to integrate wawa-lipsync with the Avatar component. The mapping translates wawa-lipsync's phoneme analysis into morph target values for realistic lip synchronization.

## Viseme Categories

### Silence and Neutral
- `viseme_sil` - Silence/neutral lip position

### Consonants
- `viseme_PP` - P, B, M sounds (lips closed)
- `viseme_FF` - F, V sounds (lower lip to upper teeth)  
- `viseme_TH` - TH sounds (tongue between teeth)
- `viseme_DD` - D, T, N, L sounds (tongue to roof)
- `viseme_kk` - K, G sounds (back of tongue up)
- `viseme_CH` - CH, J, SH sounds (lips forward)
- `viseme_SS` - S, Z sounds (tongue near roof)
- `viseme_nn` - N, NG sounds (tongue up)
- `viseme_RR` - R sounds (tongue back)

### Vowels
- `viseme_AA` - A sounds (mouth open)
- `viseme_E` - E sounds (mouth slightly open)
- `viseme_I` - I sounds (mouth narrow)
- `viseme_O` - O sounds (lips rounded)
- `viseme_U` - U sounds (lips pursed)

## Mapping Function

The `mapVisemeToMorphTarget()` function provides robust mapping with fallbacks:

1. **Direct mapping** - Exact viseme name match
2. **Case-insensitive lookup** - Handles different case formats
3. **Base viseme extraction** - Strips `viseme_` prefix for alternative formats
4. **Phoneme fallbacks** - Maps individual phonemes to appropriate visemes

## Testing

### Manual Testing
Use the Leva controls in development:
- `testVisemeMapping` - Validates all mapping functions
- `testVisemeSequence` - Plays sample "Hello World" sequence

### Programmatic Testing
```javascript
import { testVisemeMapping } from '../utils/visemeTest';

// Run comprehensive test
const results = testVisemeMapping(visemeMapping, mapVisemeToMorphTarget);
console.log(`Tests: ${results.passed} passed, ${results.failed} failed`);
```

## Integration with wawa-lipsync

The mapping integrates with wawa-lipsync in the `useFrame` hook:

```javascript
// Get viseme scores from wawa-lipsync
const visemeScores = wawaLipsyncRef.current.computeVisemeScores(
  currentFeatures,
  averagedFeatures,
  0, // dVolume
  0  // dCentroid
);

// Apply to morph targets
Object.entries(visemeScores).forEach(([viseme, value]) => {
  const morphTarget = mapVisemeToMorphTarget(viseme, value);
  if (morphTarget && value > 0.01) {
    lerpMorphTarget(morphTarget, clampedValue, 0.25);
  }
});
```

## Performance Considerations

- **Threshold filtering** - Only applies visemes with value > 0.01
- **Value clamping** - Ensures values stay within [0, 1] range
- **Smooth interpolation** - Uses lerp for natural transitions
- **Efficient reset** - Only resets unused morph targets

## Backward Compatibility

The old Rhubarb mapping (`corresponding` object) is maintained for transition period:

```javascript
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk", 
  C: "viseme_I",
  // ... etc
};
```

## Troubleshooting

### Common Issues

1. **Missing morph targets** - Check 3D model has required viseme morph targets
2. **No lipsync movement** - Verify audio is connected to wawa-lipsync
3. **Jerky animations** - Adjust lerp speed in `lerpMorphTarget` calls
4. **Performance issues** - Reduce `fftSize` or `historySize` in Lipsync config

### Debug Logging

Enable development logging to see active visemes:
```javascript
if (process.env.NODE_ENV === 'development') {
  console.log('🎤 Active visemes:', activeVisemes.join(', '));
}
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.2** - wawa-lipsync controls morph targets automatically
- **6.4** - Compatible with existing morph target system
- **2.1** - Real-time processing in frontend
- **2.2** - Accurate synchronization with audio playback