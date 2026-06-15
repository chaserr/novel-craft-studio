/* shared between main and renderer */

export type ProviderId = 'openai' | 'anthropic' | 'deepseek';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProjectMeta {
  rootPath: string;
  bookTitle: string;
  hasRtk: boolean;
}

export interface ProjectFileEntry {
  path: string;            // absolute path
  relPath: string;         // relative to project root
  name: string;
  category:
    | 'rtk'
    | 'outline'
    | 'chapter-outline'
    | 'recap'
    | 'foreshadow'
    | 'quotes'
    | 'character'
    | 'craft'
    | 'review'
    | 'chapter'
    | 'other';
  isDir: boolean;
}

export interface NewProjectFields {
  bookTitle: string;
  genre: string;
  targetReader: string;
  coreTone: string[];       // ≤5
  mainCharacters: string;   // free text, multi-line
  platform: string;
  scale: string;
  multiverse: boolean;
}

export interface AppSettings {
  novelCraftPath: string;
  activeProvider: ProviderId;
  models: Record<ProviderId, string>;
}

export interface LlmStreamRequest {
  requestId: string;
  provider: ProviderId;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}

export interface LlmStreamEvent {
  requestId: string;
  type: 'chunk' | 'done' | 'error';
  delta?: string;
  message?: string;
}
