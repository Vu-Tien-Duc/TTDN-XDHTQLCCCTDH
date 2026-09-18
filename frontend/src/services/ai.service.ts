import { axiosClient } from '../api/axiosClient';
import { ApiResponse } from '../types';

export interface AiChatResponseData {
  question: string;
  answer: string;
  timestamp: string;
}

export const aiService = {
  /**
   * Gửi câu hỏi đến Trợ lý Thanh tra đào tạo Gemini AI
   */
  askAiAssistant: async (question: string): Promise<ApiResponse<AiChatResponseData>> => {
    return (await axiosClient.post('/ai/chat', { question })) as unknown as ApiResponse<AiChatResponseData>;
  },
};

export default aiService;
