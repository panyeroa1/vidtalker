
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings, useUI, VoiceStyle } from '@/lib/state';
import c from 'classnames';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { SUPPORTED_LANGUAGES, AVAILABLE_VOICES } from '@/lib/constants';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { 
    language, setLanguage, 
    voice, setVoice, 
    voiceStyle, setVoiceStyle,
    backgroundPadEnabled, setBackgroundPadEnabled,
    backgroundPadVolume, setBackgroundPadVolume,
    mediaUrl, setMediaUrl,
    systemPrompt, setSystemPrompt,
    sourceVolume, setSourceVolume
  } = useSettings();
  const { connected } = useLiveAPIContext();

  return (
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h3>Settings</h3>
          <button onClick={toggleSidebar} className="close-button">
            <span className="icon">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Media Embedding</h4>
            <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Embed URL (YouTube/Web)</label>
                <input 
                    type="text" 
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                    style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel-secondary)', color: 'var(--text-main)'}}
                />
            </div>
            
            <div style={{marginBottom: '1rem'}}>
                 <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Source Volume (YouTube)</label>
                 <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                     <span style={{fontSize: '0.8rem', minWidth: '30px'}}>{sourceVolume}%</span>
                     <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sourceVolume}
                        onChange={(e) => setSourceVolume(parseInt(e.target.value))}
                        style={{width: '100%', cursor: 'pointer'}}
                     />
                 </div>
                 <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                    Lower this to separate source audio from interpretation.
                 </p>
            </div>
          </div>

          <div className="sidebar-section">
            <fieldset disabled={connected}>
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Target Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  <option value="" disabled>Select...</option>
                  <option value="">Auto-Detect (Match Context)</option>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Persona Description</label>
                <textarea 
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)', 
                    background: 'var(--bg-panel-secondary)', 
                    color: 'var(--text-main)',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    resize: 'vertical',
                    lineHeight: '1.4'
                  }}
                />
              </div>

              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Voice Model</label>
                <select
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem'}}>Voice Style</label>
                <select
                  value={voiceStyle}
                  onChange={e => setVoiceStyle(e.target.value as VoiceStyle)}
                  style={{
                    appearance: 'none',
                    backgroundImage: `var(--select-arrow)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '1em',
                    paddingRight: '30px'
                  }}
                >
                  <option value="natural">Natural (Standard)</option>
                  <option value="breathy">Breathy (Eburon Default)</option>
                  <option value="dramatic">Dramatic (Slow)</option>
                </select>
              </div>
            </fieldset>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Background Audio</h4>
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
               <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                 <label style={{fontSize: '0.9rem'}}>Ambient Pad</label>
                 <label className="switch" style={{position: 'relative', display: 'inline-block', width: '40px', height: '24px'}}>
                   <input 
                      type="checkbox" 
                      checked={backgroundPadEnabled}
                      onChange={(e) => setBackgroundPadEnabled(e.target.checked)}
                      style={{opacity: 0, width: 0, height: 0}}
                   />
                   <span 
                     style={{
                       position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                       backgroundColor: backgroundPadEnabled ? 'var(--accent-blue)' : 'var(--Neutral-30)', 
                       transition: '.4s', borderRadius: '24px'
                     }}
                   >
                     <span style={{
                       position: 'absolute', content: '""', height: '16px', width: '16px', 
                       left: backgroundPadEnabled ? '20px' : '4px', bottom: '4px', 
                       backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                     }}></span>
                   </span>
                 </label>
               </div>
               
               {backgroundPadEnabled && (
                 <div>
                   <label style={{display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                     Volume: {Math.round(backgroundPadVolume * 100)}%
                   </label>
                   <input 
                      type="range" 
                      min="0" 
                      max="0.5" 
                      step="0.01" 
                      value={backgroundPadVolume}
                      onChange={(e) => setBackgroundPadVolume(parseFloat(e.target.value))}
                      style={{width: '100%', cursor: 'pointer'}}
                   />
                 </div>
               )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}