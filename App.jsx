import { useState, useRef } from 'react'

// ─── Music utils ────────────────────────────────────────────────
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function parseChordRoot(chord) {
  const m = chord.match(/^([A-G][#b]?)(.*)/)
  return m ? { root: m[1], suffix: m[2] } : null
}

function normalizeRoot(r) {
  return r.replace('Bb','A#').replace('Eb','D#').replace('Ab','G#').replace('Db','C#').replace('Gb','F#')
}

function transposeChord(chord, semitones) {
  if (!semitones) return chord
  const p = parseChordRoot(chord)
  if (!p) return chord
  const idx = CHROMATIC.indexOf(normalizeRoot(p.root))
  if (idx === -1) return chord
  return CHROMATIC[((idx - semitones) % 12 + 12) % 12] + p.suffix
}

function transposeChordLine(line, semitones) {
  if (!semitones) return line
  return line.replace(/[A-G][#b]?(maj7|m7|m6|add9|sus[24]|dim|aug|7|m|6|9)?(?=\s|$)/g, m => transposeChord(m, semitones))
}

function getBestCapo(chords) {
  const roots = [...new Set(chords.map(c => { const p = parseChordRoot(c); return p ? normalizeRoot(p.root) : null }).filter(Boolean))]
  const open = ['E','A','D','G','C','F','B']
  const friendly = ['C','G','D','A','E','F']
  let best = 0, bestScore = -1
  for (let capo = 0; capo <= 7; capo++) {
    let score = 0
    roots.map(r => { const i = CHROMATIC.indexOf(r); return i === -1 ? r : CHROMATIC[((i - capo) % 12 + 12) % 12] })
         .forEach(r => { if (open.includes(r)) score += 2; if (friendly.includes(r)) score += 1 })
    if (score > bestScore) { bestScore = score; best = capo }
  }
  return best
}

// ─── AI Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert guitarist and music theorist with deep knowledge of songs from ALL languages — English, Hindi, Bangla/Bengali, Urdu, Tamil, Telugu, Punjabi, Arabic, Spanish, Korean, Baul, folk, and more.

You have access to web_search. When asked for a song:
1. Search "[song name] [artist] guitar chords lyrics"
2. Also search "[song name] [artist] chord chart tab"
3. Build an accurate chord+lyric chart from results

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "found": true,
  "song": "Song Name",
  "artist": "Artist Name",
  "language": "Language",
  "key": "e.g. G major",
  "capo": 0,
  "tempo": "Slow/Medium/Fast",
  "feel": "mood description",
  "chords": ["C", "Am", "F", "G"],
  "progression": "I - vi - IV - V",
  "strumming": {
    "pattern": "D DU UDU",
    "visual": ["D","D","U","_","U","D","U"],
    "description": "short description"
  },
  "tips": "playing tip",
  "source": "source info",
  "chart": [
    {
      "section": "Verse",
      "lines": [
        { "chords": "C          Am", "lyrics": "Sample lyric line here" },
        { "chords": "F              G", "lyrics": "Another lyric line" }
      ]
    },
    {
      "section": "Chorus",
      "lines": [
        { "chords": "Am      F", "lyrics": "Chorus lyric line" },
        { "chords": "C       G", "lyrics": "Second chorus line" }
      ]
    }
  ]
}

Chart rules:
- Space chord names to align above the correct syllable
- Include at least 2-3 sections with real lyrics
- For non-English: romanized lyrics preferred for guitarists
- Keep to key representative lines per section
- chords array: all unique chords in the song

If not found: {"found": false, "message": "reason"}
JSON ONLY — no text outside the JSON object.`

// ─── Strum Visual ────────────────────────────────────────────────
function StrumVisual({ visual }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'center', padding: '10px 0' }}>
      {visual.map((beat, i) => {
        if (beat === '_') return (
          <div key={i} style={{ width: 20, textAlign: 'center' }}>
            <div style={{ height: 32 }} />
            <span style={{ fontSize: 10, color: '#333', fontFamily: 'JetBrains Mono, monospace' }}>—</span>
          </div>
        )
        const down = beat === 'D'
        return (
          <div key={i} style={{ width: 20, textAlign: 'center' }}>
            {!down && <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '13px solid var(--accent)', margin: '0 auto 3px' }} />}
            <div style={{ width: 2, height: 18, background: down ? 'var(--gold)' : 'var(--accent)', margin: '0 auto' }} />
            {down && <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '13px solid var(--gold)', margin: '3px auto 0' }} />}
            <div style={{ fontSize: 9, color: down ? 'var(--gold)' : 'var(--accent)', fontWeight: 700, marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>{beat}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Chord Badge ─────────────────────────────────────────────────
function ChordBadge({ chord }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface)', border: '1.5px solid var(--border)',
      color: '#fff', borderRadius: 8, padding: '5px 13px',
      fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: 0.5,
    }}>{chord}</span>
  )
}

// ─── Chord+Lyric Line ────────────────────────────────────────────
function ChordLyricLine({ chordsLine, lyricsLine, capoOffset }) {
  const transposed = transposeChordLine(chordsLine || '', capoOffset)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        color: 'var(--accent)', fontSize: 13, fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        whiteSpace: 'pre', lineHeight: 1.4, minHeight: 20,
        letterSpacing: 0.3,
      }}>{transposed || '\u00A0'}</div>
      <div style={{
        color: '#c8c8e0', fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'pre-wrap', lineHeight: 1.6,
      }}>{lyricsLine || '\u00A0'}</div>
    </div>
  )
}

// ─── Result Card ─────────────────────────────────────────────────
function ResultCard({ data, capoOffset, selectedCapo }) {
  const [tab, setTab] = useState('chart')
  const allChords = (data.chords || []).map(c => transposeChord(c, capoOffset))
  const sections = (data.chart || [])

  return (
    <div className="fade-up" style={{
      background: 'linear-gradient(145deg, var(--bg2), var(--bg3))',
      border: '1px solid var(--border)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 0 60px rgba(124,58,237,0.15)',
      marginBottom: 24,
    }}>
      {/* Song header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '22px 24px 18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              color: '#fff', fontWeight: 900, fontSize: 22, margin: '0 0 4px',
              fontFamily: 'Syne, sans-serif', lineHeight: 1.2,
            }}>{data.song}</h2>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{data.artist}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 8,
              padding: '3px 11px', fontSize: 11, fontWeight: 700,
              fontFamily: 'Inter, sans-serif', marginBottom: 5,
              display: 'inline-block',
            }}>{data.language}</div>
            <div style={{ color: '#444', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{data.key}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
          {[
            { icon: '🎵', val: data.feel },
            { icon: '⏱', val: data.tempo },
            { icon: selectedCapo > 0 ? '🎸' : '🎼', val: selectedCapo > 0 ? `Capo ${selectedCapo}` : 'No Capo' },
          ].map((t, i) => (
            <span key={i} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '4px 11px', color: '#aaa', fontSize: 11,
              fontFamily: 'Inter, sans-serif',
            }}>{t.icon} {t.val}</span>
          ))}
        </div>
        {data.source && (
          <div style={{ color: '#2a2a44', fontSize: 10, marginTop: 8, fontFamily: 'Inter, sans-serif' }}>🔍 {data.source}</div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[{ id: 'chart', label: '📄 Chord Chart' }, { id: 'info', label: '🎸 Details' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, background: tab === t.id ? 'rgba(124,58,237,0.12)' : 'transparent',
            border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? '#fff' : 'var(--muted)',
            padding: '12px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* CHART TAB */}
        {tab === 'chart' && (
          <div>
            {capoOffset !== 0 && (
              <div style={{
                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 10, padding: '8px 14px', marginBottom: 16,
                color: 'var(--accent)', fontSize: 12, fontFamily: 'Inter, sans-serif',
              }}>
                ⭐ Transposed for Capo {selectedCapo} — place capo on fret {selectedCapo} and finger these shapes
              </div>
            )}
            {sections.map((sec, si) => (
              <div key={si} style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: 6, padding: '3px 12px', marginBottom: 12,
                  color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                  fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: 1.5,
                }}>{sec.section}</div>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', borderRadius: 12,
                  padding: '14px 16px', border: '1px solid rgba(255,255,255,0.03)',
                }}>
                  {(sec.lines || []).map((line, li) => (
                    <ChordLyricLine key={li} chordsLine={line.chords} lyricsLine={line.lyrics} capoOffset={capoOffset} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>■ Chords</span>
              <span style={{ color: '#c8c8e0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>■ Lyrics</span>
            </div>
          </div>
        )}

        {/* INFO TAB */}
        {tab === 'info' && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>
                Chords Used {capoOffset > 0 && <span style={{ color: 'var(--accent)' }}>· Capo {selectedCapo}</span>}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {allChords.map((c, i) => <ChordBadge key={i} chord={c} />)}
              </div>
              {data.progression && (
                <div style={{ color: '#333', fontSize: 11, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>{data.progression}</div>
              )}
            </div>

            {data.strumming && (
              <div style={{
                background: 'rgba(0,0,0,0.3)', borderRadius: 12,
                padding: '14px 16px', marginBottom: 18,
                border: '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                  Strumming Pattern
                </div>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>{data.strumming.description}</div>
                <StrumVisual visual={data.strumming.visual} />
                <div style={{ textAlign: 'center', marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: 'var(--accent)', letterSpacing: 4 }}>
                  {data.strumming.pattern}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                  <span style={{ color: 'var(--gold)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>▼ Down</span>
                  <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>▲ Up</span>
                  <span style={{ color: '#333', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>— Rest</span>
                </div>
              </div>
            )}

            {data.tips && (
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 700, marginBottom: 5, fontFamily: 'Inter, sans-serif' }}>💡 Playing Tip</div>
                <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>{data.tips}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [selectedCapo, setSelectedCapo] = useState(0)
  const [suggestedCapo, setSuggestedCapo] = useState(null)
  const [history, setHistory] = useState([])
  const inputRef = useRef()

  const steps = [
    '🔍 Searching the web...',
    '🎸 Finding chords & lyrics...',
    '🎵 Building chord chart...',
    '✨ Almost ready...',
  ]

  const searchSong = async (q) => {
    if (!q.trim()) return
    setLoading(true); setError(''); setResult(null)
    setSelectedCapo(0); setSuggestedCapo(null); setLoadingMsg(steps[0])
    let si = 0
    const t = setInterval(() => { si = Math.min(si + 1, steps.length - 1); setLoadingMsg(steps[si]) }, 2500)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: `Find guitar chord chart with lyrics for: ${q}` }],
        }),
      })
      const data = await res.json()
      clearInterval(t)
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
      const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON')
      const parsed = JSON.parse(match[0])
      if (!parsed.found) {
        setError(parsed.message || 'Song not found. Try adding the artist name.')
      } else {
        setResult(parsed)
        const best = getBestCapo(parsed.chords || [])
        setSuggestedCapo(best)
        if (best > 0) setSelectedCapo(best)
        setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 5))
      }
    } catch {
      clearInterval(t)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const capoOffset = result ? selectedCapo - (result.capo || 0) : 0
  const examples = ['Tum Hi Ho Arijit', 'Tomake Chai James', 'Bohemian Rhapsody', 'Channa Mereya', 'Amar Sonar Bangla']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        background: 'linear-gradient(180deg, var(--bg3) 0%, var(--bg) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        padding: '36px 20px 28px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% -20%, rgba(124,58,237,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Guitar icon with glow */}
        <div style={{ fontSize: 48, marginBottom: 10, filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.5))' }}>🎸</div>

        <h1 style={{
          fontSize: 36, fontWeight: 900, margin: '0 0 8px',
          fontFamily: 'Syne, sans-serif',
          background: 'linear-gradient(135deg, #fff 20%, #a78bfa 60%, var(--accent))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: -1,
        }}>ChordFlow AI</h1>

        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 14px', fontFamily: 'Inter, sans-serif' }}>
          Chords + Lyrics · Any song · Any language
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 20, padding: '4px 12px',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            display: 'inline-block', boxShadow: '0 0 6px var(--green)',
          }} />
          <span style={{ color: 'var(--green)', fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Web Search Enabled
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Search bar */}
        <div style={{
          background: 'var(--bg3)',
          border: '1.5px solid rgba(124,58,237,0.4)',
          borderRadius: 16, padding: '4px 4px 4px 18px',
          display: 'flex', gap: 8, alignItems: 'center',
          marginBottom: 18,
          boxShadow: '0 0 40px rgba(124,58,237,0.12)',
        }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchSong(query)}
            placeholder="Song name + artist (any language)..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 15, fontFamily: 'Inter, sans-serif', padding: '11px 0',
            }}
          />
          <button
            onClick={() => searchSong(query)}
            disabled={loading || !query.trim()}
            style={{
              background: loading ? 'var(--surface)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
              border: 'none', borderRadius: 12, padding: '11px 20px',
              color: loading ? 'var(--muted)' : '#fff',
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳' : 'Find Chords'}
          </button>
        </div>

        {/* Examples */}
        {!result && !loading && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ color: '#1e1e30', fontSize: 10, fontFamily: 'Inter, sans-serif', marginBottom: 8, textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase' }}>Try these</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
              {examples.map((ex, i) => (
                <button key={i} onClick={() => { setQuery(ex); searchSong(ex) }} style={{
                  background: 'transparent', border: '1px solid rgba(124,58,237,0.2)',
                  borderRadius: 20, padding: '6px 14px', color: '#444',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.2s',
                }}>{ex}</button>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && !loading && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: '#1a1a28', fontSize: 10, fontFamily: 'Inter, sans-serif', marginBottom: 7, letterSpacing: 2, textTransform: 'uppercase' }}>Recent</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {history.map((h, i) => (
                <button key={i} onClick={() => { setQuery(h); searchSong(h) }} style={{
                  background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8, padding: '5px 11px', color: '#444',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>🕐 {h}</button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ position: 'relative', width: 50, height: 50, margin: '0 auto 20px' }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid rgba(124,58,237,0.1)',
                borderTop: '2px solid var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{loadingMsg}</div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="fade-up" style={{
            background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 14, padding: '16px 18px',
            color: '#f87171', fontSize: 13, fontFamily: 'Inter, sans-serif', marginBottom: 18,
          }}>
            ⚠️ {error}
            <div style={{ color: '#333', fontSize: 11, marginTop: 6 }}>
              Tip: Try adding the artist name — e.g. "Tomake Chai James"
            </div>
          </div>
        )}

        {/* Capo selector */}
        {result && !loading && (
          <div className="fade-up" style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '16px 18px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ color: '#ccc', fontWeight: 700, fontSize: 13, fontFamily: 'Syne, sans-serif' }}>🎸 Capo Position</div>
                {suggestedCapo > 0 && (
                  <div style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                    ⭐ Suggested: Capo {suggestedCapo} — easier fingering
                  </div>
                )}
              </div>
              <span style={{
                background: selectedCapo > 0 ? 'var(--accent)' : 'var(--surface)',
                color: '#fff', borderRadius: 9, padding: '4px 12px',
                fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              }}>
                {selectedCapo === 0 ? 'No Capo' : `Fret ${selectedCapo}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0,1,2,3,4,5,6,7].map(f => {
                const isSugg = f === suggestedCapo && suggestedCapo > 0
                return (
                  <button key={f} onClick={() => setSelectedCapo(f)} style={{
                    background: selectedCapo === f ? 'var(--accent)' : isSugg ? 'rgba(124,58,237,0.12)' : 'var(--surface)',
                    color: selectedCapo === f ? '#fff' : isSugg ? 'var(--accent)' : '#555',
                    border: `1.5px solid ${selectedCapo === f ? 'var(--accent)' : isSugg ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 9, padding: '7px 12px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    minWidth: 38, textAlign: 'center', position: 'relative',
                    transition: 'all 0.2s',
                  }}>
                    {f === 0 ? '✕' : f}
                    {isSugg && <span style={{ position: 'absolute', top: -5, right: -3, fontSize: 9 }}>⭐</span>}
                  </button>
                )
              })}
            </div>
            {selectedCapo > 0 && (
              <div style={{ color: '#2a2a44', fontSize: 11, fontFamily: 'Inter, sans-serif', marginTop: 9 }}>
                Place capo on fret {selectedCapo} · chords are already adjusted below
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <ResultCard data={result} capoOffset={capoOffset} selectedCapo={selectedCapo} />
        )}

        {/* Language note */}
        {!result && !loading && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <div style={{ color: '#151520', fontSize: 12, fontFamily: 'Inter, sans-serif', lineHeight: 2.2 }}>
              English · বাংলা · हिन्दी · اردو · தமிழ் · 한국어 · العربية & more
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
