/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

export type Template = 'eburon-tts';
export type Theme = 'light' | 'dark';
export type VoiceStyle = 'natural' | 'breathy' | 'dramatic';

const generateSystemPrompt = (language: string, mediaTitle: string = '') => `
ROLE: Simultaneous Interpreter & Vision-Aware Narrator
TARGET LANGUAGE: [${language || 'Auto-Detect (Match Context)'}]
INPUT SOURCE: Audio-Visual Stream (Screen Capture + Audio)
CONTEXT: ${mediaTitle ? `Content Title: "${mediaTitle}"` : 'General Media'}

OBJECTIVE:
1. **WATCH & LISTEN**: You are receiving both AUDIO and VIDEO frames.
   - **VISUAL CUES**: Look for **Subtitles/Captions** on screen. Use them as the ground truth for names, spelling, and dialogue if audio is unclear.
   - **SCENE ANALYSIS**: Analyze the visual scene (facial expressions, setting) to inform your tone.

2. **INTERPRET**:
   - Translate the spoken content or on-screen captions into [${language || 'the target language'}] immediately.
   - **Sync**: Try to match the speaking pace of the source.

3. **VOICE ACTING**:
   - Do not sound robotic. Be a "Voice Actor" dubbing the video.
   - If the source laughs, you sound amused. If they are serious, you are authoritative.

CRITICAL:
- If you see captions, prioritize reading/translating them to ensure accuracy.
- Do not describe the video ("I see a man..."). Just **speak for them**.
`;

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  voiceStyle: VoiceStyle;
  language: string;
  mediaUrl: string;
  mediaTitle: string;
  backgroundPadEnabled: boolean;
  backgroundPadVolume: number;
  sourceVolume: number; // 0-100 for YouTube IFrame
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceStyle: (style: VoiceStyle) => void;
  setLanguage: (language: string) => void;
  setMediaUrl: (url: string) => void;
  setMediaTitle: (title: string) => void;
  setBackgroundPadEnabled: (enabled: boolean) => void;
  setBackgroundPadVolume: (volume: number) => void;
  setSourceVolume: (volume: number) => void;
}>(set => ({
  language: '',
  mediaTitle: '',
  systemPrompt: generateSystemPrompt('', ''),
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  voiceStyle: 'breathy',
  mediaUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk?si=Fv6Xn-Gj8HqQo-fM', 
  backgroundPadEnabled: false,
  backgroundPadVolume: 0.2,
  sourceVolume: 50,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setVoiceStyle: voiceStyle => set({ voiceStyle }),
  setLanguage: language => set(state => ({ 
    language, 
    systemPrompt: generateSystemPrompt(language, state.mediaTitle) 
  })),
  setMediaUrl: url => set({ mediaUrl: url }),
  setMediaTitle: title => set(state => ({ 
    mediaTitle: title, 
    systemPrompt: generateSystemPrompt(state.language, title) 
  })),
  setBackgroundPadEnabled: enabled => set({ backgroundPadEnabled: enabled }),
  setBackgroundPadVolume: volume => set({ backgroundPadVolume: volume }),
  setSourceVolume: volume => set({ sourceVolume: volume }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleTheme: () => void;
}>(set => ({
  isSidebarOpen: false, 
  theme: 'dark',
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: [], 
  template: 'eburon-tts',
  setTemplate: (template: Template) => {
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system' | 'model';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));