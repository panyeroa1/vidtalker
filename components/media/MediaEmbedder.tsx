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
        // Construct Embed URL with Caption Preferences
        // cc_load_policy=1 : Force captions
        // hl={language} : Interface language (often helps with caption selection)
        finalSrc = `https://www.youtube.com/embed/${videoId}?cc_load_policy=1&hl=${language || 'en'}`;

        // Fetch Title via oEmbed (No API Key needed)
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
                setMediaTitle('Unknown Video');
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