import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'zh' | 'tl';

const translations = {
  en: {
    take_photo: "Take Photo",
    submit: "Submit",
    confirm: "Confirm",
    sign_in: "Sign In",
    logout: "Log Out",
    dashboard: "Dashboard",
    generate_note: "Generate Note",
    speak: "Speak (Any Language)",
    listening: "Listening...",
    ai_disclaimer: "⚠️ AI is for assistance only. Final clinical judgement must be made by a Registered Nurse.",
    offline: "⚠️ Offline Mode: Data temporarily saved to local cache.",
    roster: "Roster",
    staff: "Staff",
    handover: "Handover"
  },
  zh: {
    take_photo: "拍照",
    submit: "提交",
    confirm: "确认",
    sign_in: "登录",
    logout: "登出",
    dashboard: "仪表板",
    generate_note: "生成记录",
    speak: "语音输入 (自动翻译)",
    listening: "聆听中...",
    ai_disclaimer: "⚠️ AI仅辅助，最终医疗判断以RN(注册护士)为准。",
    offline: "⚠️ 离线模式：数据已暂存本地，联网后同步。",
    roster: "排班",
    staff: "员工管理",
    handover: "交接班"
  },
  tl: {
    take_photo: "Kumuha ng Litrato",
    submit: "Isumite",
    confirm: "Kumpirmahin",
    sign_in: "Mag-sign In",
    logout: "Mag-log Out",
    dashboard: "Dashboard",
    generate_note: "Bumuo ng Tala",
    speak: "Magsalita (Kahit Anong Wika)",
    listening: "Nakikinig...",
    ai_disclaimer: "⚠️ Ang AI ay para sa tulong lamang. Ang RN ang magdedesisyon.",
    offline: "⚠️ Offline Mode: Pansamantalang nai-save ang data.",
    roster: "Roster",
    staff: "Kawani",
    handover: "Handover"
  }
};

const LanguageContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
  isOnline: boolean;
  toggleSimulateOffline: () => void;
}>({ lang: 'en', setLang: () => {}, t: (k) => k, isOnline: true, toggleSimulateOffline: () => {} });

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [simulateOffline, setSimulateOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => { if (!simulateOffline) setIsOnline(true); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [simulateOffline]);

  useEffect(() => {
    if (simulateOffline) {
      setIsOnline(false);
    } else {
      setIsOnline(navigator.onLine);
    }
  }, [simulateOffline]);

  const toggleSimulateOffline = () => setSimulateOffline(prev => !prev);

  const t = (key: keyof typeof translations.en) => translations[lang][key] || translations.en[key];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isOnline, toggleSimulateOffline }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
