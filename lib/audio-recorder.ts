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

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// FIX: Refactored to use composition over inheritance for EventEmitter
export class AudioRecorder {
  // FIX: Use an internal EventEmitter instance
  private emitter = new EventEmitter();

  // FIX: Expose on/off methods
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;
  
  // Vision Support
  videoTrack: MediaStreamTrack | undefined;
  captureCanvas: OffscreenCanvas | HTMLCanvasElement | undefined;
  captureCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {}

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Navigator mediaDevices not supported. Microphone unavailable.');
      return;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn('Microphone access denied or unavailable. Proceeding in listen-only mode.', e);
        resolve();
        return;
      }
      
      await this.initializeAudioGraph();
      resolve();
      this.starting = null;
    });
  }
  
  // New method for capturing system/tab audio AND video
  async startScreenCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.warn('Screen capture not supported.');
      return;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        this.stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
              // Low FPS is enough for reading subtitles and saving bandwidth
              frameRate: { ideal: 5, max: 10 } 
          }, 
          audio: {
            // @ts-ignore
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            channelCount: 1, 
            sampleRate: 16000
          },
          // @ts-ignore
          systemAudio: 'include',
          surfaceSwitching: 'include',
          monitorTypeSurfaces: 'include'
        });
      } catch (e) {
        console.warn('Screen capture denied.', e);
        resolve();
        return;
      }
      
      if (this.stream.getAudioTracks().length === 0) {
        console.warn('No audio track in screen share. Please select "Share Audio" in the dialog.');
      }
      
      // Setup Video Capture for Vision
      const vidTracks = this.stream.getVideoTracks();
      if (vidTracks.length > 0) {
          this.videoTrack = vidTracks[0];
          // Initialize canvas
          if (typeof OffscreenCanvas !== 'undefined') {
              this.captureCanvas = new OffscreenCanvas(640, 360);
              this.captureCtx = this.captureCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
          } else {
              this.captureCanvas = document.createElement('canvas');
              this.captureCanvas.width = 640;
              this.captureCanvas.height = 360;
              this.captureCtx = (this.captureCanvas as HTMLCanvasElement).getContext('2d');
          }
      }

      await this.initializeAudioGraph();
      resolve();
      this.starting = null;
    });
  }
  
  async captureFrame(): Promise<string | null> {
      if (!this.videoTrack || !this.captureCtx || !this.captureCanvas) return null;
      
      // We need a way to grab the frame. ImageCapture is one way, but drawing a video element is standard.
      // Since we don't have a video element playing the stream in DOM, we create a temp one.
      // Actually, standard practice for efficient stream capture:
      // We need to use ImageCapture API if available, or pipe track to a video element.
      
      try {
          // @ts-ignore - ImageCapture is experimental but supported in Chrome
          if (window.ImageCapture) {
              // @ts-ignore
              const capturer = new ImageCapture(this.videoTrack);
              const bitmap = await capturer.grabFrame();
              this.captureCtx.drawImage(bitmap, 0, 0, this.captureCanvas.width, this.captureCanvas.height);
              
              // Convert to base64 jpeg
              if (this.captureCanvas instanceof OffscreenCanvas) {
                  const blob = await this.captureCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
                  return this.blobToBase64(blob);
              } else {
                  return (this.captureCanvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.6).split(',')[1];
              }
          }
      } catch (e) {
          console.debug('Frame capture failed', e);
      }
      return null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }

  private async initializeAudioGraph() {
    if (!this.stream) return;

    this.audioContext = await audioContext({ sampleRate: this.sampleRate });
    // Check if audio track exists before creating source
    if (this.stream.getAudioTracks().length > 0) {
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        const workletName = 'audio-recorder-worklet';
        const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

        await this.audioContext.audioWorklet.addModule(src);
        this.recordingWorklet = new AudioWorkletNode(
        this.audioContext,
        workletName
        );

        this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
            const arrayBuffer = ev.data.data.int16arrayBuffer;
            if (arrayBuffer) {
                const arrayBufferString = arrayBufferToBase64(arrayBuffer);
                this.emitter.emit('data', arrayBufferString);
            }
        };
        this.source.connect(this.recordingWorklet);

        const vuWorkletName = 'vu-meter';
        await this.audioContext.audioWorklet.addModule(
        createWorketFromSrc(vuWorkletName, VolMeterWorket)
        );
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        this.emitter.emit('volume', ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
    }
    
    this.recording = true;
  }

  stop() {
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      this.videoTrack = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}