import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Upload, AlertTriangle, CheckCircle, Loader2, Mic, MicOff } from 'lucide-react';
import { Resident, AIObservationResult } from '../types';
import { BodyDiagram } from './BodyDiagram';

interface ResidentProfileProps {
  resident: Resident;
  onBack: () => void;
  onSubmitObservation: (photoUrl: string, aiResult: AIObservationResult) => void;
}

export function ResidentProfile({ resident, onBack, onSubmitObservation }: ResidentProfileProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIObservationResult | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedBodyLocation, setSelectedBodyLocation] = useState<string | null>(null);
  
  // Care Note state
  const [careNoteInput, setCareNoteInput] = useState('');
  const [isGeneratingCareNote, setIsGeneratingCareNote] = useState(false);
  const [careNoteDraft, setCareNoteDraft] = useState<string | null>(null);
  const [careNoteError, setCareNoteError] = useState<string | null>(null);
  const [isCareNoteSaved, setIsCareNoteSaved] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported] = useState<boolean>(
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );

  // Daily Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (speechSupported && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      // Recommend English, handles various accents well with Gemini's backend cleanup
      recognitionRef.current.lang = 'en-AU'; 

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setCareNoteInput((prev) => {
            const space = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + space + finalTranscript.trim() + ' ';
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setCareNoteError("Microphone access was denied. Please check your browser or frame permissions.");
        } else {
          setCareNoteError(`Microphone error: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, [speechSupported]);

  const toggleRecording = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording', err);
      }
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    setDailySummary(null);

    let inputs = `Basic Care Status: Bath is '${resident.bathStatus}', Meal is '${resident.mealStatus}', Toilet is '${resident.toiletStatus}'.\n\n`;
    
    if (careNoteDraft && isCareNoteSaved) {
      inputs += `Progress Note recorded today: ${careNoteDraft}\n\n`;
    }
    
    if (aiResult && isConfirmed) {
       inputs += `Clinical observation logged today: Type: ${aiResult.observationType}. Location: ${selectedBodyLocation || 'Not specified'}. Details: ${aiResult.observation}. Risk flag: ${aiResult.potentialRiskFlag}.\n\n`;
    }

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Server returned an error page or cookie check instead of JSON. Please temporarily disable AdBlock/Privacy blockers or try opening the app in a new tab.');
      }
      
      if (!response.ok) throw new Error(data?.error || `Server error ${response.status}`);
      setDailySummary(data.result);
    } catch(err: any) {
      console.error(err);
      setSummaryError(err.message || 'Failed to generate summary.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateCareNote = async () => {
    if (!careNoteInput.trim()) return;

    setIsGeneratingCareNote(true);
    setCareNoteDraft(null);
    setCareNoteError(null);
    setIsCareNoteSaved(false);

    try {
      const response = await fetch('/api/care-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: careNoteInput }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Action blocked by browser cookie settings. Please open this app in a new tab to authenticate and continue.');
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error ${response.status}`);
      }

      setCareNoteDraft(data.result);
    } catch (err: any) {
      console.error(err);
      setCareNoteError(err.message || 'Failed to generate care note.');
    } finally {
      setIsGeneratingCareNote(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2);

  const processFile = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setAiResult(null);
    setIsConfirmed(false);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('observationImage', file);

      const response = await fetch('/api/vision', {
        method: 'POST',
        body: formData,
      });

      const text = await response.text();
      if (text.trim().startsWith('<')) {
        console.error("Raw HTML response:", text);
        throw new Error("Action blocked by browser cookie settings. Please OPEN IN NEW TAB (using the arrow icon at the top right of the preview) to authenticate and continue.");
      }
      
      let data;
      try {
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        data = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error(`Failed to parse response (Status ${response.status}): ${text.substring(0, 300)}`);
      }
      
      if (!response.ok) {
        throw new Error(data?.error || `Server error ${response.status}`);
      }
      
      setAiResult(data.result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to analyze image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto font-light">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 font-normal"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
        <div className="bg-slate-50 px-6 py-8 sm:px-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-3xl font-bold border border-teal-100">
            {getInitials(resident.name)}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-normal text-slate-800 tracking-tight">{resident.name}</h1>
            <p className="text-lg text-slate-500 font-light mt-1">{resident.room}</p>
          </div>
          <div className="ml-auto flex gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 text-center min-w-[100px]">
              <div className="text-3xl font-light text-slate-700">{resident.careMinutesToday}</div>
              <div className="text-xs font-normal text-slate-400 uppercase tracking-widest mt-1">mins</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-center min-w-[100px]">
               <div className={`w-8 h-8 rounded-full ${
                  resident.statusColor === 'green' ? 'bg-teal-400' :
                  resident.statusColor === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
               }`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium tracking-tight text-slate-800 flex items-center gap-2">
            Today's Summary
          </h2>
          <button 
            onClick={handleGenerateSummary}
            disabled={isGeneratingSummary}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-medium py-2 px-3 sm:px-4 rounded-xl transition-colors flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 shrink-0"
          >
            {isGeneratingSummary ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : null}
            <span className="hidden sm:inline">Generate </span>Today's Summary
          </button>
        </div>

        {summaryError && (
          <div className="mb-4 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm">
            <strong>Error: </strong> {summaryError}
          </div>
        )}

        {isGeneratingSummary ? (
          <div className="border border-slate-200 rounded-2xl bg-white p-8 flex flex-col items-center justify-center text-center">
             <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-3 font-light" />
             <h3 className="text-md font-normal text-slate-700">Gemini is summarising today's records...</h3>
          </div>
        ) : dailySummary ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
               <h3 className="font-medium text-slate-800">Daily Wellness Summary</h3>
               <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             </div>
             <div className="p-6 text-sm text-slate-700 leading-relaxed font-light whitespace-pre-wrap">
               {dailySummary}
             </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Diagram & Upload Action */}
        <div className="space-y-6">
          <BodyDiagram 
            selectedLocation={selectedBodyLocation} 
            onLocationSelect={setSelectedBodyLocation} 
          />

          <div 
            className={`bg-white border text-center rounded-2xl p-8 transition-all duration-300 ${
              !selectedBodyLocation 
                ? 'border-slate-200 border-dashed bg-slate-50 opacity-80 hover:opacity-100' 
                : isDragging 
                  ? 'border-teal-500 bg-teal-50 border-solid' 
                  : 'border-teal-200 ring-1 ring-teal-100 shadow-sm'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <h2 className="text-xl font-normal text-slate-800 mb-2">Record Observation</h2>
            <p className="text-slate-500 mb-8 text-sm font-light">
              {!selectedBodyLocation 
                ? "Select a location first, then add a photo (or proceed without location)."
                : "Now take a photo, or drag and drop a picture for AI-assisted documentation."
              }
            </p>

            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            
            <div className="grid grid-cols-2 gap-4">
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 border rounded-xl p-6 transition-colors group ${
                    !selectedBodyLocation
                      ? 'border-slate-200 hover:bg-white hover:border-slate-300'
                      : 'border-teal-100 hover:bg-teal-50 hover:border-teal-300 bg-white'
                  }`}
                >
                  <Camera className={`w-8 h-8 mb-1 ${!selectedBodyLocation ? 'text-slate-400 group-hover:text-slate-500' : 'text-teal-500 group-hover:text-teal-600'}`} />
                  <span className={`font-normal text-sm ${!selectedBodyLocation ? 'text-slate-500' : 'text-teal-700'}`}>Take Photo</span>
                </button>
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 border rounded-xl p-6 transition-colors group ${
                    !selectedBodyLocation
                      ? 'border-slate-200 hover:bg-white hover:border-slate-300'
                      : 'border-teal-100 hover:bg-teal-50 hover:border-teal-300 bg-white'
                  }`}
                >
                  <Upload className={`w-8 h-8 mb-1 ${!selectedBodyLocation ? 'text-slate-400 group-hover:text-slate-500' : 'text-teal-500 group-hover:text-teal-600'}`} />
                  <span className={`font-normal text-sm ${!selectedBodyLocation ? 'text-slate-500' : 'text-teal-700'}`}>Upload File</span>
                </button>
            </div>

            {photoPreview && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden p-1 bg-white shadow-sm">
                <img src={photoPreview} alt="Observation preview" className="w-full h-48 object-cover rounded-lg" />
              </div>
            )}

            {errorMsg && (
              <div className="mt-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm text-left">
                <strong>Error: </strong> {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: AI Result */}
        <div>
           {isUploading ? (
             <div className="h-full border border-slate-200 rounded-2xl bg-white p-10 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4 font-light" />
                <h3 className="text-lg font-normal text-slate-700">Gemini is analyzing... (results usually appear within 10 seconds)</h3>
                <p className="text-slate-500 text-sm mt-2 font-light">Processing the observation securely.</p>
             </div>
           ) : errorMsg ? (
             <div className="h-full border border-red-200 rounded-2xl bg-red-50 p-10 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
                <h3 className="text-lg font-normal text-red-700">Analysis Failed</h3>
                <p className="text-red-600 text-sm mt-2 font-light">{errorMsg}</p>
             </div>
           ) : aiResult ? (
             <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-teal-50/50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-teal-600" />
                    <h3 className="font-normal text-slate-800">AI Observation Note</h3>
                  </div>
                  <span className="text-xs font-normal uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-1 rounded">Draft</span>
                </div>
                
                <div className="p-6 space-y-5">
                  <div>
                    <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Visual Observation</span>
                    <p className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed font-light">{aiResult.observation}</p>
                  </div>
                  
                  {aiResult.observationType === 'excrement' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Colour</span>
                          <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-normal text-sm text-slate-700">{aiResult.colour || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Bristol Stool Type</span>
                          <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-normal text-sm text-slate-700">{aiResult.bristolStoolType || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                          <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Potential Risk Flag</span>
                          <p className="bg-amber-50 text-amber-700 p-3 rounded-lg border border-amber-100 font-normal text-sm">{aiResult.potentialRiskFlag}</p>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Size / Type Estimate</span>
                        <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-normal text-sm text-slate-700">{aiResult.estimatedSizeOrType}</p>
                      </div>
                      <div>
                          <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Potential Risk Flag</span>
                          <p className="bg-amber-50 text-amber-700 p-3 rounded-lg border border-amber-100 font-normal text-sm">{aiResult.potentialRiskFlag}</p>
                      </div>
                    </div>
                  )}

                  {aiResult.observationType === 'wound' && (
                    <div className="mt-4">
                      <span className="block text-xs font-normal text-slate-400 uppercase mb-2">Location</span>
                      <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-normal text-sm text-slate-700">{selectedBodyLocation || "Not specified"}</p>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-4">
                    <p className="text-xs text-slate-400 text-center font-light">
                      AI observation, not a medical diagnosis. RN confirmation required.
                    </p>
                    {isConfirmed ? (
                       <div className="bg-teal-50 text-teal-700 font-normal p-3 rounded-lg flex items-center justify-center gap-2 border border-teal-100">
                         <CheckCircle className="w-4 h-4" /> Submitted for RN Review
                       </div>
                    ) : (
                       <button 
                         onClick={() => {
                           setIsConfirmed(true);
                           if (photoPreview) {
                             onSubmitObservation(photoPreview, {
                               ...aiResult,
                               bodyLocation: selectedBodyLocation || "Not specified"
                             });
                           }
                         }}
                         className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-normal rounded-lg transition-colors flex items-center justify-center gap-2"
                       >
                         <CheckCircle className="w-4 h-4" />
                         Submit for RN Review
                       </button>
                    )}
                  </div>
                </div>
             </div>
           ) : (
             <div className="h-full border border-slate-200 border-dashed rounded-2xl bg-slate-50 p-10 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-slate-200 mb-4">
                  <AlertTriangle className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-lg font-normal text-slate-600">No active AI observation</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-xs font-light">Upload a photo to see the automated clinical note draft here.</p>
             </div>
           )}
        </div>
      </div>

      {/* Daily Care Note Generator Section */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <h2 className="text-xl font-medium tracking-tight text-slate-800 mb-6 flex items-center gap-2">
          Daily Care Note Generator
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700 block">Carer's Casual Input</h3>
              {speechSupported ? (
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isRecording 
                      ? 'bg-red-50 text-red-600 border border-red-200' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Listening...
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Voice Input
                    </>
                  )}
                </button>
              ) : (
                 <span className="text-xs text-slate-400 flex items-center gap-1">
                   <MicOff className="w-3 h-3" /> Voice not supported
                 </span>
              )}
            </div>
            <textarea
              className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-light leading-relaxed mb-4"
              placeholder="E.g. Took Mr. Chen for a walk in the garden, he had a shower, ate most of his lunch, mood was good."
              value={careNoteInput}
              onChange={(e) => setCareNoteInput(e.target.value)}
            />
            <button
              onClick={handleGenerateCareNote}
              disabled={isGeneratingCareNote || !careNoteInput.trim()}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGeneratingCareNote ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Note...</>
              ) : (
                'Generate Progress Note'
              )}
            </button>
            {careNoteError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{careNoteError}</p>
              </div>
            )}
          </div>

          <div>
             {isGeneratingCareNote ? (
               <div className="h-full border border-slate-200 rounded-2xl bg-white p-10 flex flex-col items-center justify-center text-center mt-0 min-h-[200px]">
                  <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4 font-light" />
                  <h3 className="text-lg font-normal text-slate-700">Gemini is drafting the note...</h3>
               </div>
             ) : careNoteDraft ? (
               <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-teal-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-medium text-slate-800">Generated Progress Note</h3>
                    <span className="text-xs font-medium uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-1 rounded">Draft</span>
                  </div>
                  <div className="p-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed font-light whitespace-pre-wrap">
                      {careNoteDraft}
                    </div>
                    {isCareNoteSaved ? (
                      <div className="mt-6 bg-teal-50 text-teal-700 font-medium p-3 rounded-xl flex items-center justify-center gap-2 border border-teal-100">
                        <CheckCircle className="w-4 h-4" /> Saved to Resident Record
                      </div>
                    ) : (
                      <button 
                         onClick={() => setIsCareNoteSaved(true)}
                         className="mt-6 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                         <CheckCircle className="w-4 h-4" />
                         Save to Resident Record
                      </button>
                    )}
                  </div>
               </div>
             ) : (
               <div className="h-full border border-slate-200 border-dashed rounded-2xl bg-slate-50 p-10 flex flex-col items-center justify-center text-center min-h-[200px]">
                  <p className="text-slate-400 text-sm font-light">The clinical progress note will appear here.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
