import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CATEGORIES = [
  { id: 'professional', label: 'Professional' },
  { id: 'educational', label: 'Educational' },
  { id: 'casual', label: 'Casual' },
  { id: 'abstract', label: 'Abstract' },
]

const BACKGROUNDS = {
  professional: [
    { id: 'p1', label: 'Modern Office',    image: '/backgrounds/modern-office.jpg',  desc: 'Clean desk setup, city view' },
    { id: 'p2', label: 'Boardroom',        image: '/backgrounds/boardroom.jpg',       desc: 'Conference table, wooden tones' },
    { id: 'p3', label: 'Sofa & Bookshelf', image: '/backgrounds/sofa-bookshelf.jpg',  desc: 'Warm living room, bookshelves' },
    { id: 'p4', label: 'White Studio',     image: '/backgrounds/white-studio.webp',   desc: 'Clean minimal backdrop' },
    { id: 'p5', label: 'Tech Lab',         image: '/backgrounds/tech-lab.webp',       desc: 'Screens, servers, tech vibe' },
  ],
  educational: [
    { id: 'e1', label: 'Classroom',    image: null, color: '#1a2a1a', desc: 'Add: unsplash classroom chalkboard' },
    { id: 'e2', label: 'Library',      image: null, color: '#2a1a0a', desc: 'Add: unsplash library bookshelves' },
    { id: 'e3', label: 'Whiteboard',   image: null, color: '#1a1a2e', desc: 'Add: unsplash whiteboard office' },
  ],
  casual: [
    { id: 'c1', label: 'Coffee Shop',  image: '/backgrounds/coffee-shop.avif', desc: 'Warm cafe atmosphere' },
    { id: 'c2', label: 'Home Studio',  image: null, color: '#1a1a2a',          desc: 'Add: unsplash home studio' },
  ],
  abstract: [
    { id: 'a1', label: 'Dark',         image: null, color: '#080808', desc: 'Clean dark background' },
    { id: 'a2', label: 'Deep Blue',    image: null, color: '#0d1b2a', desc: 'Professional dark blue' },
    { id: 'a3', label: 'Deep Purple',  image: null, color: '#1a0a2e', desc: 'Soft purple tone' },
    { id: 'a4', label: 'Brand Green',  image: null, color: '#0a1a0a', desc: 'VaktarAI green accent' },
  ],
}

const SOLID_COLORS = [
  '#080808','#0d1b2a','#1a0a2e','#0a1a0a',
  '#2a1f1f','#1a1a1a','#e8e4d8','#ffffff',
  '#c9f03e','#3b82f6','#ef4444','#f59e0b',
]

export default function BackgroundPage({ addToast }) {
  const [activeCategory, setActiveCategory]   = useState('professional')
  const [selectedBg, setSelectedBg]           = useState(BACKGROUNDS.professional[0])
  const [bgType, setBgType]                   = useState('preset')
  const [solidColor, setSolidColor]           = useState('#0d1b2a')
  const [uploadedBgUrl, setUploadedBgUrl]     = useState(null)
  const [uploadedFile, setUploadedFile]       = useState(null)
  const [personPhoto, setPersonPhoto]         = useState(null)
  const [opacity, setOpacity]                 = useState(100)
  const [applied, setApplied]                 = useState(false)
  const bgUploadRef     = useRef(null)
  const personUploadRef = useRef(null)

  function handleBgUpload(e) {
    const f = e.target.files[0]
    if (!f) return
    setUploadedFile(f)
    setUploadedBgUrl(URL.createObjectURL(f))
    setBgType('upload')
  }

  function handlePersonUpload(e) {
    const f = e.target.files[0]
    if (!f) return
    setPersonPhoto(URL.createObjectURL(f))
    addToast?.('Photo loaded successfully!', 'success')
  }

  function handleApply() {
    setApplied(true)
    addToast?.('Background applied!', 'success')
    setTimeout(() => setApplied(false), 2000)
  }

  function getPreviewStyle() {
    if (bgType === 'color') return { background: solidColor }
    if (bgType === 'upload' && uploadedBgUrl) return { backgroundImage: `url(${uploadedBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    if (selectedBg?.image) return { backgroundImage: `url(${selectedBg.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    if (selectedBg?.color) return { background: selectedBg.color }
    return { background: '#0d1b2a' }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#080808' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

        {/* ══ LEFT: PREVIEW ══ */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

          {/* Header */}
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9f03e', fontWeight: 600, marginBottom: 4 }}>
              Background Studio
            </p>
            <h1 style={{ fontFamily: 'var(--font-display, Bebas Neue, sans-serif)', fontSize: 38, color: '#ede8d8', lineHeight: 0.95 }}>
              CHOOSE YOUR <span style={{ color: '#c9f03e' }}>SCENE</span>
            </h1>
          </div>

          {/* Upload person photo button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => personUploadRef.current.click()}
              style={{
                background: personPhoto ? 'rgba(201,240,62,0.1)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${personPhoto ? 'rgba(201,240,62,0.3)' : 'rgba(255,255,255,0.13)'}`,
                borderRadius: 8, padding: '8px 18px',
                fontSize: 11, color: personPhoto ? '#c9f03e' : '#ede8d8',
                letterSpacing: '0.06em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
              }}
            >
              {personPhoto ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c9f03e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Photo Loaded
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Upload Your Photo
                </>
              )}
            </button>
            {personPhoto && (
              <button
                onClick={() => setPersonPhoto(null)}
                style={{ background: 'none', border: 'none', color: '#5e5e56', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Remove
              </button>
            )}
            <input ref={personUploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePersonUpload} />
          </div>

          {/* Preview box */}
          <div style={{ flex: 1, borderRadius: 20, overflow: 'hidden', position: 'relative', border: '0.5px solid rgba(255,255,255,0.13)', minHeight: 0 }}>

            {/* Background layer */}
            <motion.div
              key={bgType === 'color' ? solidColor : bgType === 'upload' ? 'upload' : selectedBg?.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: opacity / 100 }}
              transition={{ duration: 0.5 }}
              style={{ position: 'absolute', inset: 0, ...getPreviewStyle() }}
            />

            {/* Bottom gradient so person is visible */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)', zIndex: 2 }} />

            {/* Person / avatar */}
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
              {personPhoto ? (
                <img
                  src={personPhoto}
                  alt="Your photo"
                  style={{
                    height: 320,
                    maxWidth: 280,
                    objectFit: 'contain',
                    objectPosition: 'bottom',
                    display: 'block',
                    // Remove white/light background using mix-blend-mode
                    mixBlendMode: 'luminosity',
                    filter: 'contrast(1.1)',
                  }}
                />
              ) : (
                <AvatarPlaceholder />
              )}
            </div>

            {/* Active label */}
            <div style={{
              position: 'absolute', top: 14, left: 14, zIndex: 10,
              background: 'rgba(8,8,8,0.75)', border: '0.5px solid rgba(255,255,255,0.13)',
              borderRadius: 100, padding: '5px 14px',
              fontSize: 10, color: '#ede8d8', letterSpacing: '0.06em',
              backdropFilter: 'blur(8px)',
            }}>
              {bgType === 'color' ? solidColor.toUpperCase()
                : bgType === 'upload' && uploadedFile ? uploadedFile.name
                : selectedBg?.label || 'No background'}
            </div>

            {/* Applied flash */}
            <AnimatePresence>
              {applied && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(201,240,62,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}
                >
                  <div style={{ background: '#080808', border: '1px solid #c9f03e', borderRadius: 12, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9f03e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize: 12, color: '#c9f03e', fontWeight: 600, letterSpacing: '0.1em' }}>BACKGROUND APPLIED</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Opacity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#909088', width: 60, flexShrink: 0 }}>Opacity</span>
            <input type="range" min={20} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#909088', width: 38, textAlign: 'right' }}>{opacity}%</span>
          </div>

          {/* Apply button */}
          <button
            onClick={handleApply}
            style={{ background: '#c9f03e', color: '#080808', border: 'none', borderRadius: 12, padding: 14, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Apply Background
          </button>
        </div>

        {/* ══ RIGHT: SELECTOR ══ */}
        <div style={{ background: '#101010', borderLeft: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Type tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {[{ id: 'preset', label: 'Scenes' }, { id: 'color', label: 'Solid Color' }, { id: 'upload', label: 'Upload' }].map(tab => (
              <button key={tab.id} onClick={() => setBgType(tab.id)} style={{
                flex: 1, padding: '14px 0', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: bgType === tab.id ? '2px solid #c9f03e' : '2px solid transparent',
                color: bgType === tab.id ? '#ede8d8' : '#909088',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>{tab.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 18, scrollbarWidth: 'none' }}>

            {/* SCENES */}
            {bgType === 'preset' && (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                      fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '6px 13px', borderRadius: 100, cursor: 'pointer',
                      background: activeCategory === cat.id ? 'rgba(201,240,62,0.1)' : '#161616',
                      border: `0.5px solid ${activeCategory === cat.id ? 'rgba(201,240,62,0.28)' : 'rgba(255,255,255,0.13)'}`,
                      color: activeCategory === cat.id ? '#c9f03e' : '#909088',
                      fontFamily: 'inherit', transition: 'all 0.18s',
                    }}>{cat.label}</button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {BACKGROUNDS[activeCategory].map(bg => {
                    const isSelected = selectedBg?.id === bg.id && bgType === 'preset'
                    return (
                      <motion.button
                        key={bg.id}
                        onClick={() => { setSelectedBg(bg); setBgType('preset') }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          background: 'none', padding: 0, cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#c9f03e' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 12, overflow: 'hidden',
                          transition: 'border-color 0.2s',
                        }}
                      >
                        <div style={{
                          height: 85, position: 'relative', overflow: 'hidden',
                          background: bg.color || '#161616',
                          ...(bg.image ? { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                        }}>
                          {!bg.image && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', padding: '0 8px' }}>
                                {bg.desc}
                              </span>
                            </div>
                          )}
                          {isSelected && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: '#c9f03e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '8px 10px', background: '#161616', textAlign: 'left' }}>
                          <p style={{ fontSize: 11, color: '#ede8d8', fontWeight: 500, marginBottom: 2 }}>{bg.label}</p>
                          <p style={{ fontSize: 9, color: '#5e5e56' }}>{bg.image ? bg.desc : '+ Add image'}</p>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SOLID COLOR */}
            {bgType === 'color' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5e5e56', fontWeight: 600, marginBottom: 12 }}>Preset Colors</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                    {SOLID_COLORS.map(c => (
                      <div key={c} onClick={() => setSolidColor(c)} style={{
                        aspectRatio: 1, borderRadius: 8, background: c, cursor: 'pointer',
                        border: `2px solid ${solidColor === c ? '#c9f03e' : 'transparent'}`,
                        outline: (c === '#ffffff' || c === '#e8e4d8') ? '0.5px solid rgba(255,255,255,0.15)' : 'none',
                        transition: 'border-color 0.15s',
                      }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5e5e56', fontWeight: 600, marginBottom: 12 }}>Custom Color</p>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <input type="color" value={solidColor} onChange={e => setSolidColor(e.target.value)}
                      style={{ width: 52, height: 52, borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.13)', background: 'none', cursor: 'pointer', padding: 3 }}
                    />
                    <div>
                      <p style={{ fontSize: 13, color: '#ede8d8', fontWeight: 500, fontFamily: 'monospace', marginBottom: 3 }}>{solidColor.toUpperCase()}</p>
                      <p style={{ fontSize: 10, color: '#909088' }}>Click to open color picker</p>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(201,240,62,0.06)', border: '0.5px solid rgba(201,240,62,0.2)', borderRadius: 10, padding: '13px 15px' }}>
                  <p style={{ fontSize: 10, color: '#c9f03e', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 5 }}>Green Screen Tip</p>
                  <p style={{ fontSize: 11, color: '#909088', lineHeight: 1.6 }}>
                    Use <span style={{ fontFamily: 'monospace', color: '#c9f03e' }}>#00B140</span> for perfect green screen compositing.
                  </p>
                </div>
              </div>
            )}

            {/* UPLOAD */}
            {bgType === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  onClick={() => bgUploadRef.current.click()}
                  style={{
                    border: `1px dashed ${uploadedBgUrl ? 'rgba(201,240,62,0.3)' : 'rgba(255,255,255,0.13)'}`,
                    borderRadius: 14, padding: '36px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    cursor: 'pointer', background: uploadedBgUrl ? 'rgba(201,240,62,0.03)' : '#161616',
                  }}
                >
                  <input ref={bgUploadRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleBgUpload} />
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#101010', border: '0.5px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 12, color: '#ede8d8', fontWeight: 500, textAlign: 'center' }}>
                    {uploadedFile ? uploadedFile.name : 'Upload your background'}
                  </p>
                  <p style={{ fontSize: 9, color: '#5e5e56', letterSpacing: '0.1em', textTransform: 'uppercase' }}>JPG · PNG · WEBP · MP4</p>
                </div>

                {uploadedBgUrl && (
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.13)', position: 'relative' }}>
                    <img src={uploadedBgUrl} alt="preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => { setUploadedFile(null); setUploadedBgUrl(null) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(8,8,8,0.85)', border: '0.5px solid rgba(255,255,255,0.13)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ede8d8', cursor: 'pointer' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '13px 15px' }}>
                  <p style={{ fontSize: 10, color: '#909088', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8 }}>Best results</p>
                  {['16:9 landscape images', 'Avoid busy/cluttered scenes', 'High resolution (1920×1080+)', 'Good contrast with your avatar'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c9f03e', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#909088', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function AvatarPlaceholder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 16, opacity: 0.5 }}>
      <svg width="100" height="170" viewBox="0 0 140 270" fill="none">
        <circle cx="70" cy="64" r="38" fill="rgba(20,20,20,0.92)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
        <ellipse cx="57" cy="62" rx="4.5" ry="5.5" fill="rgba(201,240,62,0.65)"/>
        <ellipse cx="83" cy="62" rx="4.5" ry="5.5" fill="rgba(201,240,62,0.65)"/>
        <path d="M61 79 Q70 86 79 79" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <rect x="63" y="100" width="14" height="16" rx="5" fill="rgba(20,20,20,0.92)"/>
        <path d="M18 270 L18 156 Q18 120 52 114 L70 134 L88 114 Q122 120 122 156 L122 270 Z" fill="rgba(18,18,18,0.92)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
        <path d="M70 134 L67 164 L70 173 L73 164 Z" fill="rgba(201,240,62,0.55)"/>
      </svg>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Upload your photo above
      </p>
    </div>
  )
}
