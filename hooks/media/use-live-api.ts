/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { AudioRecorder } from '../../lib/audio-recorder';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings } from '@/lib/state';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  connectWithScreenAudio: () => Promise<void>; // New method
  disconnect: () => void;
  connected: boolean;

  volume: number;
  isVolumeEnabled: boolean;
  setIsVolumeEnabled: (isEnabled: boolean) => void;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model, backgroundPadEnabled, backgroundPadVolume } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  const [volume, setVolume] = useState(0);
  const [isVolumeEnabled, setIsVolumeEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        // Apply initial volume state
        audioStreamerRef.current.gainNode.gain.value = isVolumeEnabled ? 1 : 0;
        
        // Sync initial pad state
        if (backgroundPadEnabled) {
          audioStreamerRef.current.startPad(backgroundPadVolume);
        }

        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  // Sync background pad settings
  useEffect(() => {
    if (!audioStreamerRef.current) return;
    
    if (backgroundPadEnabled) {
      audioStreamerRef.current.startPad(backgroundPadVolume);
    } else {
      audioStreamerRef.current.stopPad();
    }
  }, [backgroundPadEnabled]);

  useEffect(() => {
    if (audioStreamerRef.current && backgroundPadEnabled) {
      audioStreamerRef.current.setPadVolume(backgroundPadVolume);
    }
  }, [backgroundPadVolume]);

  // Sync volume enabled state with gain node
  useEffect(() => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.gainNode.gain.value = isVolumeEnabled ? 1 : 0;
    }
  }, [isVolumeEnabled]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    const onToolCall = (toolCall: LiveServerToolCall) => {
      const functionResponses: any[] = [];

      for (const fc of toolCall.functionCalls) {
        const triggerMessage = `Triggering function call: **${
          fc.name
        }**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: triggerMessage,
          isFinal: true,
        });

        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: 'ok' },
        });
      }

      if (functionResponses.length > 0) {
        const responseMessage = `Function call response:\n\`\`\`json\n${JSON.stringify(
          functionResponses,
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
    };
  }, [client]);

  // Standard Connect (Mic or Default)
  const connect = useCallback(async () => {
    if (!config) throw new Error('config has not been set');
    
    // Disconnect previous session
    client.disconnect();
    
    // Resume audio context
    if (audioStreamerRef.current) {
      try {
        await audioStreamerRef.current.resume();
        if (backgroundPadEnabled) {
          audioStreamerRef.current.startPad(backgroundPadVolume);
        }
      } catch (e) {
        console.warn('Failed to resume audio context:', e);
      }
    }

    await client.connect(config);
  }, [client, config, backgroundPadEnabled, backgroundPadVolume]);

  // Screen/Tab Audio Connect
  const connectWithScreenAudio = useCallback(async () => {
    if (!config) throw new Error('config has not been set');
    client.disconnect();

    if (audioStreamerRef.current) {
        try {
          await audioStreamerRef.current.resume();
          if (backgroundPadEnabled) {
            audioStreamerRef.current.startPad(backgroundPadVolume);
          }
        } catch (e) { console.warn(e); }
    }

    // Init Audio Recorder with Screen Capture
    const recorder = new AudioRecorder();
    audioRecorderRef.current = recorder;
    
    // Start Screen Capture
    await recorder.startScreenCapture();

    // Hook up listener
    const onData = (base64: string) => {
       client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
    };
    recorder.on('data', onData);
    
    // Connect to Client
    await client.connect(config);
  }, [client, config, backgroundPadEnabled, backgroundPadVolume]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
    }
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connect,
    connectWithScreenAudio,
    disconnect,
    connected,
    volume,
    isVolumeEnabled,
    setIsVolumeEnabled,
  };
}