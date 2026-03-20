import { useState, useRef, useEffect, useCallback } from 'react'

const CHECKS = {
  FACE_TOO_FAR:    22,
  FACE_TOO_CLOSE:  60,
  CENTER_X:        { min: 36, max: 64 },
  CENTER_Y:        { min: 22, max: 68 },
  TILT_MAX:        12,
  PITCH_MAX:       18,
  EDGE_LEFT_MIN:   8,
  EDGE_RIGHT_MAX:  92,
  EDGE_TOP_MIN:    5,
  EDGE_BOTTOM_MAX: 95,
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef        = useRef(null)
  const canvasRef       = useRef(null)
  const streamRef       = useRef(null)
  const faceMeshRef     = useRef(null)
  const faceDetectorRef = useRef(null)
  const detectLoopRef   = useRef(null)

  const [status,        setStatus]        = useState('waiting')
  const [countdown,     setCountdown]     = useState(3)
  const [flash,         setFlash]         = useState(false)
  const [mpReady,       setMpReady]       = useState(false)
  const [faceReady,     setFaceReady]     = useState(false)
  const [faceBox,       setFaceBox]       = useState(null)
  const [issues,        setIssues]        = useState([])
  const [alignScore,    setAlignScore]    = useState(0)

  // ── Start camera ──
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setStatus('ready')
        }
      } catch {
        setStatus('error')
      }
    }
    start()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      clearTimeout(detectLoopRef.current)
      faceMeshRef.current?.close?.()
    }
  }, [])

  // ── Load face detector ──
  useEffect(() => {
    const load = async () => {
      try {
        // Method 1: MediaPipe FaceMesh (best — gives landmarks for tilt/pitch)
        const loadScript = (src) => new Promise((res, rej) => {
          if (document.querySelector(`script[src="${src}"]`)) { res(); return }
          const s = document.createElement('script')
          s.src = src; s.onload = res; s.onerror = rej
          document.head.appendChild(s)
        })

        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js')

        if (window.FaceMesh) {
          const fm = new window.FaceMesh({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${f}`
          })
          fm.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })
          await fm.initialize()
          faceMeshRef.current = fm
          setMpReady(true)
          return
        }
      } catch { /* fallback below */ }

      // Method 2: Chrome FaceDetector
      try {
        if ('FaceDetector' in window) {
          faceDetectorRef.current = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 1 })
          setMpReady(true)
          return
        }
      } catch { /* fallback below */ }

      // Method 3: Canvas fallback
      setMpReady(true)
    }
    load()
  }, [])

  // ── Evaluate all alignment issues ──
  const evaluate = ({ tiltDeg, pitchDeg, cx, cy, faceW, box }) => {
    const found = []

    // ── Edge checks — any part of face outside frame ──
    const faceLeft   = box ? box.x : cx - faceW/2
    const faceRight  = box ? box.x + box.w : cx + faceW/2
    const faceTop    = box ? box.y : cy - (faceW * 1.2) / 2
    const faceBottom = box ? box.y + box.h : cy + (faceW * 1.2) / 2

    if (faceLeft < CHECKS.EDGE_LEFT_MIN)        found.push({ id:'edge_left',   msg:'Move right — face cut off',  icon:'→' })
    if (faceRight > CHECKS.EDGE_RIGHT_MAX)      found.push({ id:'edge_right',  msg:'Move left — face cut off',   icon:'←' })
    if (faceTop < CHECKS.EDGE_TOP_MIN)          found.push({ id:'edge_top',    msg:'Move down — face cut off',   icon:'↓' })
    if (faceBottom > CHECKS.EDGE_BOTTOM_MAX)    found.push({ id:'edge_bottom', msg:'Move up — face cut off',     icon:'↑' })

    // ── Size checks ──
    if (faceW < CHECKS.FACE_TOO_FAR)            found.push({ id:'far',   msg:'Move closer to camera',    icon:'↔' })
    if (faceW > CHECKS.FACE_TOO_CLOSE)          found.push({ id:'close', msg:'Move further back',         icon:'↔' })

    // ── Center checks (only if not cut off) ──
    if (!found.find(f => f.id.startsWith('edge'))) {
      if (cx < CHECKS.CENTER_X.min)             found.push({ id:'left',  msg:'Move slightly right',       icon:'→' })
      if (cx > CHECKS.CENTER_X.max)             found.push({ id:'right', msg:'Move slightly left',        icon:'←' })
      if (cy < CHECKS.CENTER_Y.min)             found.push({ id:'up',    msg:'Lower your face slightly',  icon:'↓' })
      if (cy > CHECKS.CENTER_Y.max)             found.push({ id:'down',  msg:'Raise your face slightly',  icon:'↑' })
    }

    // ── Angle checks ──
    if (tiltDeg != null && tiltDeg > CHECKS.TILT_MAX)
      found.push({ id:'tilt',  msg:'Straighten your head',          icon:'⟳' })
    if (pitchDeg != null && Math.abs(pitchDeg) > CHECKS.PITCH_MAX)
      found.push({ id:'pitch', msg: pitchDeg > 0 ? 'Look straight ahead' : 'Lift your chin slightly', icon:'↕' })

    const score = Math.max(0, 100 - found.length * 20)
    return { issues: found, score, ready: found.length === 0 }
  }

  // ── Detection loop ──
  useEffect(() => {
    if (status !== 'ready' || !mpReady) return
    let active = true

    const run = async () => {
      if (!active || !videoRef.current) return
      const video = videoRef.current
      if (video.readyState < 2) { detectLoopRef.current = setTimeout(run, 120); return }

      const vw = video.videoWidth || 640
      const vh = video.videoHeight || 480

      try {
        // ── MediaPipe FaceMesh ──
        if (faceMeshRef.current) {
          await new Promise(resolve => {
            faceMeshRef.current.onResults(results => {
              if (results.multiFaceLandmarks?.length > 0) {
                const lm = results.multiFaceLandmarks[0]
                const get = i => ({ x: lm[i].x * vw, y: lm[i].y * vh })

                const leftEye  = { x:(get(33).x+get(133).x)/2, y:(get(33).y+get(133).y)/2 }
                const rightEye = { x:(get(362).x+get(263).x)/2, y:(get(362).y+get(263).y)/2 }
                const noseTip  = get(1)
                const chin     = get(152)
                const forehead = get(10)

                // Head tilt angle (eye line)
                const tiltDeg = Math.abs(Math.atan2(
                  rightEye.y - leftEye.y,
                  rightEye.x - leftEye.x
                ) * (180 / Math.PI))

                // Head pitch (nose position relative to face)
                const eyeMidY  = (leftEye.y + rightEye.y) / 2
                const faceH    = (chin.y - forehead.y) || 1
                const pitchDeg = ((noseTip.y - eyeMidY) / faceH - 0.35) * 100

                // Face bounding box from all landmarks
                const xs = lm.map(l => l.x * vw)
                const ys = lm.map(l => l.y * vh)
                const fl = Math.min(...xs), fr = Math.max(...xs)
                const ft = Math.min(...ys), fb = Math.max(...ys)

                const faceW  = ((fr - fl) / vw) * 100
                const mirroredLeft = vw - fr
                const box = {
                  x: (mirroredLeft / vw) * 100,
                  y: (ft / vh) * 100,
                  w: faceW,
                  h: ((fb - ft) / vh) * 100,
                }
                const cx = box.x + box.w / 2
                const cy = box.y + box.h / 2

                const result = evaluate({ tiltDeg, pitchDeg, cx, cy, faceW, box })
                setFaceBox(box)
                setIssues(result.issues)
                setAlignScore(result.score)
                setFaceReady(result.ready)
              } else {
                setFaceBox(null)
                setIssues([{ id:'none', msg:'No face detected', icon:'?' }])
                setAlignScore(0)
                setFaceReady(false)
              }
              resolve()
            })
            faceMeshRef.current.send({ image: video })
          })
        }
        // ── Chrome FaceDetector ──
        else if (faceDetectorRef.current) {
          const faces = await faceDetectorRef.current.detect(video)
          if (faces.length > 0) {
            const f = faces[0].boundingBox
            const mirX = vw - f.x - f.width
            const box = { x:(mirX/vw)*100, y:(f.y/vh)*100, w:(f.width/vw)*100, h:(f.height/vh)*100 }
            const cx = box.x + box.w/2, cy = box.y + box.h/2
            const result = evaluate({ tiltDeg:null, pitchDeg:null, cx, cy, faceW:box.w, box })
            setFaceBox(box); setIssues(result.issues); setAlignScore(result.score); setFaceReady(result.ready)
          } else {
            setFaceBox(null); setIssues([{ id:'none', msg:'No face detected', icon:'?' }]); setAlignScore(0); setFaceReady(false)
          }
        }
        // ── Canvas skin fallback ──
        else {
          const tmp = document.createElement('canvas')
          tmp.width = 80; tmp.height = 60
          const ctx = tmp.getContext('2d')
          ctx.drawImage(video, 0, 0, 80, 60)
          const d = ctx.getImageData(20, 6, 40, 48).data
          let skin = 0
          for (let i = 0; i < d.length; i+=4) {
            const r=d[i],g=d[i+1],b=d[i+2]
            if (r>80&&g>30&&b>15&&r>g&&r>b&&r-Math.min(g,b)>20) skin++
          }
          const ratio = skin / (d.length/4)
          if (ratio > 0.12) {
            const box = { x:22, y:8, w:56, h:68 }
            const cx=50, cy=42
            const result = evaluate({ tiltDeg:null, pitchDeg:null, cx, cy, faceW:56, box })
            setFaceBox(box); setIssues(result.issues); setAlignScore(result.score); setFaceReady(result.ready)
          } else {
            setFaceBox(null); setIssues([{ id:'none', msg:'No face detected', icon:'?' }]); setAlignScore(0); setFaceReady(false)
          }
        }
      } catch {
        setFaceReady(false)
      }

      if (active) detectLoopRef.current = setTimeout(run, 90)
    }

    run()
    return () => { active = false; clearTimeout(detectLoopRef.current) }
  }, [status, mpReady])

  // ── Countdown ──
  const startCountdown = useCallback(() => {
    if (!faceReady) return
    setStatus('countdown')
    setCountdown(3)
    let count = 3
    const timer = setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) { clearInterval(timer); capturePhoto() }
    }, 1000)
  }, [faceReady])

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    setFlash(true)
    setTimeout(() => setFlash(false), 300)
    canvas.toBlob((blob) => {
      const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      clearTimeout(detectLoopRef.current)
      setStatus('captured')
      onCapture(file)
    }, 'image/jpeg', 0.95)
  }

  const fc = alignScore > 75 ? '#22C55E' : alignScore > 40 ? '#F59E0B' : '#EF4444'
  const primaryIssue = issues[0]

  return (
    <>
      <style>{`
        @keyframes camFadeIn  { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes scanLine   { 0%{top:8%} 100%{top:90%} }
        @keyframes pulseDot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.6)} }
        @keyframes countPop   { 0%{transform:translate(-50%,-50%) scale(1.4);opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{transform:translate(-50%,-50%) scale(0.8);opacity:0} }
        @keyframes flashWhite { 0%{opacity:0} 20%{opacity:0.9} 100%{opacity:0} }
        @keyframes spin360    { to{transform:rotate(360deg)} }
        @keyframes slideUp    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .cam-capture-btn:hover:not(:disabled) { filter:brightness(1.12)!important; transform:translateY(-1px)!important; }
        .cam-cancel-btn:hover { background:rgba(255,255,255,0.08)!important; }
      `}</style>

      <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <div style={s.camIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#4f8eff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="#4f8eff" strokeWidth="1.8"/>
                </svg>
              </div>
              <div>
                <p style={s.title}>Portrait capture</p>
                <p style={s.subtitle}>Align your face for the best avatar quality</p>
              </div>
            </div>
            <button style={s.closeBtn} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Viewport */}
          <div style={s.viewport}>
            {status === 'error' ? (
              <div style={s.errorBox}>
                <div style={s.errorIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={{ color:'#FCA5A5', fontSize:14, fontWeight:600, margin:0 }}>Camera access denied</p>
                <p style={{ color:'#64748B', fontSize:12, margin:'4px 0 0', textAlign:'center' }}>Allow camera permission in your browser settings</p>
                <button onClick={onClose} style={s.errorBtn}>Close</button>
              </div>
            ) : (
              <>
                <video ref={videoRef} style={{ ...s.video, transform:'scaleX(-1)' }} playsInline muted />
                <div style={s.vignette} />

                {/* Scan line — searching */}
                {!faceBox && status === 'ready' && (
                  <div style={{ position:'absolute', left:'20%', width:'60%', height:'1px', background:`linear-gradient(90deg,transparent,#EF444470,transparent)`, animation:'scanLine 2s ease-in-out infinite', zIndex:3 }} />
                )}

                {/* Guide frame */}
                <div style={s.guideOverlay}>
                  <div style={{ ...s.ovalGuide, borderColor:`${fc}55`, boxShadow: faceReady ? `0 0 20px ${fc}20` : 'none', transition:'all 0.3s' }} />

                  {[
                    { top:-2,    left:-2,  borderTop:`2.5px solid ${fc}`, borderLeft:`2.5px solid ${fc}`,    borderRadius:'4px 0 0 0' },
                    { top:-2,    right:-2, borderTop:`2.5px solid ${fc}`, borderRight:`2.5px solid ${fc}`,   borderRadius:'0 4px 0 0' },
                    { bottom:-2, left:-2,  borderBottom:`2.5px solid ${fc}`, borderLeft:`2.5px solid ${fc}`,  borderRadius:'0 0 0 4px' },
                    { bottom:-2, right:-2, borderBottom:`2.5px solid ${fc}`, borderRight:`2.5px solid ${fc}`, borderRadius:'0 0 4px 0' },
                  ].map((st, i) => (
                    <div key={i} style={{ position:'absolute', width:28, height:28, transition:'border-color 0.25s', ...st }} />
                  ))}

                  {/* Eye level line */}
                  <div style={{ position:'absolute', top:'32%', left:0, width:'100%', height:'1px', background:`linear-gradient(90deg,transparent,${fc}40,${fc}60,${fc}40,transparent)`, transition:'background 0.25s' }} />

                  {/* Nose dot */}
                  <div style={{ position:'absolute', top:'52%', left:'50%', transform:'translate(-50%,-50%)', width:5, height:5, borderRadius:'50%', background:`${fc}90`, transition:'background 0.25s' }} />

                  {/* Tilt arrow indicator */}
                  {issues.find(i => i.id === 'tilt') && (
                    <div style={{ position:'absolute', top:'26%', left:'50%', transform:'translateX(-50%)', fontSize:20, color:'#F59E0B', animation:'slideUp 0.3s ease' }}>⟳</div>
                  )}
                </div>

                {/* Live face box */}
                {faceBox && (
                  <div style={{
                    position:'absolute', zIndex:5, pointerEvents:'none',
                    left:`${faceBox.x}%`, top:`${faceBox.y}%`,
                    width:`${faceBox.w}%`, height:`${faceBox.h}%`,
                    border:`1.5px solid ${fc}60`, borderRadius:4,
                    transition:'all 0.08s ease',
                  }} />
                )}

                {/* Status badge */}
                <div style={{ ...s.badge, borderColor:`${fc}60`, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)', transition:'all 0.25s' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:fc, marginRight:7, animation:'pulseDot 1.4s ease-in-out infinite', flexShrink:0, transition:'background 0.25s' }} />
                  <span style={{ fontSize:11, color:fc, fontWeight:700, letterSpacing:'0.04em', transition:'color 0.25s' }}>
                    {!mpReady ? 'LOADING…'
                      : !faceBox ? 'NO FACE DETECTED'
                      : faceReady ? 'PERFECTLY ALIGNED'
                      : alignScore > 40 ? 'ALMOST THERE'
                      : 'NEEDS ADJUSTMENT'}
                  </span>
                </div>

                {/* HD badge */}
                <div style={s.resBadge}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:'0.06em' }}>HD</span>
                </div>

                {/* Primary issue instruction */}
                {primaryIssue && !faceReady && (
                  <div style={{ ...s.hintBar, borderColor:`${fc}35`, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', transition:'all 0.25s' }} key={primaryIssue.id}>
                    <span style={{ fontSize:16, lineHeight:1 }}>{primaryIssue.icon}</span>
                    <span style={{ fontSize:12, color:'#FCD34D', fontWeight:700 }}>{primaryIssue.msg}</span>
                  </div>
                )}
                {faceReady && (
                  <div style={{ ...s.hintBar, borderColor:'#22C55E35', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)' }}>
                    <span style={{ fontSize:12, color:'#86EFAC', fontWeight:700 }}>Perfect — hold still</span>
                  </div>
                )}

                {/* Countdown */}
                {status === 'countdown' && (
                  <div style={s.countdownOverlay}>
                    <div key={countdown} style={{ position:'absolute', top:'50%', left:'50%', fontSize:96, fontWeight:900, color:'white', lineHeight:1, animation:'countPop 1s ease forwards', textShadow:`0 0 40px ${fc}` }}>
                      {countdown}
                    </div>
                    <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:700, letterSpacing:'0.12em' }}>
                      HOLD STILL
                    </div>
                  </div>
                )}

                {flash && <div style={{ position:'absolute', inset:0, background:'white', animation:'flashWhite 0.3s ease forwards', zIndex:10, borderRadius:12 }} />}
              </>
            )}
          </div>

          {/* Alignment score — always rendered, never shifts layout */}
          <div style={s.scoreSection}>
            <div style={s.scoreHeader}>
              <span style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Alignment score</span>
              <span style={{ fontSize:12, fontWeight:700, color: faceBox ? fc : '#334155', transition:'color 0.3s' }}>
                {faceBox ? `${alignScore}%` : '—'}
              </span>
            </div>
            <div style={s.scoreTrack}>
              <div style={{
                height:'100%', borderRadius:4,
                width: faceBox ? `${alignScore}%` : '0%',
                background: alignScore > 75 ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                  : alignScore > 40 ? 'linear-gradient(90deg,#B45309,#F59E0B)'
                  : 'linear-gradient(90deg,#991B1B,#EF4444)',
                transition:'width 0.35s ease, background 0.35s ease',
              }} />
            </div>

            {/* Fixed height row — always occupies same space regardless of state */}
            <div style={{ ...s.issueRow, minHeight:24 }}>
              {!faceBox ? (
                <div style={s.issueChipMuted}>
                  <span style={{ fontSize:10, color:'#334155' }}>Position your face in the frame</span>
                </div>
              ) : faceReady ? (
                <div style={s.issueChipGreen}>
                  <span style={{ fontSize:11 }}>✓</span>
                  <span style={{ fontSize:10, color:'#86EFAC' }}>All checks passed — ready to capture</span>
                </div>
              ) : (
                issues.map(issue => (
                  <div key={issue.id} style={s.issueChip}>
                    <span style={{ fontSize:12 }}>{issue.icon}</span>
                    <span style={{ fontSize:10, color:'#94A3B8' }}>{issue.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Buttons */}
          <div style={s.btnRow}>
            <button className="cam-cancel-btn" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className="cam-capture-btn"
              style={{
                ...s.captureBtn,
                opacity: (status === 'ready' && faceReady) ? 1 : 0.45,
                background: (status === 'ready' && faceReady) ? 'linear-gradient(135deg,#3B82F6,#6366F1)' : '#334155',
                cursor: (status === 'ready' && faceReady) ? 'pointer' : 'not-allowed',
              }}
              onClick={(status === 'ready' && faceReady) ? startCountdown : undefined}
              disabled={status !== 'ready' || !faceReady}
            >
              {status === 'countdown' ? (
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin360 0.7s linear infinite', display:'inline-block' }} />
                  Capturing in {countdown}…
                </span>
              ) : status === 'waiting' ? 'Starting camera…'
                : !faceBox ? 'Show your face'
                : !faceReady ? `Fix ${issues.length} issue${issues.length > 1 ? 's' : ''} to capture`
                : (
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="1.8"/>
                    </svg>
                    Capture photo
                  </span>
                )
              }
            </button>
          </div>

          <canvas ref={canvasRef} style={{ display:'none' }} />
        </div>
      </div>
    </>
  )
}

const s = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,5,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)' },
  modal:        { background:'#0B1120', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:20, width:460, maxWidth:'95vw', display:'flex', flexDirection:'column', gap:14, animation:'camFadeIn 0.25s ease both', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerLeft:   { display:'flex', alignItems:'center', gap:12 },
  camIcon:      { width:36, height:36, borderRadius:10, background:'rgba(79,142,255,0.12)', border:'1px solid rgba(79,142,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  title:        { fontSize:15, fontWeight:700, color:'#F1F5F9', margin:0, letterSpacing:'-0.01em' },
  subtitle:     { fontSize:11, color:'#475569', margin:'2px 0 0', fontWeight:500 },
  closeBtn:     { width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
  viewport:     { position:'relative', width:'100%', aspectRatio:'4/3', background:'#020817', borderRadius:14, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.06)' },
  video:        { width:'100%', height:'100%', objectFit:'cover', display:'block' },
  vignette:     { position:'absolute', inset:0, background:'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)', pointerEvents:'none', zIndex:2 },
  guideOverlay: { position:'absolute', width:'56%', height:'80%', top:'10%', left:'22%', zIndex:4 },
  ovalGuide:    { position:'absolute', top:'4%', left:'10%', width:'80%', height:'88%', border:'1.5px dashed', borderRadius:'50%', transition:'all 0.3s' },
  badge:        { position:'absolute', top:12, left:12, display:'flex', alignItems:'center', border:'1px solid', borderRadius:20, padding:'5px 12px', zIndex:5 },
  resBadge:     { position:'absolute', top:12, right:12, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'4px 8px', zIndex:5 },
  hintBar:      { position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:7, border:'1px solid', borderRadius:20, padding:'5px 16px', zIndex:5, whiteSpace:'nowrap' },
  countdownOverlay: { position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)', zIndex:8, display:'flex', alignItems:'center', justifyContent:'center' },
  scoreSection: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 },
  scoreHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center' },
  scoreTrack:   { height:5, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' },
  issueRow:     { display:'flex', flexWrap:'wrap', gap:6 },
  issueChip:     { display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20 },
  issueChipGreen:{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:20 },
  issueChipMuted:{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20 },
  tipsRow:      { display:'flex', gap:8 },
  tipChip:      { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'7px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10 },
  btnRow:       { display:'flex', gap:10 },
  cancelBtn:    { flex:1, padding:'11px', borderRadius:11, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#64748B', fontSize:13, fontWeight:600, cursor:'pointer' },
  captureBtn:   { flex:2, padding:'11px', borderRadius:11, border:'none', color:'white', fontSize:13, fontWeight:700, letterSpacing:'0.02em', transition:'all 0.2s' },
  errorBox:     { display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:28, textAlign:'center' },
  errorIcon:    { width:56, height:56, borderRadius:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center' },
  errorBtn:     { marginTop:8, padding:'8px 20px', borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#FCA5A5', fontSize:12, fontWeight:600, cursor:'pointer' },
}