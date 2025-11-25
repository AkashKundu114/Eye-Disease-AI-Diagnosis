import { useState, useCallback } from 'react'
import axios from 'axios'
import Cropper from 'react-easy-crop'
import getCroppedImg from './cropImage' 
import { 
  Upload, Activity, AlertTriangle, CheckCircle2, 
  ChevronRight, Stethoscope, ShieldAlert, Pill, 
  FileText, RefreshCw, Download, MapPin, Eye, ScanEye
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [heatmap, setHeatmap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showHeatmap, setShowHeatmap] = useState(false)

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isCropping, setIsCropping] = useState(false)

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setIsCropping(true)
      setResult(null)
      setHeatmap(null)
    }
  }

  const handleCropConfirm = async () => {
    try {
      const croppedImage = await getCroppedImg(preview, croppedAreaPixels)
      setPreview(URL.createObjectURL(croppedImage))
      setFile(croppedImage) 
      setIsCropping(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await axios.post(`${apiUrl}/predict`, formData)
      
      if (response.data.error) throw new Error(response.data.error);
      setResult(response.data)
      setHeatmap(response.data.heatmap)
    } catch (error) {
      alert(`Analysis Failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    doc.setFillColor(41, 128, 185); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("OphthalmoAI Diagnostic Report", 20, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
    doc.text("Ref ID: #AI-" + Math.floor(Math.random()*10000), 160, 50);

    doc.setDrawColor(0);
    doc.setFillColor(240, 248, 255);
    doc.roundedRect(20, 60, 170, 40, 3, 3, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("AI DIAGNOSIS RESULT", 30, 75);
    
    doc.setFontSize(20);
    doc.setTextColor(200, 0, 0);
    doc.text(result.diagnosis.toUpperCase(), 30, 90);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Confidence: ${result.confidence.toFixed(1)}%`, 120, 90);

    if (heatmap) {
        doc.addImage(heatmap, 'JPEG', 20, 110, 80, 80);
        doc.setFontSize(10);
        doc.text("Fig 1. Grad-CAM AI Attention Map", 25, 195);
        doc.text("(Red areas indicate disease focus)", 25, 200);
    }

    autoTable(doc, {
      startY: 110,
      margin: { left: 110 },
      head: [['Clinical Details']],
      body: [
        [`Condition: ${result.details.description}`],
        [`Severity: ${result.details.severity}`],
        [`Rec. Action: ${result.details.advice}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY < 200) finalY = 210; 

    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185);
    doc.text("Recommended Treatment Plan", 20, finalY);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    let yPos = finalY + 10;
    
    result.details.treatment.forEach(t => {
        doc.text(`• ${t}`, 25, yPos);
        yPos += 7;
    });

    doc.text("Symptoms to Watch For:", 110, finalY);
    let yPosSym = finalY + 10;
    result.details.symptoms.forEach(s => {
        doc.text(`• ${s}`, 115, yPosSym);
        yPosSym += 7;
    });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Find a Specialist: https://www.google.com/maps/search/ophthalmologist+near+me", 20, 280);
    doc.text("Disclaimer: AI screening tool. Not a substitute for professional medical advice.", 20, 285);

    doc.save("Eye_Health_Report.pdf");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter']">
      
      {/* CROPPER MODAL */}
      {isCropping && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black bg-opacity-90">
          <div className="relative w-full max-w-xl h-[60vh] bg-gray-900 rounded-lg overflow-hidden">
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={() => setIsCropping(false)} className="px-6 py-2 text-white bg-gray-600 rounded-lg">Cancel</button>
            <button onClick={handleCropConfirm} className="px-6 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500">Confirm Crop</button>
          </div>
          <p className="mt-2 text-sm text-white">Zoom and drag to center the eye.</p>
        </div>
      )}

      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between h-16 px-4 mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-xl font-bold text-blue-900">
            <Activity className="w-6 h-6 text-blue-600" /> OphthalmoAI
          </div>
        </div>
      </nav>

      <main className="px-4 py-12 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* LEFT: Upload & Preview */}
          <div className="space-y-6 lg:col-span-5">
            <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
              {!preview ? (
                <label className="flex flex-col items-center justify-center transition border-2 border-dashed cursor-pointer h-80 border-slate-300 rounded-2xl bg-slate-50 hover:bg-blue-50">
                  <Upload className="w-10 h-10 mb-3 text-blue-400" />
                  <span className="font-medium text-slate-600">Upload Eye Scan</span>
                  <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="relative overflow-hidden bg-black shadow-md rounded-2xl h-80 group">
                    <img 
                        src={showHeatmap && heatmap ? heatmap : preview} 
                        alt="Scan" 
                        className="object-contain w-full h-full" 
                    />
                    {heatmap && (
                        <button 
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2 hover:bg-black"
                        >
                            {showHeatmap ? <Eye className="w-4 h-4"/> : <ScanEye className="w-4 h-4"/>}
                            {showHeatmap ? "Show Original" : "Show AI Vision"}
                        </button>
                    )}
                  </div>
                  <button onClick={resetApp} className="flex items-center justify-center w-full gap-2 py-2 rounded-lg text-slate-500 hover:bg-slate-100">
                    <RefreshCw className="w-4 h-4" /> Upload New Image
                  </button>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`w-full mt-4 py-4 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2
                  ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? 'Analyzing...' : 'Run Diagnosis'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RIGHT: Results */}
          <div className="lg:col-span-7">
            {result ? (
              <div className="space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className={`p-6 rounded-3xl shadow-xl text-white flex justify-between items-center
                  ${result.diagnosis === 'Normal' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                  <div>
                    <p className="mb-1 text-sm font-medium tracking-wider uppercase opacity-90">Detection Result</p>
                    <h2 className="text-3xl font-bold">{result.diagnosis.replace(/_/g, ' ')}</h2>
                    <p className="mt-1 opacity-90">{result.confidence.toFixed(1)}% Confidence Score</p>
                  </div>
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    {result.diagnosis === 'Normal' ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex gap-3">
                    <a 
                        href={`https://www.google.com/maps/search/ophthalmologist+near+me`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center flex-1 gap-2 p-4 font-semibold text-blue-700 transition bg-white border shadow-sm border-slate-200 rounded-xl hover:bg-blue-50"
                    >
                        <MapPin className="w-5 h-5" /> Find Doctors Nearby
                    </a>
                    <button 
                        onClick={downloadPDF}
                        className="flex items-center justify-center flex-1 gap-2 p-4 font-semibold text-white transition bg-blue-600 shadow-md rounded-xl hover:bg-blue-700"
                    >
                        <Download className="w-5 h-5" /> Download Full Report
                    </button>
                </div>

                {/* Details Panel */}
                <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
                  <div className="flex gap-6 pb-4 mb-4 overflow-x-auto border-b border-slate-100">
                     {['Overview', 'Treatment', 'Precautions'].map(tab => (
                         <button 
                            key={tab}
                            onClick={() => setActiveTab(tab.toLowerCase())}
                            className={`font-medium pb-2 border-b-2 transition-colors ${activeTab === tab.toLowerCase() ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                         >
                            {tab}
                         </button>
                     ))}
                  </div>

                  <div className="min-h-[200px]">
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            <p className="text-lg leading-relaxed text-slate-600">{result.details.description}</p>
                            <div className="p-4 border bg-slate-50 rounded-xl border-slate-100">
                                <h4 className="flex items-center gap-2 mb-2 font-bold text-slate-700">
                                    <ShieldAlert className="w-4 h-4 text-amber-500" /> Severity: {result.details.severity}
                                </h4>
                                <p className="text-sm text-slate-500">{result.details.advice}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'treatment' && (
                        <ul className="space-y-3">
                            {result.details.treatment.map((t, i) => (
                                <li key={i} className="flex items-start gap-3 p-3 text-green-800 rounded-lg bg-green-50">
                                    <Pill className="w-5 h-5 mt-0.5" />
                                    {t}
                                </li>
                            ))}
                        </ul>
                    )}

                    {activeTab === 'precautions' && (
                        <ul className="space-y-3">
                           {result.details.symptoms.map((s, i) => (
                                <li key={i} className="flex items-center gap-3 text-slate-700">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Watch for: {s}
                                </li>
                           ))}
                        </ul>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <Stethoscope className="w-16 h-16 mb-4 opacity-20" />
                <p>Upload scan to generate report</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App