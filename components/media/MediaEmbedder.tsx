/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { useSettings } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import c from 'classnames';

export default function MediaEmbedder() {
  const { mediaUrl, language, setMediaTitle, sourceVolume } = useSettings();
  const { connected, connectWithScreenAudio } = useLiveAPIContext();
  const [embedSrc, setEmbedSrc] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch Metadata using oEmbed when URL changes
  useEffect(() => {
    if (!mediaUrl) {
        setEmbedSrc('');
        setMediaTitle('');
        return;
    }

    let videoId = '';
    let finalSrc = mediaUrl;

    try {
        if (mediaUrl.includes('youtube.com/watch')) {
            const urlObj = new URL(mediaUrl);
            videoId = urlObj.searchParams.get('v') || '';
        } else if (mediaUrl.includes('youtu.be/')) {
            videoId = mediaUrl.split('youtu.be/')[1];
        } else if (mediaUrl.includes('youtube.com/embed/')) {
            videoId = mediaUrl.split('embed/')[1];
        }
    } catch(e) { console.warn(e); }

    if (videoId) {
        // enablejsapi=1 is critical for volume control (postMessage)
        const origin = window.location.origin;
        finalSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&cc_load_policy=1&hl=${language || 'en'}&enablejsapi=1&origin=${origin}&playsinline=1&rel=0`;

        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        fetch(oembedUrl)
            .then(res => res.json())
            .then(data => {
                if (data && data.title) {
                    setMediaTitle(data.title);
                }
            })
            .catch(err => {
                setMediaTitle('Unknown Video Context');
            });
    } else {
        setMediaTitle('Web Content');
    }

    setEmbedSrc(finalSrc);
  }, [mediaUrl, language, setMediaTitle]);

  // Handle Source Volume Ducking via PostMessage
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow && mediaUrl.includes('youtube')) {
        // Send command to YouTube Player
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [sourceVolume] // 0 - 100
        }), '*');
    }
  }, [sourceVolume, embedSrc]);

  return (
    <div className="media-embedder-wrapper">
      <div className="media-aspect-ratio">
        {embedSrc ? (
            <iframe 
                ref={iframeRef}
                src={embedSrc} 
                className="media-iframe"
                title="Embedded Content"
                frameBorder="0" 
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; microphone" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
            ></iframe>
        ) : (
            <div className="empty-embed">
                <span className="material-symbols-outlined icon">smart_display</span>
                <p>Enter a YouTube URL in Settings</p>
            </div>
        )}
        
        {!connected && embedSrc && (
            <div className="embed-overlay">
                <button className="capture-btn" onClick={connectWithScreenAudio}>
                    <span className="material-symbols-outlined">graphic_eq</span>
                    Start Interpretation (Capture Audio & Vision)
                </button>
            </div>
        )}
      </div>
    </div>
  );
}