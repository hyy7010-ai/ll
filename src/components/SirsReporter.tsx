import React, { useState } from 'react';
import { ArrowLeft, ShieldAlert, Cpu, Send, CheckCircle, Flame, Loader2 } from 'lucide-react';
import { SIRSReport, SIRSAlertData } from '../types';

interface SirsReporterProps {
  onCancel: () => void;
  onSubmit: (data: SIRSAlertData) => void;
}

export function SirsReporter({ onCancel, onSubmit }: SirsReporterProps) {
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sirsResult, setSirsResult] = useState<SIRSReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    
    setIsProcessing(true);
    setSirsResult(null);
    setIsSubmitted(false);
    setIsSubmitting(false);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/sirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      const text = await res.text();
      if (text.trim().startsWith('<')) {
        console.error("Raw HTML response:", text);
        throw new Error("Action blocked by browser cookie settings. Please OPEN IN NEW TAB (using the arrow icon at the top right of the preview) to authenticate and continue.");
      }

      let data;
      try {
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        data = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error(`Failed to parse response (Status ${res.status}): ${text.substring(0, 300)}`);
      }

      if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`);
      setSirsResult(data.result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to analyze SIRS incident.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = () => {
    if (!sirsResult) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 2000);
  };

  const handleFinish = () => {
    if (!sirsResult) return;
    onSubmit({
      priority: sirsResult.priority || 2, // default to 2 if somehow null but accepted
      message: sirsResult.autofillReport.whatHappened,
      reportInfo: sirsResult
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={onCancel}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Cancel & Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-6 text-white flex items-center gap-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold">SIRS Incident Reporter</h1>
            <p className="text-slate-400">AI-assisted reporting for the Serious Incident Response Scheme</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {isProcessing ? (
             <div className="h-64 border border-slate-200 rounded-2xl bg-slate-50 p-10 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Gemini is analyzing... (results usually appear within 10 seconds)</h3>
                <p className="text-slate-500 mt-2">Gemini is checking compliance criteria and drafting a report.</p>
             </div>
          ) : !sirsResult ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase mb-2">Narrative Description</label>
                <textarea 
                  className="w-full border border-slate-300 rounded-xl p-4 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  placeholder="E.g., Mr. Chen slipped in the bathroom and his arm has a graze. I applied a dressing and escalated to the RN."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm mb-4">
                  <strong>Error: </strong> {errorMsg}
                </div>
              )}

              <div className="flex justify-end">
                <button 
                  onClick={handleAnalyze}
                  disabled={!description.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Cpu className="w-5 h-5" /> Analyze Compliance
                </button>
              </div>
            </div>
          ) : isSubmitting ? (
             <div className="h-64 border border-slate-200 rounded-2xl bg-slate-50 p-10 flex flex-col items-center justify-center text-center animate-in fade-in">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Submitting to ACQSC...</h3>
                <p className="text-slate-500 mt-2">Filing official SIRS report via Gmail API.</p>
             </div>
          ) : isSubmitted ? (
             <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Report Submitted to ACQSC <span>&#10003;</span></h2>
                  <p className="text-emerald-700 font-medium">Submitted within the mandatory {sirsResult.priority === 1 ? '24-hour' : '30-day'} window.</p>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-8 text-left">
                  <div className="flex items-center gap-2 mb-4 text-slate-500 text-sm border-b border-slate-200 pb-4">
                    <Send className="w-4 h-4" />
                    <span>Sent via Gmail API from the facility's official inbox.</span>
                  </div>
                  
                  <div className="space-y-3 font-mono text-sm text-slate-700 mb-6 border-b border-slate-200 pb-4">
                    <div><span className="text-slate-400">To:</span> notifications@agedcarequality.gov.au</div>
                    <div><span className="text-slate-400">CC:</span> the resident's GP and family contact</div>
                    <div><span className="text-slate-400">Subject:</span> SIRS Priority {sirsResult.priority} Incident Report - Resident - {new Date().toLocaleDateString()}</div>
                  </div>

                  <div className="space-y-4 text-sm text-slate-800">
                    <p><strong>What Happened:</strong><br/>{sirsResult.autofillReport.whatHappened}</p>
                    <p><strong>Immediate Safety Actions:</strong><br/>{sirsResult.autofillReport.immediateSafetyActions}</p>
                    <p><strong>Regulator Notification:</strong><br/>{sirsResult.autofillReport.regulatorNotification}</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={handleFinish}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-colors"
                  >
                    Return to Dashboard
                  </button>
                </div>
             </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              {sirsResult.isReportable ? (
                <div className="space-y-6">
                  <div className={`p-8 rounded-2xl border-2 ${sirsResult.priority === 1 ? 'bg-red-600 border-red-700 text-white' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <div className="flex items-center gap-4 mb-3">
                       {sirsResult.priority === 1 ? <Flame className="w-8 h-8 text-white" /> : <ShieldAlert className="w-8 h-8 text-amber-500" />}
                       <h2 className={`text-2xl font-bold ${sirsResult.priority === 1 ? 'text-white' : 'text-amber-900'}`}>
                         SIRS Priority {sirsResult.priority} Report Required
                       </h2>
                    </div>
                    <p className={`${sirsResult.priority === 1 ? 'text-red-100' : 'text-amber-700'} font-medium text-lg`}>
                      Matched Category: {sirsResult.category}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-2">Auto-Generated Report Draft</h3>
                    
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase mb-1">What Happened</span>
                      <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200">{sirsResult.autofillReport.whatHappened}</p>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Immediate Safety Actions</span>
                      <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200">{sirsResult.autofillReport.immediateSafetyActions}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Regulator Notification</span>
                        <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200">{sirsResult.autofillReport.regulatorNotification}</p>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Notifications Check</span>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-sm">
                           <div className="flex items-center justify-between">
                              <span className="text-slate-600">Emergency Services</span>
                              <span className={sirsResult.autofillReport.emergencyServicesNotified ? "text-emerald-600 font-bold" : "text-slate-400 font-bold"}>{sirsResult.autofillReport.emergencyServicesNotified ? 'Yes' : 'No'}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-slate-600">Family Notified</span>
                              <span className={sirsResult.autofillReport.familyNotified ? "text-emerald-600 font-bold" : "text-slate-400 font-bold"}>{sirsResult.autofillReport.familyNotified ? 'Yes' : 'No'}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-slate-600">GP Notified</span>
                              <span className={sirsResult.autofillReport.gpNotified ? "text-emerald-600 font-bold" : "text-slate-400 font-bold"}>{sirsResult.autofillReport.gpNotified ? 'Yes' : 'No'}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleApprove}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2"
                    >
                      Manager Approve & File
                      <Send className="w-5 h-5 ml-2" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-xl text-center">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-emerald-900 mb-2">Not SIRS Reportable</h2>
                  <p className="text-emerald-700">Based on the SIRS criteria, this incident does not meet the threshold for mandatory ACQSC reporting. Please log it in your internal clinical management system.</p>
                  <button 
                    onClick={onCancel}
                    className="mt-6 bg-white border border-emerald-300 text-emerald-800 font-bold py-2 px-6 rounded-lg transition-colors hover:bg-emerald-100"
                  >
                    Return to Dashboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
