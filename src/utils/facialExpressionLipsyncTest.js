/**
 * Visual test utility for facial expression and lipsync integration
 * Provides manual testing tools for developers to verify the integration
 * 
 * Requirements tested:
 * - 6.1: Visual verification of non-interference
 * - 6.2: Manual testing of simultaneous operation
 * - 6.3: Visual validation of smooth blending
 */

// Test scenarios for facial expression and lipsync integration
export const testScenarios = {
  // Basic non-interference tests
  facialExpressionOnly: {
    name: "Facial Expression Only",
    description: "Test facial expressions without lipsync to establish baseline",
    facialExpression: "smile",
    lipsyncActive: false,
    expectedBehavior: "Should see clear smile expression with no mouth movement"
  },
  
  lipsyncOnly: {
    name: "Lipsync Only", 
    description: "Test lipsync without facial expressions",
    facialExpression: "default",
    lipsyncActive: true,
    visemeSequence: [
      { viseme: "viseme_AA", value: 0.8, duration: 500 },
      { viseme: "viseme_E", value: 0.6, duration: 400 },
      { viseme: "viseme_I", value: 0.7, duration: 300 },
      { viseme: "viseme_O", value: 0.9, duration: 400 },
      { viseme: "viseme_U", value: 0.5, duration: 300 }
    ],
    expectedBehavior: "Should see mouth movements for vowel sounds with neutral expression"
  },

  // Simultaneous operation tests
  smileWithLipsync: {
    name: "Smile + Lipsync",
    description: "Test smile expression with active lipsync",
    facialExpression: "smile",
    lipsyncActive: true,
    visemeSequence: [
      { viseme: "viseme_PP", value: 0.8, duration: 300 },
      { viseme: "viseme_AA", value: 0.9, duration: 400 },
      { viseme: "viseme_E", value: 0.6, duration: 300 },
      { viseme: "viseme_sil", value: 0.0, duration: 200 }
    ],
    expectedBehavior: "Should maintain smile while showing lipsync movements"
  },

  sadWithLipsync: {
    name: "Sad + Lipsync", 
    description: "Test sad expression with active lipsync",
    facialExpression: "sad",
    lipsyncActive: true,
    visemeSequence: [
      { viseme: "viseme_AA", value: 0.7, duration: 400 },
      { viseme: "viseme_O", value: 0.8, duration: 500 },
      { viseme: "viseme_U", value: 0.6, duration: 300 }
    ],
    expectedBehavior: "Should maintain sad expression (frown, squinted eyes) while showing lipsync"
  },

  surprisedWithLipsync: {
    name: "Surprised + Lipsync",
    description: "Test surprised expression with lipsync",
    facialExpression: "surprised", 
    lipsyncActive: true,
    visemeSequence: [
      { viseme: "viseme_O", value: 1.0, duration: 600 },
      { viseme: "viseme_AA", value: 0.8, duration: 400 },
      { viseme: "viseme_sil", value: 0.0, duration: 300 }
    ],
    expectedBehavior: "Should show wide eyes and raised brows while mouth moves for lipsync"
  },

  // Blending transition tests
  expressionTransition: {
    name: "Expression Transition",
    description: "Test smooth transition between expressions during lipsync",
    transitions: [
      { facialExpression: "default", duration: 1000 },
      { facialExpression: "smile", duration: 2000 },
      { facialExpression: "sad", duration: 2000 },
      { facialExpression: "surprised", duration: 1500 },
      { facialExpression: "default", duration: 1000 }
    ],
    lipsyncActive: true,
    continuousLipsync: [
      { viseme: "viseme_AA", value: 0.6 },
      { viseme: "viseme_E", value: 0.4 },
      { viseme: "viseme_I", value: 0.3 }
    ],
    expectedBehavior: "Should smoothly transition between expressions while maintaining lipsync"
  },

  // Stress tests
  rapidLipsyncChanges: {
    name: "Rapid Lipsync Changes",
    description: "Test rapid viseme changes with facial expression",
    facialExpression: "smile",
    lipsyncActive: true,
    rapidSequence: true,
    visemeSequence: [
      { viseme: "viseme_AA", value: 0.9, duration: 100 },
      { viseme: "viseme_E", value: 0.8, duration: 100 },
      { viseme: "viseme_I", value: 0.7, duration: 100 },
      { viseme: "viseme_O", value: 0.9, duration: 100 },
      { viseme: "viseme_U", value: 0.6, duration: 100 },
      { viseme: "viseme_PP", value: 0.8, duration: 100 },
      { viseme: "viseme_FF", value: 0.7, duration: 100 },
      { viseme: "viseme_sil", value: 0.0, duration: 200 }
    ],
    expectedBehavior: "Should handle rapid changes smoothly without jitter or conflicts"
  }
};

// Utility to run a test scenario
export const runTestScenario = (scenarioName, avatar, lerpMorphTarget) => {
  const scenario = testScenarios[scenarioName];
  if (!scenario) {
    console.error(`❌ Test scenario '${scenarioName}' not found`);
    return;
  }

  console.log(`🧪 Starting test: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description}`);
  console.log(`🎯 Expected: ${scenario.expectedBehavior}`);

  // Set facial expression
  if (avatar && avatar.setFacialExpression) {
    avatar.setFacialExpression(scenario.facialExpression);
  }

  // Handle different test types
  if (scenario.visemeSequence && !scenario.transitions) {
    runVisemeSequence(scenario.visemeSequence, lerpMorphTarget);
  } else if (scenario.transitions) {
    runExpressionTransitions(scenario, avatar, lerpMorphTarget);
  }
};

// Run a sequence of visemes
const runVisemeSequence = (sequence, lerpMorphTarget) => {
  let currentIndex = 0;
  
  const playNext = () => {
    if (currentIndex < sequence.length) {
      const { viseme, value, duration } = sequence[currentIndex];
      
      console.log(`🎭 Playing: ${viseme} = ${value} for ${duration}ms`);
      
      // Apply viseme
      if (lerpMorphTarget) {
        lerpMorphTarget(viseme, value, 1.0);
        
        setTimeout(() => {
          // Return to neutral
          lerpMorphTarget(viseme, 0, 1.0);
          currentIndex++;
          setTimeout(playNext, 50);
        }, duration);
      } else {
        currentIndex++;
        setTimeout(playNext, duration);
      }
    } else {
      console.log("✅ Viseme sequence completed");
    }
  };
  
  playNext();
};

// Run expression transitions
const runExpressionTransitions = (scenario, avatar, lerpMorphTarget) => {
  let currentIndex = 0;
  
  // Start continuous lipsync if specified
  let lipsyncInterval;
  if (scenario.continuousLipsync) {
    lipsyncInterval = setInterval(() => {
      const randomViseme = scenario.continuousLipsync[
        Math.floor(Math.random() * scenario.continuousLipsync.length)
      ];
      
      if (lerpMorphTarget) {
        lerpMorphTarget(randomViseme.viseme, randomViseme.value, 1.0);
        setTimeout(() => {
          lerpMorphTarget(randomViseme.viseme, 0, 1.0);
        }, 200);
      }
    }, 300);
  }
  
  const transitionNext = () => {
    if (currentIndex < scenario.transitions.length) {
      const { facialExpression, duration } = scenario.transitions[currentIndex];
      
      console.log(`😊 Transitioning to: ${facialExpression} for ${duration}ms`);
      
      if (avatar && avatar.setFacialExpression) {
        avatar.setFacialExpression(facialExpression);
      }
      
      currentIndex++;
      setTimeout(transitionNext, duration);
    } else {
      console.log("✅ Expression transition test completed");
      if (lipsyncInterval) {
        clearInterval(lipsyncInterval);
      }
    }
  };
  
  transitionNext();
};

// Comprehensive test suite runner
export const runFullTestSuite = (avatar, lerpMorphTarget) => {
  console.log("🚀 Starting comprehensive facial expression + lipsync test suite");
  
  const testOrder = [
    'facialExpressionOnly',
    'lipsyncOnly', 
    'smileWithLipsync',
    'sadWithLipsync',
    'surprisedWithLipsync',
    'rapidLipsyncChanges',
    'expressionTransition'
  ];
  
  let currentTest = 0;
  
  const runNextTest = () => {
    if (currentTest < testOrder.length) {
      const testName = testOrder[currentTest];
      console.log(`\n📋 Test ${currentTest + 1}/${testOrder.length}: ${testName}`);
      
      runTestScenario(testName, avatar, lerpMorphTarget);
      
      currentTest++;
      
      // Wait between tests
      setTimeout(runNextTest, 5000);
    } else {
      console.log("\n🎉 All tests completed!");
      console.log("📊 Review the visual results and check for:");
      console.log("  ✓ Facial expressions work independently");
      console.log("  ✓ Lipsync works independently"); 
      console.log("  ✓ Both systems work together without interference");
      console.log("  ✓ Smooth transitions between states");
      console.log("  ✓ No jitter or conflicts during rapid changes");
    }
  };
  
  runNextTest();
};

// Performance monitoring for the integration
export const monitorIntegrationPerformance = () => {
  const stats = {
    frameCount: 0,
    totalFrameTime: 0,
    maxFrameTime: 0,
    minFrameTime: Infinity,
    errors: 0,
    startTime: performance.now()
  };
  
  const measureFrame = (frameCallback) => {
    return (...args) => {
      const frameStart = performance.now();
      
      try {
        frameCallback(...args);
        stats.frameCount++;
      } catch (error) {
        stats.errors++;
        console.error("❌ Frame processing error:", error);
      }
      
      const frameTime = performance.now() - frameStart;
      stats.totalFrameTime += frameTime;
      stats.maxFrameTime = Math.max(stats.maxFrameTime, frameTime);
      stats.minFrameTime = Math.min(stats.minFrameTime, frameTime);
      
      // Log performance warnings
      if (frameTime > 16.67) { // 60fps threshold
        console.warn(`⚠️ Slow frame detected: ${frameTime.toFixed(2)}ms`);
      }
    };
  };
  
  const getStats = () => {
    const totalTime = performance.now() - stats.startTime;
    const avgFrameTime = stats.frameCount > 0 ? stats.totalFrameTime / stats.frameCount : 0;
    const fps = stats.frameCount > 0 ? (stats.frameCount / totalTime) * 1000 : 0;
    
    return {
      ...stats,
      avgFrameTime: avgFrameTime.toFixed(2),
      fps: fps.toFixed(1),
      totalTime: totalTime.toFixed(2)
    };
  };
  
  return { measureFrame, getStats };
};

// Debug utilities for troubleshooting
export const debugIntegration = {
  logMorphTargetValues: (morphTargetInfluences, morphTargetDictionary) => {
    console.log("🔍 Current morph target values:");
    
    const visemeTargets = {};
    const expressionTargets = {};
    const otherTargets = {};
    
    Object.entries(morphTargetDictionary).forEach(([name, index]) => {
      const value = morphTargetInfluences[index];
      if (value > 0.01) {
        if (name.startsWith('viseme_')) {
          visemeTargets[name] = value.toFixed(3);
        } else if (['browInnerUp', 'eyeSquint', 'mouthSmile', 'mouthFrown'].some(expr => name.includes(expr))) {
          expressionTargets[name] = value.toFixed(3);
        } else {
          otherTargets[name] = value.toFixed(3);
        }
      }
    });
    
    console.log("  👄 Viseme targets:", visemeTargets);
    console.log("  😊 Expression targets:", expressionTargets);
    console.log("  🎭 Other targets:", otherTargets);
  },
  
  validateBlending: (expectedExpression, activeLipsync, morphTargetInfluences, morphTargetDictionary) => {
    const issues = [];
    
    // Check if facial expression targets are present when expected
    if (expectedExpression && expectedExpression !== 'default') {
      const expressionFound = Object.entries(morphTargetDictionary).some(([name, index]) => {
        return name.includes('brow') || name.includes('eye') || name.includes('mouth');
      });
      
      if (!expressionFound) {
        issues.push("❌ Expected facial expression targets not found");
      }
    }
    
    // Check if lipsync targets are active when expected
    if (activeLipsync) {
      const lipsyncFound = Object.entries(morphTargetDictionary).some(([name, index]) => {
        return name.startsWith('viseme_') && morphTargetInfluences[index] > 0.01;
      });
      
      if (!lipsyncFound) {
        issues.push("❌ Expected lipsync activity not found");
      }
    }
    
    // Check for value bounds
    morphTargetInfluences.forEach((value, index) => {
      if (value < 0 || value > 1) {
        const name = Object.keys(morphTargetDictionary).find(key => morphTargetDictionary[key] === index);
        issues.push(`❌ Invalid morph target value: ${name} = ${value}`);
      }
    });
    
    if (issues.length === 0) {
      console.log("✅ Blending validation passed");
    } else {
      console.log("⚠️ Blending validation issues:");
      issues.forEach(issue => console.log(`  ${issue}`));
    }
    
    return issues.length === 0;
  }
};