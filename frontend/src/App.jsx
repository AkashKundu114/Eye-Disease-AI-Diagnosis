import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import Cropper from 'react-easy-crop'
import getCroppedImg from './cropImage'
import { 
  Upload, Activity, AlertTriangle, CheckCircle2, 
  ChevronRight, Stethoscope, ShieldAlert, Pill, 
  FileText, RefreshCw, Download, MapPin, Eye, ScanEye, Volume2, Layers, HelpCircle, ClipboardList
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
const now = new Date();
const timestamp = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;

const TabButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-4 px-4 flex items-center justify-center gap-2 text-sm font-bold transition-all relative whitespace-nowrap
      ${active ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
  >
    {icon}
    {label}
    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
  </button>
)

const SymptomSelect = ({ label, value, setValue, options }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => setValue(e.target.value)} 
        className="w-full p-3 pr-8 text-sm transition bg-white border shadow-sm appearance-none rounded-xl border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
      </div>
    </div>
  </div>
)

const ProbabilityBar = ({ label, percentage }) => {
  const color = percentage > 80 ? 'bg-blue-600' : (percentage > 50 ? 'bg-blue-400' : 'bg-blue-300');
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between font-medium text-slate-700">
        <span>{label}</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100">
        <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [heatmap, setHeatmap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('treatment')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const [pain, setPain] = useState('None')
  const [vision, setVision] = useState('No')
  const [itch, setItch] = useState('No')
  const [halos, setHalos] = useState('No')
  const [discharge, setDischarge] = useState('None')
  const [lightSens, setLightSens] = useState('No')
  const [spots, setSpots] = useState('No')

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isCropping, setIsCropping] = useState(false)

  useEffect(() => { return () => window.speechSynthesis.cancel() }, [])

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
    }
  }

  const handleCropConfirm = async () => {
    try {
      const croppedImage = await getCroppedImg(preview, croppedAreaPixels)
      setPreview(URL.createObjectURL(croppedImage))
      setFile(croppedImage)
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
      const response = await axios.post(`${apiUrl}/predict`, formData)
      if (response.data.error) throw new Error(response.data.error);
      setResult(response.data)
      setHeatmap(response.data.heatmap)
      setActiveTab('treatment')
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const resetApp = () => {
    setFile(null); setPreview(null); setResult(null); setHeatmap(null);
    setPain('None'); setVision('No'); setItch('No');
    setHalos('No'); setDischarge('None'); setLightSens('No'); setSpots('No');
    window.speechSynthesis.cancel(); setIsSpeaking(false);
  }

  const speakReport = () => {
    if (!result) return
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const text = `Diagnosis: ${result.diagnosis.replace(/_/g, ' ')}. ${result.details.advice}`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const brandColor = [0, 77, 153];
    const accentColor = [240, 248, 255];
    
    const addHeader = (pageTitle) => {
        doc.setFillColor(...brandColor);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("OphthalmoAI Diagnostics", 15, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(pageTitle, 200, 20, { align: 'right' });
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 200, 25, { align: 'right' });
    };

    const addFooter = (pageNumber) => {
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text("Disclaimer: AI screening tool only. Consult a specialist for confirmation.", 105, 285, { align: "center" });
        doc.text(`Page ${pageNumber}`, 200, 285, { align: "right" });
    };

    addHeader("Patient Report");
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Patient Intake Form (Self-Reported)", 15, 45);
    
    autoTable(doc, {
        startY: 50,
        head: [['Symptom Category', 'Patient Response']],
        body: [
            ['Pain Level', pain],
            ['Vision Blurry?', vision],
            ['Itchiness', itch],
            ['Halos / Glare', halos],
            ['Discharge', discharge],
            ['Light Sensitivity', lightSens],
            ['Floaters / Spots', spots]
        ],
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100] },
        styles: { fontSize: 10 }
    });

    const diagnosisY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. AI Diagnostic Result", 15, diagnosisY);

    doc.setDrawColor(0);
    doc.setFillColor(...accentColor);
    doc.roundedRect(15, diagnosisY + 5, 180, 35, 3, 3, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(...brandColor);
    doc.text(result.diagnosis.toUpperCase().replace(/_/g, ' '), 25, diagnosisY + 20);
    
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Confidence Score: ${result.confidence.toFixed(1)}%`, 25, diagnosisY + 30);
    
    doc.text(`Severity Level: ${result.details.severity}`, 100, diagnosisY + 30); 

    const imagingY = diagnosisY + 50;
    doc.setFontSize(12);
    doc.setTextColor(0,0,0);
    doc.setFont("helvetica", "bold");
    doc.text("3. Diagnostic Imaging", 15, imagingY);

    try {
        if (preview) {
            doc.addImage(preview, 'JPEG', 15, imagingY + 5, 80, 80);
            doc.setFontSize(9);
            doc.text("Patient Scan", 55, imagingY + 90, {align: 'center'});
        }
        if (heatmap) {
            doc.addImage(heatmap, 'JPEG', 110, imagingY + 5, 80, 80);
            doc.text("AI Attention Heatmap (Grad-CAM)", 150, imagingY + 90, {align: 'center'});
        }
    } catch (e) { console.log("Image add error", e); }

    addFooter(1);

    doc.addPage();
    addHeader("Clinical Analysis");

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("4. Condition Details", 15, 45);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(result.details.description, 180);
    doc.text(descLines, 15, 55);

    doc.setDrawColor(0, 77, 153);
    doc.setLineWidth(0.5);
    doc.line(15, 70, 195, 70);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 77, 153);
    doc.text("Doctor's Note / Clinical Advice:", 15, 80);
    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.setFont("helvetica", "normal");
    const adviceLines = doc.splitTextToSize(result.details.advice, 180);
    doc.text(adviceLines, 15, 90);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("5. Treatment Protocol", 15, 115);

    autoTable(doc, {
        startY: 120,
        head: [['Recommended Treatments']],
        body: result.details.treatment.map(t => [`• ${t}`]),
        theme: 'striped',
        headStyles: { fillColor: brandColor },
    });

    doc.text("6. Key Symptoms to Monitor", 15, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Symptoms']],
        body: result.details.symptoms.map(s => [`• ${s}`]),
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100] },
    });

    const statsData = Object.entries(result.probabilities)
        .sort(([, a], [, b]) => b - a)
        .map(([label, percentage]) => [label.replace(/_/g, ' '), `${percentage.toFixed(1)}%`]);

    doc.text("7. Differential Diagnosis (AI Confidence)", 15, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Potential Condition', 'Match Probability']],
        body: statsData,
        theme: 'striped',
        headStyles: { fillColor: [70, 70, 70] },
    });

    addFooter(2);

    doc.addPage();
    addHeader("Action Plan");

    let yPos = 45;

    if (result.hybrid_warnings && result.hybrid_warnings.length > 0) {
        doc.setFillColor(255, 235, 238);
        doc.rect(15, yPos, 180, 25 + (result.hybrid_warnings.length * 5), 'F');
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("⚠️ SAFETY ALERT", 25, yPos + 10);
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        result.hybrid_warnings.forEach((warn, i) => {
            doc.text(`• ${warn}`, 25, yPos + 20 + (i*6));
        });
        yPos += 40 + (result.hybrid_warnings.length * 5);
    }

    doc.setTextColor(0, 77, 153);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("8. Find Specialized Care", 15, yPos);

    yPos += 10;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, yPos, 180, 50, 3, 3, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text("Based on this analysis, professional consultation is recommended.", 25, yPos + 15);
    doc.text("Click the link below to find Ophthalmologists near your current location.", 25, yPos + 25);

    doc.setTextColor(0, 0, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const mapUrl = "https://www.google.com/maps/search/ophthalmologist+near+me";
    doc.textWithLink("CLICK HERE TO OPEN GOOGLE MAPS", 25, yPos + 40, { url: mapUrl });

    addFooter(3);
    
    doc.save(`Eye_Report_${timestamp}.pdf`);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter'] pb-10">
      
      {/* CROPPER MODAL */}
      {isCropping && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black bg-opacity-95">
            <div className="relative w-full max-w-md h-[50vh] sm:h-[60vh] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                <Cropper image={preview} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <div className="flex flex-col w-full max-w-md gap-3 mt-6 sm:flex-row">
              <button onClick={() => { setIsCropping(false); setFile(null); setPreview(null); }} className="flex-1 py-3 font-medium text-white transition bg-gray-700 rounded-xl hover:bg-gray-600">Cancel</button>
              <button onClick={handleCropConfirm} className="flex-1 py-3 font-bold text-white transition bg-blue-600 shadow-lg rounded-xl hover:bg-blue-500 shadow-blue-900/20">Confirm Crop</button>
            </div>
            <p className="flex items-center gap-2 mt-4 text-xs text-gray-400 sm:text-sm">
              <ScanEye className="w-4 h-4" /> Pinch or scroll to zoom
            </p>
        </div>
      )}

      <nav className="sticky top-0 z-40 transition-all duration-200 border-b bg-white/90 border-slate-200 backdrop-blur-md">
        <div className="flex items-center justify-between h-16 px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 shadow-sm bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
              <Activity className="w-5 h-5 text-white sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg font-bold tracking-tight text-transparent sm:text-xl bg-clip-text bg-gradient-to-r from-blue-800 to-blue-600">
              OphthalmoAI
            </span>
          </div>
          <div className="hidden sm:flex text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wide">
            Pro V4
          </div>
        </div>
      </nav>

      <main className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 sm:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* LEFT: UPLOAD & INPUTS */}
          <div className="space-y-6 lg:col-span-5">
            <div className="overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200/60">
              <div className="p-1">
                {!preview ? (
                    <label className="flex flex-col items-center justify-center h-64 transition-all border-2 border-dashed cursor-pointer sm:h-80 border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-300 group">
                        <div className="p-4 mb-4 transition-transform duration-300 bg-white rounded-full shadow-sm group-hover:scale-110">
                          <Upload className="w-8 h-8 text-blue-500 sm:w-10 sm:h-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-600 sm:text-base">Upload Eye Scan</span>
                        <span className="mt-1 text-xs text-slate-400">JPG, PNG supported</span>
                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </label>
                ) : (
                    <div className="relative h-64 overflow-hidden bg-black rounded-2xl sm:h-80 group">
                        <img src={showHeatmap && heatmap ? heatmap : preview} className="object-contain w-full h-full transition-opacity duration-300" />
                        
                        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 transition-opacity duration-300 opacity-0 bg-gradient-to-t from-black/80 to-transparent group-hover:opacity-100">
                           {heatmap && (
                              <button 
                                onClick={() => setShowHeatmap(!showHeatmap)}
                                className="bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 hover:bg-white/30 transition"
                              >
                                {showHeatmap ? <Eye className="w-3 h-3"/> : <ScanEye className="w-3 h-3"/>}
                                {showHeatmap ? "Original" : "AI Vision"}
                              </button>
                           )}
                        </div>
                    </div>
                )}
              </div>

              <div className="p-6">
                {/* SYMPTOM QUESTIONNAIRE */}
                {preview && !result && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-2 pb-3 text-blue-900 border-b border-blue-50">
                          <div className="bg-blue-100 p-1.5 rounded-lg">
                            <HelpCircle className="w-4 h-4 text-blue-600"/> 
                          </div>
                          <h3 className="text-sm font-bold tracking-wide uppercase">Patient Check</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <SymptomSelect label="Pain Level" value={pain} setValue={setPain} options={['None', 'Mild', 'Severe', 'Not Sure']} />
                            <SymptomSelect label="Vision Blurry?" value={vision} setValue={setVision} options={['No', 'Yes', 'Not Sure']} />
                            <SymptomSelect label="Itchy?" value={itch} setValue={setItch} options={['No', 'Yes', 'Not Sure']} />
                            <SymptomSelect label="Discharge?" value={discharge} setValue={setDischarge} options={['None', 'Watery', 'Thick/Yellow', 'Not Sure']} />
                            <SymptomSelect label="Halos / Glare?" value={halos} setValue={setHalos} options={['No', 'Yes', 'Not Sure']} />
                            <SymptomSelect label="Light Sensitive?" value={lightSens} setValue={setLightSens} options={['No', 'Yes', 'Not Sure']} />
                            <div className="col-span-2">
                              <SymptomSelect label="Seeing Spots/Floaters?" value={spots} setValue={setSpots} options={['No', 'Yes', 'Not Sure']} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 mt-6">
                  <button 
                    onClick={handleAnalyze} 
                    disabled={!file || loading} 
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2
                      ${loading ? 'bg-slate-800 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] hover:shadow-xl'}`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        Run Diagnosis <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  
                  {result && (
                    <button onClick={resetApp} className="flex items-center justify-center w-full gap-2 py-3 font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl">
                      <RefreshCw className="w-4 h-4" /> New Scan
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: RESULTS */}
          <div className="lg:col-span-7">
            {result ? (
              <div className="space-y-6 animate-fade-in">
                
                {/* DIAGNOSIS CARD */}
                <div className={`relative overflow-hidden p-6 sm:p-8 rounded-3xl shadow-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6
                  ${result.diagnosis === 'Normal' 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20' 
                    : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20'}`}>
                  
                  <div className="absolute top-0 right-0 w-40 h-40 -mt-10 -mr-10 rounded-full bg-white/10 blur-3xl"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold tracking-wider uppercase opacity-90">
                      <Activity className="w-4 h-4" /> AI Assessment Complete
                    </div>
                    <h2 className="mb-2 text-3xl font-bold sm:text-4xl">{result.diagnosis.replace(/_/g, ' ')}</h2>
                    <div className="inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full bg-white/20 backdrop-blur-sm">
                      <span>{result.confidence.toFixed(1)}% Confidence</span>
                    </div>
                  </div>
                  
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="p-4 shadow-inner bg-white/20 rounded-2xl backdrop-blur-md">
                      {result.diagnosis === 'Normal' ? <CheckCircle2 className="w-8 h-8 text-white sm:w-12 sm:h-12" /> : <AlertTriangle className="w-8 h-8 text-white sm:w-12 sm:h-12" />}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <button onClick={speakReport} className={`p-2.5 rounded-xl transition backdrop-blur-md shadow-sm ${isSpeaking ? 'bg-white text-rose-600 animate-pulse' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <button onClick={downloadPDF} className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition backdrop-blur-md shadow-sm text-white">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SAFETY ALERTS */}
                {result.hybrid_warnings && result.hybrid_warnings.length > 0 && (
                    <div className="flex items-start gap-4 p-5 border-l-4 shadow-sm bg-amber-50 border-amber-500 rounded-xl">
                        <ShieldAlert className="w-6 h-6 mt-1 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="mb-1 font-bold text-amber-800">Clinical Safety Alerts</h4>
                          {result.hybrid_warnings.map((w, i) => (
                            <p key={i} className="mb-1 text-sm leading-snug text-amber-700">• {w}</p>
                          ))}
                        </div>
                    </div>
                )}

                {/* TABBED REPORT PANEL */}
                <div className="overflow-hidden bg-white border shadow-lg rounded-3xl border-slate-200">
                    <div className="flex overflow-x-auto border-b border-slate-100 scrollbar-hide">
                        <TabButton active={activeTab === 'treatment'} onClick={() => setActiveTab('treatment')} icon={<Pill className="w-4 h-4" />} label=" Treatment Plan" />
                        <TabButton active={activeTab === 'doctor'} onClick={() => setActiveTab('doctor')} icon={<Stethoscope className="w-4 h-4" />} label="Doctor's Note" />
                        <TabButton active={activeTab === 'symptoms'} onClick={() => setActiveTab('symptoms')} icon={<ClipboardList className="w-4 h-4" />} label="Symptoms" />
                        <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<Layers className="w-4 h-4" />} label="AI Stats" />
                    </div>

                    <div className="p-6 sm:p-8 min-h-[300px]">
                        {activeTab === 'treatment' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold tracking-wider uppercase text-slate-400">Immediate Action</h4>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${result.details.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    Severity: {result.details.severity}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                    {result.details.treatment.map((t, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 transition border rounded-2xl bg-slate-50 border-slate-100 hover:border-blue-200 hover:shadow-sm">
                                            <div className="p-2 bg-green-100 rounded-full shrink-0">
                                              <Pill className="w-5 h-5 text-green-600" />
                                            </div>
                                            <p className="pt-1 text-sm font-medium text-slate-700 sm:text-base">{t}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'doctor' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="p-6 border border-blue-100 bg-blue-50/50 rounded-2xl">
                                    <h4 className="flex items-center gap-2 mb-3 font-bold text-blue-900">
                                        <Stethoscope className="w-5 h-5 text-blue-600" /> Clinical Assessment
                                    </h4>
                                    <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{result.details.advice}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                                       <p className="mb-1 text-xs font-bold uppercase text-slate-400">Condition</p>
                                       <p className="text-sm font-medium text-slate-800">{result.details.description}</p>
                                  </div>
                                  <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                                       <p className="mb-1 text-xs font-bold uppercase text-slate-400">Anatomical Group</p>
                                       <p className="text-sm font-medium text-slate-800">{result.group_name}</p>
                                  </div>
                                </div>

                                <a href="https://www.google.com/maps/search/ophthalmologist+near+me" target="_blank" className="flex items-center justify-center w-full gap-2 py-4 font-bold text-blue-600 transition border-2 border-blue-100 rounded-xl hover:bg-blue-50">
                                    <MapPin className="w-5 h-5" /> Find Nearby Specialist
                                </a>
                            </div>
                        )}

                        {activeTab === 'symptoms' && (
                            <div className="animate-fade-in">
                                 <h4 className="mb-4 text-sm font-bold tracking-wider uppercase text-slate-400">Common Indicators</h4>
                                 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {result.details.symptoms.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-white border shadow-sm rounded-xl border-slate-100">
                                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                            <span className="text-sm font-medium text-slate-700">{s}</span>
                                        </div>
                                    ))}
                                 </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="space-y-6 animate-fade-in">
                                <div>
                                  <p className="mb-1 font-semibold text-slate-900">Differential Diagnosis</p>
                                  <p className="mb-4 text-sm text-slate-500">AI confidence distribution across {result.group_name}</p>
                                </div>
                                <div className="space-y-4">
                                    {Object.entries(result.probabilities)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([label, percentage], i) => (
                                        <ProbabilityBar key={i} label={label.replace(/_/g, ' ')} percentage={percentage} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

              </div>
            ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 mx-4 sm:mx-0">
                    <Activity className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-medium">Ready to Analyze</p>
                    <p className="mt-1 text-sm opacity-60">Upload a scan to begin</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App