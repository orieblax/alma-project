export interface UserProfile {
  id: number;
  avatar_url: string;
  github_id: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  profile?: UserProfile;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Chatbot {
  id: string;
  user?: number;
  user_email?: string;
  name: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
  documents_count: number;
  chunks_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  chatbot: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  chunks_count: number;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  text: string;
  token_count: number;
  created_at: string;
}

export interface PrecisionAtK {
  k: number;
  precision: number;
  relevant_count: number;
  total_evaluated: number;
  threshold: number;
}

export interface SourceCitation {
  source_file: string;
  document_name?: string;
  document_id?: string;
  chunk_id?: string;
  chunk_index?: number;
  score: number;
  initial_score?: number;
  rerank_score?: number;
  is_relevant?: boolean;
  rank?: number;
  text?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  response_time_ms?: number;
  tokens_used?: number;
  sources?: SourceCitation[];
  precision_at_k?: PrecisionAtK;
  feedback_rating?: number;
  feedback_comment?: string;
  created_at?: string;
}

export interface KPIAnalytics {
  total_chatbots: number;
  active_chatbots: number;
  total_documents: number;
  total_chunks: number;
  total_sessions: number;
  total_queries: number;
  avg_response_time_ms: number;
  satisfaction_score: number;
}

export interface RecentActivityItem {
  id: string;
  chatbot_name: string;
  query: string;
  created_at: string;
}

export interface KPIAnalyticsResponse {
  status: string;
  kpis: KPIAnalytics;
  recent_activity: RecentActivityItem[];
}
