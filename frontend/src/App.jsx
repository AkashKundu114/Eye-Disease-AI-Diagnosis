import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import Cropper from 'react-easy-crop'
import getCroppedImg from './cropImage'
import {
  Upload, Activity, AlertTriangle, CheckCircle2,
  ChevronRight, Stethoscope, ShieldAlert, Pill,
  FileText, RefreshCw, Download, MapPin, Eye,
  ScanEye, Volume2, Layers, HelpCircle, ClipboardList,
  ShieldCheck, Microscope, Brain
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ChatBot from 'ChatBot'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Convert a blob/object URL to a base64 data URL (needed for jsPDF) */
const urlToBase64 = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const NAVY   = '#0d2137'
const TEAL   = '#00adb5'
const CREAM  = '#f7f8fc'

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all relative whitespace-nowrap
      ${active ? '' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
    style={active ? { color: TEAL, background: 'rgba(0,173,181,0.06)' } : {}}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
    {active && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
        style={{ background: TEAL }} />
    )}
  </button>
)

const SymptomSelect = ({ label, value, setValue, options }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full p-2.5 pr-8 text-sm appearance-none rounded-xl text-slate-700"
        style={{
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          fontFamily: 'inherit'
        }}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-slate-400">
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  </div>
)

const ProbabilityBar = ({ label, value }) => {
  // value is 0-1 float; convert to percentage for display
  const pct = Math.min(100, Math.max(0, value * 100))
  const barColor = pct > 70 ? TEAL : pct > 40 ? '#38bdf8' : '#bae6fd'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: TEAL }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full prob-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

const SeverityBadge = ({ severity }) => {
  const cfg = {
    'High': { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    'Moderate to Severe (depending on opacity density)': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    'Moderate (Can threaten vision if it grows large)': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    'Low (usually self-limiting, but contagious)': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'Low (Painful but rarely dangerous)': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'None': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  }
  const style = cfg[severity] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: style.bg, color: style.text, borderColor: style.border }}>
      {severity}
    </span>
  )
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [heatmap, setHeatmap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('treatment')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Symptom fields
  const [pain, setPain] = useState('None')
  const [vision, setVision] = useState('No')
  const [itch, setItch] = useState('No')
  const [halos, setHalos] = useState('No')
  const [discharge, setDischarge] = useState('None')
  const [lightSens, setLightSens] = useState('No')
  const [spots, setSpots] = useState('No')

  // Cropper
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isCropping, setIsCropping] = useState(false)

  useEffect(() => () => window.speechSynthesis.cancel(), [])

  const onCropComplete = useCallback((_, cap) => setCroppedAreaPixels(cap), [])

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setIsCropping(true)
    setResult(null)
    setHeatmap(null)
    setShowHeatmap(false)
  }

  const handleCropConfirm = async () => {
    try {
      const cropped = await getCroppedImg(preview, croppedAreaPixels)
      const url = URL.createObjectURL(cropped)
      setPreview(url)
      setFile(cropped)
      setIsCropping(false)
    } catch (e) { console.error(e) }
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pain', pain)
    formData.append('vision', vision)
    formData.append('itch', itch)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const { data } = await axios.post(`${apiUrl}/predict`, formData)
      if (data.error) throw new Error(data.error)
      setResult(data)
      setHeatmap(data.heatmap || null)
      setActiveTab('treatment')
    } catch (err) {
      alert(`Analysis Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const resetApp = () => {
    setFile(null); setPreview(null); setResult(null); setHeatmap(null)
    setShowHeatmap(false); setIsCropping(false)
    setPain('None'); setVision('No'); setItch('No')
    setHalos('No'); setDischarge('None'); setLightSens('No'); setSpots('No')
    window.speechSynthesis.cancel(); setIsSpeaking(false)
  }

  const speakReport = () => {
    if (!result) return
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return }
    const text = `Diagnosis: ${result.diagnosis}. Confidence: ${result.confidence.toFixed(0)} percent. ${result.details.advice}`
    const utt = new SpeechSynthesisUtterance(text)
    utt.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
    setIsSpeaking(true)
  }

  const downloadPDF = async () => {
    if (!result) return
    const doc = new jsPDF()
    const brand = [13, 33, 55]        // navy
    const accent = [0, 173, 181]      // teal
    const lightBg = [240, 250, 251]

    const addHeader = (title) => {
      doc.setFillColor(...brand)
      doc.rect(0, 0, 210, 28, 'F')
      // Teal accent strip
      doc.setFillColor(...accent)
      doc.rect(0, 26, 210, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('OphthalmoAI Diagnostics', 15, 18)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(title, 195, 12, { align: 'right' })
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 195, 19, { align: 'right' })
    }

    const addFooter = (pg) => {
      doc.setTextColor(150)
      doc.setFontSize(8)
      doc.text('⚕ For educational screening only. Not a substitute for professional medical diagnosis.', 105, 286, { align: 'center' })
      doc.text(`Page ${pg}`, 195, 286, { align: 'right' })
    }

    // ── PAGE 1 ──────────────────────────────────────────────────
    addHeader('Patient Report')
    doc.setTextColor(0)

    // Diagnosis card
    doc.setFillColor(...lightBg)
    doc.roundedRect(15, 35, 180, 38, 4, 4, 'F')
    doc.setFillColor(...accent)
    doc.roundedRect(15, 35, 5, 38, 2, 2, 'F')
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text(result.diagnosis.toUpperCase(), 26, 52)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(`AI Confidence: ${result.confidence.toFixed(1)}%  |  Severity: ${result.details.severity}  |  Group: ${result.group_name}`, 26, 63)

    // Patient symptoms table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('1. Patient Intake (Self-Reported)', 15, 83)
    autoTable(doc, {
      startY: 87,
      head: [['Symptom', 'Response']],
      body: [
        ['Pain Level', pain], ['Vision Blurry?', vision], ['Itchiness', itch],
        ['Halos / Glare', halos], ['Discharge', discharge],
        ['Light Sensitivity', lightSens], ['Floaters / Spots', spots]
      ],
      theme: 'grid',
      headStyles: { fillColor: brand, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
    })

    // Images
    const imgY = doc.lastAutoTable.finalY + 12
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('2. Diagnostic Imaging', 15, imgY)

    try {
      if (preview) {
        const previewB64 = await urlToBase64(preview)
        doc.addImage(previewB64, 'JPEG', 15, imgY + 4, 78, 78)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text('Patient Scan', 54, imgY + 86, { align: 'center' })
      }
      if (heatmap) {
        // heatmap is already a data URL from the backend
        doc.addImage(heatmap, 'JPEG', 112, imgY + 4, 78, 78)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text('AI Attention Heatmap (Grad-CAM)', 151, imgY + 86, { align: 'center' })
      }
    } catch (e) { console.warn('PDF image error:', e) }

    addFooter(1)

    // ── PAGE 2 ──────────────────────────────────────────────────
    doc.addPage()
    addHeader('Clinical Analysis')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('3. Condition Description', 15, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60)
    const descLines = doc.splitTextToSize(result.details.description || '', 180)
    doc.text(descLines, 15, 48)

    const advY = 48 + descLines.length * 5 + 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...accent)
    doc.text("Doctor's Clinical Note:", 15, advY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60)
    const advLines = doc.splitTextToSize(result.details.advice || '', 180)
    doc.text(advLines, 15, advY + 7)

    const treatY = advY + 7 + advLines.length * 5 + 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('4. Treatment Protocol', 15, treatY)
    autoTable(doc, {
      startY: treatY + 4,
      head: [['Recommended Treatments']],
      body: (result.details.treatment || []).map(t => [`• ${t}`]),
      theme: 'striped',
      headStyles: { fillColor: brand },
      bodyStyles: { fontSize: 9 }
    })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('5. Key Symptoms to Monitor', 15, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Symptoms']],
      body: (result.details.symptoms || []).map(s => [`• ${s}`]),
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 80] },
      bodyStyles: { fontSize: 9 }
    })

    // Differential diagnosis
    const statsData = Object.entries(result.probabilities || {})
      .sort(([, a], [, b]) => b - a)
      .map(([label, prob]) => [label.replace(/_/g, ' '), `${(prob * 100).toFixed(1)}%`])

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('6. Differential Diagnosis (AI Confidence)', 15, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Potential Condition', 'Match Probability']],
      body: statsData,
      theme: 'striped',
      headStyles: { fillColor: [70, 70, 70] },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    })

    addFooter(2)

    // ── PAGE 3 ──────────────────────────────────────────────────
    doc.addPage()
    addHeader('Action Plan')

    let yPos = 38
    if (result.hybrid_warnings?.length > 0) {
      doc.setFillColor(255, 235, 238)
      doc.roundedRect(15, yPos, 180, 10 + result.hybrid_warnings.length * 8, 3, 3, 'F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(180, 0, 0)
      doc.text('⚠ CLINICAL SAFETY ALERTS', 22, yPos + 8)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 0, 0)
      result.hybrid_warnings.forEach((w, i) => doc.text(`• ${w}`, 22, yPos + 17 + i * 8))
      yPos += 14 + result.hybrid_warnings.length * 8
    }

    doc.setFillColor(...lightBg)
    doc.roundedRect(15, yPos + 10, 180, 55, 4, 4, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brand)
    doc.text('Find Specialized Eye Care Near You', 25, yPos + 24)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text('Professional consultation is strongly recommended based on this AI screening result.', 25, yPos + 35)
    doc.text('Click the link below to locate certified ophthalmologists in your area:', 25, yPos + 43)
    doc.setTextColor(0, 100, 200)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.textWithLink('→ Open Google Maps: Ophthalmologist Near Me', 25, yPos + 55,
      { url: 'https://www.google.com/maps/search/ophthalmologist+near+me' })

    addFooter(3)

    const ts = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')
    doc.save(`OphthalmoAI_Report_${ts}.pdf`)
  }

  return (
    <div className="min-h-screen" style={{ background: '#f7f8fc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── CROP MODAL ───────────────────────────────────────────── */}
      {isCropping && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: 'rgba(13, 33, 55, 0.97)' }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl"
            style={{ height: 'min(55vh, 380px)', border: '1px solid rgba(0,173,181,0.3)' }}>
            <Cropper image={preview} crop={crop} zoom={zoom} aspect={1}
              onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
          </div>
          <div className="flex w-full max-w-md gap-3 mt-5">
            <button
              onClick={() => { setIsCropping(false); setFile(null); setPreview(null) }}
              className="flex-1 py-3 text-sm font-semibold transition rounded-xl"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCropConfirm}
              className="flex-1 py-3 text-sm font-bold text-white transition rounded-xl"
              style={{ background: 'linear-gradient(135deg, #00adb5, #007a80)', boxShadow: '0 4px 16px rgba(0,173,181,0.4)' }}
            >
              Confirm & Analyse
            </button>
          </div>
          <p className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#64748b' }}>
            <ScanEye className="w-4 h-4" /> Pinch or scroll to zoom · Drag to position
          </p>
        </div>
      )}

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(13, 33, 55, 0.96)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(0,173,181,0.2)'
        }}>
        <div className="flex items-center justify-between h-16 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #00adb5, #007a80)' }}>
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                Ophthalmo<span style={{ color: '#00adb5' }}>AI</span>
              </span>
              <p className="text-[10px] leading-none" style={{ color: '#64748b' }}>
                Clinical Diagnostic Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(0,173,181,0.12)', border: '1px solid rgba(0,173,181,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00adb5' }} />
              <span className="text-xs font-semibold" style={{ color: '#00adb5' }}>System Active</span>
            </div>
            <div className="hidden sm:flex text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
              Pro v4
            </div>
          </div>
        </div>
      </nav>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 sm:py-10">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">

          {/* LEFT COLUMN */}
          <div className="space-y-5 lg:col-span-5">

            {/* Upload Card */}
            <div className="overflow-hidden rounded-2xl"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

              {/* Image Area */}
              <div className="p-1.5">
                {!preview ? (
                  <label className="flex flex-col items-center justify-center transition-all border-2 border-dashed cursor-pointer h-60 sm:h-72 rounded-xl group"
                    style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.background = 'rgba(0,173,181,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc' }}
                  >
                    <div className="p-4 mb-3 transition-transform rounded-2xl group-hover:scale-110"
                      style={{ background: 'rgba(0,173,181,0.08)' }}>
                      <Upload className="w-9 h-9" style={{ color: TEAL }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-600">Upload Eye Scan</span>
                    <span className="mt-1 text-xs text-slate-400">JPG · PNG · BMP supported</span>
                    <span className="mt-3 text-[10px] px-3 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(0,173,181,0.1)', color: TEAL }}>
                      Click to browse
                    </span>
                    <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                  </label>
                ) : (
                  <div className="relative overflow-hidden bg-black h-60 sm:h-72 rounded-xl group">
                    <img
                      src={showHeatmap && heatmap ? heatmap : preview}
                      className="object-contain w-full h-full transition-opacity duration-400"
                      alt="Eye scan"
                    />
                    <div className="absolute inset-0 flex items-end p-4 transition-opacity duration-300 opacity-0 bg-gradient-to-t from-black/70 via-transparent to-transparent group-hover:opacity-100">
                      {heatmap && (
                        <button
                          onClick={() => setShowHeatmap(!showHeatmap)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-semibold transition"
                          style={{ background: 'rgba(0,173,181,0.8)', backdropFilter: 'blur(8px)' }}
                        >
                          {showHeatmap ? <Eye className="w-3.5 h-3.5" /> : <ScanEye className="w-3.5 h-3.5" />}
                          {showHeatmap ? 'Original Scan' : 'AI Attention Map'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Symptom Questionnaire */}
              {preview && !result && (
                <div className="px-5 pt-3 pb-1 animate-fade-in">
                  <div className="flex items-center gap-2 pb-3 mb-4"
                    style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(0,173,181,0.1)' }}>
                      <HelpCircle className="w-3.5 h-3.5" style={{ color: TEAL }} />
                    </div>
                    <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Symptom Assessment
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 stagger">
                    <SymptomSelect label="Pain Level" value={pain} setValue={setPain}
                      options={['None', 'Mild', 'Severe', 'Not Sure']} />
                    <SymptomSelect label="Vision Blurry?" value={vision} setValue={setVision}
                      options={['No', 'Yes', 'Not Sure']} />
                    <SymptomSelect label="Itchy?" value={itch} setValue={setItch}
                      options={['No', 'Yes', 'Not Sure']} />
                    <SymptomSelect label="Discharge?" value={discharge} setValue={setDischarge}
                      options={['None', 'Watery', 'Thick/Yellow', 'Not Sure']} />
                    <SymptomSelect label="Halos / Glare?" value={halos} setValue={setHalos}
                      options={['No', 'Yes', 'Not Sure']} />
                    <SymptomSelect label="Light Sensitive?" value={lightSens} setValue={setLightSens}
                      options={['No', 'Yes', 'Not Sure']} />
                    <div className="col-span-2">
                      <SymptomSelect label="Seeing Floaters / Spots?" value={spots} setValue={setSpots}
                        options={['No', 'Yes', 'Not Sure']} />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 p-5">
                <button
                  onClick={handleAnalyze}
                  disabled={!file || loading}
                  className="flex items-center justify-center w-full gap-2 py-4 font-bold text-white transition-all rounded-xl"
                  style={(!file || loading)
                    ? { background: '#94a3b8', cursor: loading ? 'wait' : 'not-allowed' }
                    : {
                      background: 'linear-gradient(135deg, #00adb5, #007a80)',
                      boxShadow: '0 6px 20px rgba(0,173,181,0.38)',
                      fontFamily: "'Outfit', sans-serif"
                    }}
                  onMouseEnter={e => { if (!loading && file) e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Analysing...
                    </>
                  ) : (
                    <>
                      <Microscope className="w-5 h-5" /> Run AI Diagnosis
                      <ChevronRight className="w-5 h-5 ml-auto" />
                    </>
                  )}
                </button>

                {result && (
                  <button
                    onClick={resetApp}
                    className="flex items-center justify-center gap-2 py-3 text-sm font-medium transition rounded-xl hover:bg-slate-50"
                    style={{ color: '#94a3b8' }}
                  >
                    <RefreshCw className="w-4 h-4" /> Start New Scan
                  </button>
                )}
              </div>
            </div>

            {/* Info cards */}
            {!result && (
              <div className="grid grid-cols-3 gap-3 animate-fade-up">
                {[
                  { icon: <ShieldCheck className="w-4 h-4" />, label: '7 Conditions', sub: 'Detected' },
                  { icon: <Brain className="w-4 h-4" />, label: 'EfficientNet', sub: 'B4 Model' },
                  { icon: <Activity className="w-4 h-4" />, label: 'Grad-CAM', sub: 'Heatmaps' },
                ].map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 py-4 rounded-xl text-center"
                    style={{ background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ color: TEAL }}>{c.icon}</div>
                    <span className="text-xs font-bold" style={{ color: NAVY }}>{c.label}</span>
                    <span className="text-[10px]" style={{ color: '#94a3b8' }}>{c.sub}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-7">
            {result ? (
              <div className="space-y-5 animate-fade-up">

                {/* ── DIAGNOSIS BANNER ──────────────────────────────── */}
                <div className="relative flex flex-col items-start justify-between gap-6 p-6 overflow-hidden text-white sm:p-8 rounded-2xl sm:flex-row sm:items-center"
                  style={{
                    background: result.diagnosis === 'Normal'
                      ? 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)'
                      : 'linear-gradient(135deg, #0d2137 0%, #0d4f6e 60%, #00adb5 100%)',
                    boxShadow: result.diagnosis === 'Normal'
                      ? '0 12px 40px rgba(5, 150, 105, 0.3)'
                      : '0 12px 40px rgba(0, 173, 181, 0.25)'
                  }}>
                  {/* Decorative circles */}
                  <div className="absolute w-48 h-48 rounded-full -top-12 -right-12 opacity-10"
                    style={{ background: '#fff' }} />
                  <div className="absolute w-32 h-32 rounded-full -bottom-8 -left-8 opacity-5"
                    style={{ background: '#fff' }} />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold tracking-widest uppercase opacity-75">
                      <Activity className="w-3.5 h-3.5" /> AI Screening Complete
                    </div>
                    <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {result.diagnosis.replace(/_/g, ' ')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full"
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                        {result.confidence.toFixed(1)}% Confidence
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        {result.group_name}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-3 shrink-0">
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      {result.diagnosis === 'Normal'
                        ? <CheckCircle2 className="w-10 h-10 text-white" />
                        : <AlertTriangle className="w-10 h-10 text-white" />
                      }
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={speakReport}
                        title="Read report aloud"
                        className="p-2.5 rounded-xl transition"
                        style={{
                          background: isSpeaking ? '#fff' : 'rgba(255,255,255,0.15)',
                          color: isSpeaking ? TEAL : '#fff'
                        }}
                      >
                        <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={downloadPDF}
                        title="Download PDF report"
                        className="p-2.5 rounded-xl transition"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── WARNINGS ──────────────────────────────────────── */}
                {result.hybrid_warnings?.length > 0 && (
                  <div className="flex items-start gap-3.5 p-4 rounded-xl border-l-4 animate-fade-in"
                    style={{ background: '#fff7ed', borderLeftColor: '#f59e0b', border: '1px solid #fde68a', borderLeftWidth: '4px' }}>
                    <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#d97706' }} />
                    <div>
                      <p className="mb-1 text-sm font-bold" style={{ color: '#92400e' }}>Clinical Safety Alerts</p>
                      {result.hybrid_warnings.map((w, i) => (
                        <p key={i} className="text-sm leading-snug" style={{ color: '#b45309' }}>• {w}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── TABBED REPORT ──────────────────────────────────── */}
                <div className="overflow-hidden rounded-2xl"
                  style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <div className="flex overflow-x-auto border-b scrollbar-hide" style={{ borderColor: '#f1f5f9' }}>
                    <TabButton active={activeTab === 'treatment'} onClick={() => setActiveTab('treatment')}
                      icon={<Pill className="w-3.5 h-3.5" />} label="Treatment" />
                    <TabButton active={activeTab === 'doctor'} onClick={() => setActiveTab('doctor')}
                      icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor's Note" />
                    <TabButton active={activeTab === 'symptoms'} onClick={() => setActiveTab('symptoms')}
                      icon={<ClipboardList className="w-3.5 h-3.5" />} label="Symptoms" />
                    <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}
                      icon={<Layers className="w-3.5 h-3.5" />} label="AI Stats" />
                  </div>

                  <div className="p-5 sm:p-7 min-h-[280px]">

                    {/* TREATMENT TAB */}
                    {activeTab === 'treatment' && (
                      <div className="space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                            Treatment Protocol
                          </h4>
                          <SeverityBadge severity={result.details.severity} />
                        </div>
                        <div className="space-y-2.5">
                          {(result.details.treatment || []).map((t, i) => (
                            <div key={i} className="flex items-start gap-3.5 p-4 rounded-xl transition"
                              style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,173,181,0.3)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}
                            >
                              <div className="p-1.5 rounded-full mt-0.5 shrink-0"
                                style={{ background: 'rgba(0,173,181,0.1)' }}>
                                <Pill className="w-3.5 h-3.5" style={{ color: TEAL }} />
                              </div>
                              <p className="text-sm font-medium leading-snug text-slate-700">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DOCTOR TAB */}
                    {activeTab === 'doctor' && (
                      <div className="space-y-5 animate-fade-in">
                        <div className="p-5 rounded-xl"
                          style={{ background: 'rgba(0,173,181,0.05)', border: '1px solid rgba(0,173,181,0.15)' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <Stethoscope className="w-4 h-4" style={{ color: TEAL }} />
                            <h4 className="text-sm font-bold" style={{ color: NAVY }}>Clinical Assessment</h4>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700">
                            {result.details.advice}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl"
                          style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>
                            Condition Overview
                          </p>
                          <p className="text-sm leading-relaxed text-slate-600">{result.details.description}</p>
                        </div>
                        {result.details.analysis && (
                          <div className="p-4 rounded-xl"
                            style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>
                              Visual Analysis
                            </p>
                            <p className="text-sm leading-relaxed text-slate-600">{result.details.analysis}</p>
                          </div>
                        )}
                        <a
                          href="https://www.google.com/maps/search/ophthalmologist+near+me"
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition hover:opacity-90"
                          style={{
                            background: 'linear-gradient(135deg, #0d2137, #0d4f6e)',
                            color: '#fff'
                          }}
                        >
                          <MapPin className="w-4 h-4" /> Find Nearest Ophthalmologist
                        </a>
                      </div>
                    )}

                    {/* SYMPTOMS TAB */}
                    {activeTab === 'symptoms' && (
                      <div className="animate-fade-in">
                        <h4 className="mb-4 text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                          Common Indicators for {result.diagnosis}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(result.details.symptoms || []).map((s, i) => (
                            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl"
                              style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                              <div className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: TEAL }} />
                              <span className="text-sm font-medium text-slate-700">{s}</span>
                            </div>
                          ))}
                        </div>
                        {result.details.precautions?.length > 0 && (
                          <>
                            <h4 className="my-4 text-xs font-bold tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                              Precautions & Prevention
                            </h4>
                            <div className="space-y-2">
                              {result.details.precautions.map((p, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                                  style={{ background: 'rgba(0,173,181,0.04)', border: '1px solid rgba(0,173,181,0.1)' }}>
                                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TEAL }} />
                                  <span className="text-sm text-slate-600">{p}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* AI STATS TAB */}
                    {activeTab === 'stats' && (
                      <div className="space-y-5 animate-fade-in">
                        <div>
                          <p className="font-bold text-slate-900 mb-0.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Differential Diagnosis
                          </p>
                          <p className="mb-5 text-sm text-slate-400">
                            AI confidence distribution within the <em>{result.group_name}</em> specialist model
                          </p>
                        </div>
                        <div className="space-y-4">
                          {Object.entries(result.probabilities || {})
                            .sort(([, a], [, b]) => b - a)
                            .map(([label, prob], i) => (
                              <ProbabilityBar key={i} label={label.replace(/_/g, ' ')} value={prob} />
                            ))}
                        </div>
                        <div className="pt-4 mt-4 text-xs text-slate-400"
                          style={{ borderTop: '1px solid #f1f5f9' }}>
                          * Probabilities reflect AI model confidence within the detected anatomical group,
                          not absolute medical certainty.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* Empty state */
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed"
                style={{ borderColor: '#e2e8f0', background: 'rgba(255,255,255,0.5)' }}>
                <div className="p-6 mb-4 rounded-full"
                  style={{ background: 'rgba(0,173,181,0.06)' }}>
                  <Eye className="w-14 h-14" style={{ color: 'rgba(0,173,181,0.25)' }} />
                </div>
                <p className="mb-1 font-semibold text-slate-400"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Ready for Analysis
                </p>
                <p className="text-sm text-slate-300">Upload an eye scan to begin AI diagnosis</p>
                <div className="flex flex-wrap justify-center gap-2 px-8 mt-5">
                  {['Cataract', 'Conjunctivitis', 'Uveitis', 'Pterygium', 'Eyelid', 'Jaundice', 'Normal'].map(c => (
                    <span key={c} className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(0,173,181,0.06)', color: 'rgba(0,173,181,0.5)', border: '1px solid rgba(0,173,181,0.12)' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── CHATBOT ───────────────────────────────────────────────── */}
      <ChatBot diagnosisContext={result} />
    </div>
  )
}