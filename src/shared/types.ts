/* shared between main and renderer */

export type ProviderId = 'openai' | 'anthropic' | 'deepseek';

/* ------------------------------------------------------------------------ */
/*                              Chat messages                                */
/* ------------------------------------------------------------------------ */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/* ------------------------------------------------------------------------ */
/*                            Project + chapter                              */
/* ------------------------------------------------------------------------ */

export interface ProjectMeta {
  rootPath: string;
  bookTitle: string;
  hasRtk: boolean;
  volumes: Volume[];
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
  /** Only meaningful for chapter files. 1-based. */
  chapterNumber?: number;
  /** Whether the chapter file actually has body content (not just header). */
  hasContent?: boolean;
}

export interface Volume {
  /** 1-based. */
  index: number;
  title: string;
  /** Inclusive range of chapter numbers in this volume. */
  startChapter: number;
  endChapter: number;
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

/* ------------------------------------------------------------------------ */
/*                           Settings + auth                                 */
/* ------------------------------------------------------------------------ */

/**
 * Token strategy per provider. Resolved in main process each call.
 *  - 'cli'      = read from ~/.codex/auth.json or ~/.claude/.credentials.json
 *  - 'oauth'    = our self-hosted OAuth token in keychain
 *  - 'apikey'   = user-supplied API key in keychain
 *  - 'none'     = nothing available
 */
export type AuthStrategy = 'cli' | 'oauth' | 'apikey' | 'none';

export interface ProviderAuthStatus {
  provider: ProviderId;
  strategy: AuthStrategy;
  /** UI-facing label, e.g. "已登录 (Codex CLI)" / "未配置". */
  label: string;
  /** When did the underlying token expire (epoch ms). Optional. */
  expiresAt?: number;
}

export interface AppSettings {
  novelCraftPath: string;
  activeProvider: ProviderId;
  models: Record<ProviderId, string>;
  /** Preferred token strategy per provider when multiple are available. */
  preferredAuth: Partial<Record<ProviderId, AuthStrategy>>;
}

/* ------------------------------------------------------------------------ */
/*                            LLM streaming                                  */
/* ------------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------------ */
/*                            Workflow engine                                */
/* ------------------------------------------------------------------------ */

export type WorkflowAction =
  | 'write-next'              // 写下一章
  | 'continue'                // 续写本章
  | 'sync'                    // 章末同步
  | 'review'                  // 多角色审稿
  | 'polish'                  // 去 AI 味润色
  | 'draft-rtk'               // AI 起草 RTK
  | 'draft-outline'           // AI 起草小说大纲
  | 'draft-chapter-outline'   // AI 起草章节大纲（前 10 章）
  | 'free-chat';              // 自由询问（Tab 2 用）

/** All 12 novel-* agents from the novel-craft plugin. */
export type AgentRole =
  | 'novel-writer'
  | 'novel-polisher'
  | 'novel-auditor'
  | 'novel-pacer'
  | 'novel-plotter'
  | 'novel-dialogist'
  | 'novel-scene-refiner'
  | 'novel-reader'
  | 'novel-researcher'
  | 'novel-architect'
  | 'novel-memory'
  | 'novel-curator';

export interface RangeChapter {
  type: 'chapter';
}
export interface RangeMulti {
  type: 'multi';
  chapterNumbers: number[];
}
export interface RangeVolume {
  type: 'volume';
  volumeIndex: number;
}
export interface RangeBook {
  type: 'book';
}
export type WorkflowRange = RangeChapter | RangeMulti | RangeVolume | RangeBook;

export interface WorkflowConfig {
  action: WorkflowAction;
  roles: AgentRole[];
  range: WorkflowRange;
  provider: ProviderId;
  model: string;
}

/** A single agent's running stream during a multi-role workflow. */
export interface WorkflowSubtask {
  id: string;
  role: AgentRole;
  status: 'pending' | 'running' | 'done' | 'error';
  output: string;
  error?: string;
}

export interface WorkflowRunRequest {
  requestId: string;
  config: WorkflowConfig;
  /** Chapter file paths to feed into the LLM (already resolved from range). */
  chapterPaths: string[];
  /** The project root (so main can read RTK/outline/etc). */
  projectRoot: string;
  /** novel-craft local path for agent system prompts. */
  novelCraftPath: string;
}

export interface WorkflowEvent {
  requestId: string;
  type: 'subtask-chunk' | 'subtask-done' | 'subtask-error' | 'workflow-done' | 'workflow-error';
  subtaskId?: string;
  role?: AgentRole;
  delta?: string;
  message?: string;
}

/* ------------------------------------------------------------------------ */
/*                           Workflow results                                */
/* ------------------------------------------------------------------------ */

/** What the user sees in the center pane after a workflow runs. */
export type WorkflowResult =
  | { kind: 'review'; subtasks: WorkflowSubtask[]; summary?: string; reportPath?: string }
  | { kind: 'polish'; original: string; revised: string; targetPath: string }
  | { kind: 'sync'; preview: SyncPreview; targetPaths: SyncTargets }
  | { kind: 'write'; chapterPath: string; content: string };

export interface SyncPreview {
  recapEntry?: string;
  foreshadowChanges?: string[];
  quotesCandidates?: string[];
  characterUpdates?: { name: string; diff: string }[];
}

export interface SyncTargets {
  recap: string;
  foreshadow: string;
  quotes: string;
  characters: string;
}

export interface AgentMeta {
  id: AgentRole;
  /** 类传统编辑岗的中文名 */
  label: string;
  /** 一句话职责描述（UI 上的 tooltip） */
  shortDescription: string;
}

/* ------------------------------------------------------------------------ */
/*                            Chat sessions                                  */
/* ------------------------------------------------------------------------ */

/** Persisted multi-turn chat session (Codex-style). One JSON file per session. */
export interface ChatSession {
  id: string;
  /** Auto-generated from first user message; user can rename. */
  title: string;
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  /** Optional: bind a session to a project root for context injection. */
  projectRoot?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  provider: ProviderId;
  messageCount: number;
  updatedAt: number;
}
