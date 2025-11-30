
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { useSettings } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import c from 'classnames';

export default function MediaEmbedder() {
  const { mediaUrl, language, setMediaTitle } = useSettings();
  const { connected, connectWithScreenAudio } = useLiveAPIContext();
  const [embedSrc, setEmbedSrc] = useState('');

  // Fetch Metadata using oEmbed when URL changes
  useEffect(() => {
    if (!mediaUrl) {
        setEmbedSrc('');
        setMediaTitle('');
        return;
    }

    let videoId = '';
    let finalSrc = mediaUrl;

    // Robust ID extraction
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
        // Construct Embed URL with optimizied params
        // cc_load_policy=1 : Force captions (visual backup)
        // hl={language} : Interface language
        // enablejsapi=1 : Allow control via JS (future proofing)
        // origin : Required for JS API
        const origin = window.location.origin;
        finalSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&cc_load_policy=1&hl=${language || 'en'}&enablejsapi=1&origin=${origin}&playsinline=1&rel=0`;

        // Fetch Title via oEmbed (No Auth required for public metadata)
        // This injects the "Scene Context" into the System Prompt
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        fetch(oembedUrl)
            .then(res => res.json())
            .then(data => {
                if (data && data.title) {
                    setMediaTitle(data.title);
                }
            })
            .catch(err => {
                console.warn('Failed to fetch video metadata', err);
                setMediaTitle('Unknown Video Context');
            });
    } else {
        setMediaTitle('Web Content');
    }

    setEmbedSrc(finalSrc);
  }, [mediaUrl, language, setMediaTitle]);

  return (
    <div className="media-embedder-wrapper">
      <div className="media-aspect-ratio">
        {embedSrc ? (
            <iframe 
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
                    Start Interpretation (Capture Audio)
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
