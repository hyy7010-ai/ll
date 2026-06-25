import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';

// Set up Multer for handling file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Initialize Gemini lazy
  let ai: GoogleGenAI | null = null;
  const getAi = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing');
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return ai;
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  async function generateWithRetry(request: any): Promise<any> {
    const aiClient = getAi();
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await aiClient.models.generateContent(request);
      } catch (e: any) {
        const msg = String(e.message || '');
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          if (i === maxRetries - 1) throw e;
          const match = msg.match(/retry in ([\d\.]+)s/);
          let waitTime = match && match[1] ? parseFloat(match[1]) * 1000 + 1000 : Math.pow(2, i) * 3000;
          waitTime = Math.min(waitTime, 60000);
          console.log(`Rate limit hit, retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1} of ${maxRetries})`);
          await delay(waitTime);
        } else {
          throw e;
        }
      }
    }
  }

  // API Route: AI Observation (Wound/Excrement)
  app.post('/api/vision', upload.single('observationImage'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      // Convert buffer to base64 for Gemini
      const fileData = {
        inlineData: {
          data: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype,
        },
      };

      const prompt = `
        You are an AI assistant in an aged care facility. 
        First determine whether the image shows a "wound"/skin injury or "excrement" (stool/urine).
        CRITICAL: NEVER give a medical diagnosis. Only describe observations and potential risks.
        
        If it is a WOUND, return structured JSON with the following keys exactly:
        - observationType: "wound"
        - observation: A detailed string describing what you see.
        - estimatedSizeOrType: A string for estimated size/shape (visual only).
        - potentialRiskFlag: A concise string describing the potential risk.
        - suggestedCarePlan: A string providing a suggested temporary dressing/first aid care plan based on standard Australian aged care clinical wound guidelines. Specify that this is a temporary suggestion until RN arrival.
        
        If it is EXCREMENT, return structured JSON with the following keys exactly:
        - observationType: "excrement"
        - observation: A plain descriptive string of what is visible.
        - colour: The observed colour.
        - bristolStoolType: Type 1-7 based on the Bristol Stool Chart, or 'unclear'.
        - potentialRiskFlag: A concise description of POTENTIAL risk (e.g. GI bleeding).
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { text: prompt },
            { 
              inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
              }
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      let rawText = response.text || '';
      let parsedResult;
      try {
        rawText = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        parsedResult = JSON.parse(rawText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw string:', rawText);
        return res.status(500).json({ error: 'Failed to parse AI response. Raw output: ' + rawText });
      }

      res.json({ result: parsedResult });
    } catch (error: any) {
      console.error('Vision API Error:', error);
      let errorMsg = error.message || 'Failed to process AI observation';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route: Audio Care Note Translation
  app.post('/api/audio-note', upload.single('audioRecording'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      const prompt = `
        You are a professional Registered Nurse in an Australian aged care facility.
        Please listen to the following voice recording (which may be in any language, e.g., Chinese, Tagalog, Spanish, basic or broken English).
        
        1. Translate and interpret the core events described.
        2. Transform the raw description into a highly professional, clinical, and objective aged care progress note.
        3. Use standard clinical terminology (e.g., "Resident exhibited initial behavioral resistance...", "Skin intact", "Verbally redirected").
        4. Remove all conversational filler. Focus purely on facts, interventions, and outcomes.
        
        CRITICAL TASK: Detect the language spoken in the audio recording. If it is NOT English (e.g. it is Mandarin, Tagalog, etc.), translate the final English note back into that detected language as a 'nativeConfirmation' so the carer can verify the record. If the audio is in English, leave it empty.
        
        Return your response in structured JSON format with these exact keys:
        - englishNote: string (the professional progress note in English, plain text without markdown)
        - nativeConfirmation: string (the translated confirmation in the carer's native language, or empty if English)
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { text: prompt },
            { 
              inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
              }
            }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      let rawText = response.text || '';
      let parsedResult;
      try {
        rawText = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        parsedResult = JSON.parse(rawText);
      } catch (e) {
        parsedResult = { englishNote: rawText.replace(/[\*#]/g, '').trim(), nativeConfirmation: '' };
      }

      res.json({ result: parsedResult });
    } catch (error: any) {
      console.error('Audio API Error:', error);
      let errorMsg = error.message || 'Failed to process audio';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route: SIRS Incident Reporter
  app.post('/api/sirs', async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: 'Incident description is required' });
      }

      const prompt = `
        You are an AI assistant in an Australian aged care facility.
        Review the following incident description: "${description}"
        Reason about Australia's Serious Incident Response Scheme (SIRS) rules.
        
        CRITICAL TASK: First, use your Google Search tool to retrieve the most up-to-date guidelines from the "Aged Care Quality and Safety Commission (ACQSC) Serious Incident Response Scheme (SIRS)", specifically focusing on reportable incident categories and the reporting timeframes for Priority 1 and Priority 2 incidents.
        You MUST prioritize the real-time official guidelines you find over any baseline knowledge.
        
        Baseline Reference Rules (verify these against your search results):
        - A FALL that results in an injury requiring treatment (e.g. a graze needing a dressing) is a REPORTABLE serious incident.
        - Priority 1: causes physical/psychological injury requiring medical or psychological treatment, OR suspected criminal conduct → report within 24 hours.
        - Priority 2: all other reportable incidents → report within 30 days.
        - A graze that required a dressing = injury requiring treatment = Priority 1, within 24 hours.
        - Do NOT classify an accidental fall as "Neglect". Neglect means failure to provide care. An accidental fall with injury should be categorised as "Fall resulting in injury (reportable serious incident)".
        
        Based on the LIVE rules you just searched, determine if this is a reportable serious incident under SIRS.
        Determine the matched category (e.g., Unreasonable use of force, Unlawful sexual contact, Psychological or emotional abuse, Unexpected death, Stealing or financial coercion, Neglect, Inappropriate use of restrictive practices, Unexplained absence from care, Fall resulting in injury).
        Determine the priority level: Priority 1 (reportable within 24 hours) or Priority 2 (reportable within 30 days).
        Draft a compliance report summary.
        
        Format your response as structured JSON with the following keys:
        - isReportable: boolean
        - category: string (the aligned SIRS category)
        - priority: number (1 or 2, default to null if not reportable)
        - autofillReport: An object with the following keys:
          - whatHappened: string
          - immediateSafetyActions: string
          - emergencyServicesNotified: boolean
          - familyNotified: boolean
          - gpNotified: boolean
          - regulatorNotification: string
          - preventiveActions: string
        - confidenceScore: number (0 to 100, how confident are you in this classification based on the latest guidelines)
        - uncertaintyFlag: string (If confidence is < 90, explain what is unclear and why an RN needs to review. If confident, return an empty string)

        CRITICAL FORMATTING INSTRUCTION: 
        You MUST return ONLY valid JSON. Do NOT wrap your response in markdown code blocks (e.g., do not use \`\`\`json). Return just the raw JSON object.
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2
        }
      });

      let rawText = response.text || '';
      let parsedResult;
      try {
        rawText = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        parsedResult = JSON.parse(rawText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw string:', rawText);
        return res.status(500).json({ error: 'Failed to parse AI response. Raw output: ' + rawText });
      }

      res.json({ result: parsedResult });
    } catch (error: any) {
      console.error('SIRS API Error:', error);
      let errorMsg = error.message || 'Failed to process SIRS report';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route: Care Note Generator
  app.post('/api/care-note', express.json(), async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) {
         return res.status(400).json({ error: 'Input required.' });
      }
      
      const prompt = `
        You are an expert aged care documentation assistant in Australia.
        Transform the following casual carer note into a professional English Progress Note suitable for Australian aged care documentation, aligned with the Strengthened Aged Care Quality Standards.
        
        Guidelines:
        - Use clear, professional clinical language.
        - Extract and structure key activities (e.g. mobility, hygiene, nutrition, mood/behaviour) where present.
        - KEEP IT CONCISE (a short paragraph or a few bullet points).
        - DO NOT invent or assume medical facts, vitals, or events that were not stated in the input.
        
        CRITICAL TASK: Detect the language of the Casual Input. If it is NOT English (e.g. it is Mandarin, Tagalog, etc.), translate the final English note back into that detected language as a 'nativeConfirmation' so the carer can verify the record. If the input is in English, leave it empty.

        Casual Input: "${input}"
        
        Return your response in structured JSON format with these exact keys:
        - englishNote: string (the professional progress note in English, plain text without markdown)
        - nativeConfirmation: string (the translated confirmation in the carer's native language, or empty if English)
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      let rawText = response.text || '';
      let parsedResult;
      try {
        rawText = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        parsedResult = JSON.parse(rawText);
      } catch (e) {
        parsedResult = { englishNote: rawText.replace(/[\*#]/g, '').trim(), nativeConfirmation: '' };
      }

      res.json({ result: parsedResult });
    } catch (error: any) {
      console.error('Care Note API Error:', error);
      let errorMsg = error.message || 'Failed to generate care note.';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route: Generate Daily Summary
  app.post('/api/summary', async (req, res) => {
    try {
      const { inputs } = req.body;
      if (!inputs) {
        return res.status(400).json({ error: 'Data required.' });
      }

      const prompt = `
        You are an AI generating a concise professional aged care daily wellness summary.
        Based on the following data for today, write a summary for a manager or RN to get a one-glance view.
        
        The summary must cover:
        - Overall wellness today (positive / stable / needs attention)
        - Key events (summarise any incidents, progress notes, or clinical observations provided)
        - Any flags / concerns the RN or manager should know
        - Care tasks status (bath/meal/toilet)
        
        Keep it completely plain text. NO markdown formatting. NO asterisks, NO hashes.

        Data:
        ${inputs}
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let text = response.text || '';
      text = text.replace(/```(markdown|json|html)?\n?/gi, '').replace(/```/g, '');
      text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim();

      res.json({ result: text });
    } catch (error: any) {
      console.error('Summary API Error:', error);
      let errorMsg = error.message || 'Failed to generate summary.';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route: Generate Shift Handover
  app.post('/api/shift-handover', express.json(), async (req, res) => {
    try {
      const { residents, sirsEvents, rnReviews } = req.body;
      
      const prompt = `
        You are a professional Registered Nurse manager creating a shift handover report.
        Based on the following data for today, generate a direct, concise 3-part handover summary.
        
        Data to summarize:
        Residents statuses: ${JSON.stringify(residents)}
        SIRS Events today: ${JSON.stringify(sirsEvents)}
        RN Reviews pending: ${JSON.stringify(rnReviews)}
        
        Format your response EXACTLY like this (using pure text/markdown, no JSON wrappers):
        
        🔴 HIGH PRIORITY (Urgent Actions & Incidents)
        - [List any SIRS P1/P2 events, severe status changes, hospital transfers. Name the resident and brief issue.]

        🟡 MONITOR & FOLLOW-UP (Observations & Pending)
        - [List residents with pending RN reviews, behavioral changes, minor falls, or incomplete basic care tasks.]

        🟢 STABLE (Routine Operations)
        - [A brief 1-line summary stating the remaining residents are stable, and overall care minutes progress].

        Write in a highly professional, clinical handover style. Use brief bullet points.
      `;

      const response = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({ result: response.text || '' });
    } catch (error: any) {
      console.error('Handover API Error:', error);
      let errorMsg = error.message || 'Failed to generate handover.';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI API rate limit (quota) exceeded. Please wait a moment and try again.';
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // Catch-all for undefined API routes to return JSON instead of HTML
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler so API routes don't return HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server Error:', err);
    if (req.path.startsWith('/api')) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    } else {
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
