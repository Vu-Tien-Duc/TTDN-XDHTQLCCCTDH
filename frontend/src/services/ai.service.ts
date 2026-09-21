import { axiosClient } from '../api/axiosClient';
import { ApiResponse } from '../types';

export interface AiChatAmbiguousMatch {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentName: string;
}

export interface AiChatResponseData {
  question: string;
  answer: string;
  intent?: string;
  dateRange?: {
    from?: string;
    to?: string;
    label?: string;
  };
  targetUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  department?: {
    id: string;
    name: string;
  } | null;
  statistics?: any;
  isAmbiguous?: boolean;
  matches?: AiChatAmbiguousMatch[];
  unauthorized?: boolean;
  timestamp: string;
}

export const aiService = {
  /**
   * Gửi câu hỏi đến Trợ lý AI Chấm công & Giảng dạy
   */
  askAiAssistant: async (message: string): Promise<ApiResponse<AiChatResponseData>> => {
    return (await axiosClient.post('/ai/chat', { message })) as unknown as ApiResponse<AiChatResponseData>;
  },
};

export default aiService;
