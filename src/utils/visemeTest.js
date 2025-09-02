// Test utility for validating viseme mapping
// This file can be used to test the viseme mapping functionality

export const testVisemeMapping = (visemeMapping, mapVisemeToMorphTarget) => {
  console.log("🧪 Starting comprehensive viseme mapping test...");
  
  // Test cases for different viseme formats
  const testCases = [
    // Standard wawa-lipsync visemes
    { input: 'viseme_sil', expected: 'viseme_sil' },
    { input: 'viseme_PP', expected: 'viseme_PP' },
    { input: 'viseme_AA', expected: 'viseme_AA' },
    { input: 'viseme_E', expected: 'viseme_E' },
    { input: 'viseme_I', expected: 'viseme_I' },
    { input: 'viseme_O', expected: 'viseme_O' },
    { input: 'viseme_U', expected: 'viseme_U' },
    
    // Alternative formats
    { input: 'A', expected: 'viseme_AA' },
    { input: 'E', expected: 'viseme_E' },
    { input: 'I', expected: 'viseme_I' },
    { input: 'O', expected: 'viseme_O' },
    { input: 'U', expected: 'viseme_U' },
    
    // Consonant mappings
    { input: 'P', expected: 'viseme_PP' },
    { input: 'B', expected: 'viseme_PP' },
    { input: 'M', expected: 'viseme_PP' },
    { input: 'F', expected: 'viseme_FF' },
    { input: 'V', expected: 'viseme_FF' },
    
    // Edge cases
    { input: 'unknown_viseme', expected: null },
    { input: '', expected: null },
    { input: null, expected: null }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(({ input, expected }, index) => {
    try {
      const result = mapVisemeToMorphTarget(input, 1.0);
      
      if (result === expected) {
        console.log(`✅ Test ${index + 1}: ${input} -> ${result} (PASS)`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${input} -> ${result}, expected ${expected} (FAIL)`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${input} threw error: ${error.message} (ERROR)`);
      failed++;
    }
  });
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  // Test mapping coverage
  const requiredVisemes = ['viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_AA', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'];
  const missingMappings = requiredVisemes.filter(viseme => !visemeMapping[viseme]);
  
  if (missingMappings.length === 0) {
    console.log("✅ All required viseme mappings are present");
  } else {
    console.log("⚠️ Missing required mappings:", missingMappings);
  }
  
  return { passed, failed, missingMappings };
};

// Sample audio test data for manual testing
export const sampleVisemeSequence = [
  { viseme: 'viseme_sil', duration: 200 },
  { viseme: 'viseme_PP', duration: 300 },  // "Hello" - H
  { viseme: 'viseme_E', duration: 200 },   // "Hello" - e
  { viseme: 'viseme_DD', duration: 150 },  // "Hello" - l
  { viseme: 'viseme_O', duration: 300 },   // "Hello" - o
  { viseme: 'viseme_sil', duration: 100 },
  { viseme: 'viseme_U', duration: 250 },   // "World" - W
  { viseme: 'viseme_RR', duration: 200 },  // "World" - r
  { viseme: 'viseme_DD', duration: 150 },  // "World" - l
  { viseme: 'viseme_DD', duration: 200 },  // "World" - d
  { viseme: 'viseme_sil', duration: 300 }
];

export const playVisemeSequence = (sequence, lerpMorphTarget, mapVisemeToMorphTarget) => {
  console.log("🎭 Playing sample viseme sequence...");
  
  let currentIndex = 0;
  
  const playNext = () => {
    if (currentIndex < sequence.length) {
      const { viseme, duration } = sequence[currentIndex];
      const morphTarget = mapVisemeToMorphTarget(viseme, 1.0);
      
      console.log(`Playing: ${viseme} -> ${morphTarget} for ${duration}ms`);
      
      if (morphTarget) {
        lerpMorphTarget(morphTarget, 1.0, 1.0);
        
        setTimeout(() => {
          lerpMorphTarget(morphTarget, 0, 1.0);
          currentIndex++;
          setTimeout(playNext, 50); // Small gap between visemes
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