// Test to verify useChat hook works without lipsync data
import { renderHook, act } from '@testing-library/react';
import { useChat, ChatProvider } from '../hooks/useChat';

// Mock fetch for testing
global.fetch = jest.fn();

describe('useChat Hook - Lipsync Migration', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('should handle messages without lipsync field', async () => {
    // Mock response without lipsync data (new format)
    const mockResponse = {
      messages: [
        {
          text: "Hello world",
          audio: "base64audiodata",
          audioMime: "audio/mpeg",
          facialExpression: "smile",
          animation: "Talking_1"
          // Note: no lipsync field - this should work fine
        }
      ]
    };

    fetch.mockResolvedValueOnce({
      json: async () => mockResponse
    });

    const wrapper = ({ children }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.chat("test message");
    });

    // Verify message was processed correctly without lipsync data
    expect(result.current.message).toEqual(mockResponse.messages[0]);
    expect(result.current.message.lipsync).toBeUndefined();
  });

  test('should handle messages with legacy lipsync field (backward compatibility)', async () => {
    // Mock response with lipsync data (old format) - should still work
    const mockResponse = {
      messages: [
        {
          text: "Hello world",
          audio: "base64audiodata",
          audioMime: "audio/mpeg",
          facialExpression: "smile",
          animation: "Talking_1",
          lipsync: { mouthCues: [] } // Legacy field - should be ignored
        }
      ]
    };

    fetch.mockResolvedValueOnce({
      json: async () => mockResponse
    });

    const wrapper = ({ children }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.chat("test message");
    });

    // Verify message was processed correctly - lipsync field present but not used
    expect(result.current.message).toEqual(mockResponse.messages[0]);
    expect(result.current.message.lipsync).toBeDefined(); // Field exists but not processed
  });
});