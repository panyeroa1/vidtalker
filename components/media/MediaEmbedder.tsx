/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useSettings } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import c from 'classnames';

export default function MediaEmbedder() {
  const { mediaUrl } = useSettings();
  const { connected, connectWithScreenAudio } = useLiveAPIContext();

  // Simple YouTube parser to ensure we use the embed URL
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
        if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            const v = urlObj.searchParams.get('v');
            if (v) return `https://www.youtube.com/embed/${v}`;
        }
        if (url.includes('youtu.be/')) {
            const id = url.split('youtu.be/')[1];
            if (id) return `https://www.youtube.com/embed/${id}`;
        }
    } catch(e) {
        return url;
    }
    return url;
  }

  const embedSrc = getEmbedUrl(mediaUrl);

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
                <p>No Media URL Selected</p>
            </div>
        )}
        
        {!connected && (
            <div className="embed-overlay">
                <button className="capture-btn" onClick={connectWithScreenAudio}>
                    <span className="material-symbols-outlined">graphic_eq</span>
                    Capture System Audio
                </button>
            </div>
        )}
      </div>
    </div>
  );
}