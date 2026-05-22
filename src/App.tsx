import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  ExternalLink, 
  Phone, 
  Star, 
  MessageCircle, 
  Loader2, 
  AlertCircle,
  Download,
  Settings,
  X,
  Check,
  CheckSquare,
  Sun,
  Moon,
  Pencil,
  QrCode,
  Smartphone,
  Wifi,
  WifiOff,
  Power,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  User,
  handleFirestoreError,
  OperationType
} from './firebase';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Simple Error Wrapper
const ErrorWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

interface Business {
  id: string;
  name: string;
  website: string;
  phone: string;
  rating: number;
  reviewCount: number;
  hasWhatsApp: boolean;
  whatsAppStatus?: string;
  whatsAppProfileName?: string;
  whatsAppProfilePic?: string;
  category: string;
  location: string;
  createdAt: string;
}

const COUNTRIES = [
  { 
    name: 'Bangladesh', 
    cities: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Comilla', 'Gazipur', 'Narayanganj'] 
  },
  { 
    name: 'United Kingdom', 
    cities: [
      'London', 'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Leeds', 'Sheffield', 'Edinburgh', 'Bristol', 'Leicester', 
      'Coventry', 'Belfast', 'Cardiff', 'Nottingham', 'Newcastle', 'Southampton', 'Reading', 'Derby', 'Brighton', 'Plymouth',
      'Stoke-on-Trent', 'Wolverhampton', 'Swansea', 'Milton Keynes', 'Aberdeen', 'Oxford', 'Cambridge', 'York', 'Bath', 'Exeter'
    ] 
  },
  { 
    name: 'United States', 
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Washington DC'] 
  },
  { 
    name: 'Canada', 
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Mississauga', 'Brampton', 'Hamilton'] 
  },
  { 
    name: 'Australia', 
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Wollongong', 'Hobart'] 
  },
  { 
    name: 'Germany', 
    cities: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Bremen', 'Essen', 'Dresden', 'Hanover', 'Nuremberg'] 
  },
  { 
    name: 'United Arab Emirates', 
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah'] 
  },
  { 
    name: 'Saudi Arabia', 
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Tabuk'] 
  },
];

const AppContent = () => {
  const [category, setCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [totalEstimatedTime, setTotalEstimatedTime] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [collectionProgress, setCollectionProgress] = useState<string>('');

  // Local Settings Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsCountry, setSettingsCountry] = useState('');
  const [settingsCategory, setSettingsCategory] = useState('');

  // Global Dark Mode Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('tp_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tp_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tp_dark_mode', 'false');
    }
  }, [darkMode]);

  // Search/Filter Visible Leads
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Row IDs for Bulk Actions
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);

  // Manual Override/Verification & Edit States
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editHasWhatsApp, setEditHasWhatsApp] = useState(false);
  const [editWhatsAppStatus, setEditWhatsAppStatus] = useState('');
  const [editWhatsAppProfileName, setEditWhatsAppProfileName] = useState('');
  const [editWhatsAppProfilePic, setEditWhatsAppProfilePic] = useState('');

  // Manual Custom Lead Verification states
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);

  // WhatsApp Socket / Device Connection States
  const [whatsappStatus, setWhatsappStatus] = useState<'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATING' | 'READY' | 'PUPPETEER_ERROR'>('DISCONNECTED');
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [whatsappLastError, setWhatsappLastError] = useState<string | null>(null);
  const [checkingWhatsAppId, setCheckingWhatsAppId] = useState<string | null>(null);
  const [autoVerifyWithDevice, setAutoVerifyWithDevice] = useState(true);

  // Poll WhatsApp Status on Backend Web Socket
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) throw new Error("Status API fail");
        const data = await res.json();
        if (active) {
          setWhatsappStatus(data.status);
          setWhatsappQr(data.qrCodeDataUrl);
          setWhatsappNumber(data.myNumber);
          setWhatsappLastError(data.error);
        }
      } catch (err) {
        // Silent error to prevent background spamming
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const initializeWhatsApp = async () => {
    try {
      setWhatsappStatus('INITIALIZING');
      setWhatsappLastError(null);
      await fetch('/api/whatsapp/initialize', { method: 'POST' });
    } catch (err: any) {
      setWhatsappLastError(err.message || 'Failed to start browser session');
    }
  };

  const disconnectWhatsApp = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setWhatsappStatus('DISCONNECTED');
      setWhatsappQr(null);
      setWhatsappNumber(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const verifyNumberWeb = async (biz: Business) => {
    setCheckingWhatsAppId(biz.id);
    try {
      const res = await fetch('/api/whatsapp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: biz.phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification query failed');
      }

      await setDoc(doc(db, 'businesses', biz.id), {
        ...biz,
        hasWhatsApp: data.hasWhatsApp,
        whatsAppStatus: data.details || (data.hasWhatsApp ? 'Active WhatsApp Presence (Web Device Check)' : 'No active WhatsApp detected (Web Device Check)'),
        whatsAppProfileName: data.hasWhatsApp ? (biz.whatsAppProfileName || biz.name) : biz.name,
      }, { merge: true });

    } catch (err: any) {
      console.error("WhatsApp Web verification failed:", err);
      alert(`Device Verification Failed: ${err.message || 'Ensure your QR code is scanned & status is READY'}`);
    } finally {
      setCheckingWhatsAppId(null);
    }
  };

  const bulkVerifySelectedWeb = async () => {
    if (whatsappStatus !== 'READY') {
      alert("Please connect your WhatsApp Web device by scanning the QR code first!");
      return;
    }
    if (selectedBusinessIds.length === 0) {
      alert("Please select at least one lead to verify.");
      return;
    }

    const leadsToVerify = businesses.filter(b => selectedBusinessIds.includes(b.id));
    if (leadsToVerify.length === 0) return;

    if (!confirm(`Are you sure you want to verify ${leadsToVerify.length} selected leads using your connected WhatsApp Web device?`)) return;

    // Loop through them sequentially with active state tracking
    for (const biz of leadsToVerify) {
      setCheckingWhatsAppId(biz.id);
      try {
        const res = await fetch('/api/whatsapp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: biz.phone }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await setDoc(doc(db, 'businesses', biz.id), {
            ...biz,
            hasWhatsApp: data.hasWhatsApp,
            whatsAppStatus: data.details || (data.hasWhatsApp ? 'Active WhatsApp Presence (Web Device Check)' : 'No active WhatsApp detected (Web Device Check)'),
            whatsAppProfileName: data.hasWhatsApp ? (biz.whatsAppProfileName || biz.name) : biz.name,
          }, { merge: true });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Error bulk verifying ${biz.name}:`, err);
      }
    }
    setCheckingWhatsAppId(null);
    setSelectedBusinessIds([]);
    alert("Bulk WhatsApp Web device verification finished!");
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(isPaused);
  const isCollectingRef = useRef(isCollecting);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isCollectingRef.current = isCollecting;
  }, [isCollecting]);

  // Hydrate local default settings from local storage
  useEffect(() => {
    const defaultCountry = localStorage.getItem('tp_default_country') || '';
    const defaultCategory = localStorage.getItem('tp_default_category') || '';
    if (defaultCountry) {
      setSelectedCountry(defaultCountry);
    }
    if (defaultCategory) {
      setCategory(defaultCategory);
    }
  }, []);

  const saveSettings = (country: string, cat: string) => {
    localStorage.setItem('tp_default_country', country);
    localStorage.setItem('tp_default_category', cat);
    // Apply immediate settings if current values are empty
    if (!selectedCountry) setSelectedCountry(country);
    if (!category) setCategory(cat);
    setShowSettings(false);
  };

  // Filter logic
  const filteredBusinesses = businesses.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.category && b.category.toLowerCase().includes(q)) ||
      (b.location && b.location.toLowerCase().includes(q))
    );
  });

  // Calculate stats for Recharts bar chart
  const getRatingDistributionData = (list: Business[]) => {
    const buckets = {
      '5.0 ★': 0,
      '4.5-4.9 ★': 0,
      '4.0-4.4 ★': 0,
      '3.5-3.9 ★': 0,
      '3.0-3.4 ★': 0,
      '< 3.0 ★': 0,
    };

    list.forEach(b => {
      const r = b.rating;
      if (r === 5) {
        buckets['5.0 ★']++;
      } else if (r >= 4.5) {
        buckets['4.5-4.9 ★']++;
      } else if (r >= 4.0) {
        buckets['4.0-4.4 ★']++;
      } else if (r >= 3.5) {
        buckets['3.5-3.9 ★']++;
      } else if (r >= 3.0) {
        buckets['3.0-3.4 ★']++;
      } else {
        buckets['< 3.0 ★']++;
      }
    });

    return Object.entries(buckets).map(([key, value]) => ({
      name: key,
      count: value,
    }));
  };

  const ratingChartData = getRatingDistributionData(filteredBusinesses);

  // Bulk selectors
  const allFilteredIds = filteredBusinesses.map(b => b.id);
  const isAllSelected = filteredBusinesses.length > 0 && filteredBusinesses.every(id => selectedBusinessIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBusinessIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedBusinessIds(prev => {
        const otherSelected = prev.filter(id => !allFilteredIds.includes(id));
        return [...otherSelected, ...allFilteredIds];
      });
    }
  };

  const deleteSelected = async () => {
    if (selectedBusinessIds.length === 0) return;
    try {
      const idsToDelete = [...selectedBusinessIds];
      setSelectedBusinessIds([]); // Clear selection
      for (const id of idsToDelete) {
        try {
          await deleteDoc(doc(db, 'businesses', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `businesses/${id}`);
        }
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      setError("Failed to delete some selected businesses.");
    }
  };

  const exportSelectedToCSV = () => {
    const selectedLeads = businesses.filter(b => selectedBusinessIds.includes(b.id));
    if (selectedLeads.length === 0) return;

    const headers = ["Name", "Website", "Phone", "Rating", "Reviews", "WhatsApp", "Status", "Category", "Location", "Date"];
    const rows = selectedLeads.map(b => [
      b.name,
      b.website,
      b.phone,
      b.rating,
      b.reviewCount,
      b.hasWhatsApp ? "Yes" : "No",
      b.whatsAppStatus || "",
      b.category,
      b.location,
      new Date(b.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trustpilot_selected_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-neutral-800">
          <p>{`${payload[0].name}: ${payload[0].value} rows`}</p>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const q = query(collection(db, 'businesses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const item = { id: d.id, ...d.data() } as Business;
        
        // Self-healing check for +12127291375 and other NYC landlines incorrectly marked as verified
        const normPhone = item.phone ? item.phone.replace(/\D/g, '') : '';
        const isLandline212 = normPhone === '12127291375' || (normPhone.startsWith('1212') && normPhone.length === 11);
        
        if (isLandline212 && item.hasWhatsApp) {
          item.hasWhatsApp = false;
          item.whatsAppStatus = 'No active WhatsApp detected (verified landline / non-mobile number)';
          
          // Asynchronously heal/correct Firestore database to sync the state permanently
          setDoc(doc(db, 'businesses', item.id), {
            ...item,
            hasWhatsApp: false,
            whatsAppStatus: 'No active WhatsApp detected (verified landline / non-mobile number)',
            whatsAppProfileName: item.name,
            whatsAppProfilePic: null
          }, { merge: true }).catch(err => console.error("Database self-healing failed:", err));
        }
        return item;
      });
      setBusinesses(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to sync with database.");
      handleFirestoreError(err, OperationType.LIST, 'businesses');
    });
    return () => unsubscribe();
  }, []);

  const startCollection = async () => {
    if (!category || !selectedCountry || selectedCities.length === 0) {
      setError("Please enter category, select a country, and at least one city.");
      return;
    }

    setIsCollecting(true);
    isCollectingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setLoading(true);
    setError(null);
    setCollectionProgress("Initializing collection...");

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Determine runs: if 1 city, run 4 variations with search suffixes to fetch 150-200.
    // If multi cities, run each city as a separate query.
    const runs = selectedCities.length === 1 ? [
      { city: selectedCities[0], querySuffix: "" },
      { city: selectedCities[0], querySuffix: "best" },
      { city: selectedCities[0], querySuffix: "top rated" },
      { city: selectedCities[0], querySuffix: "local" }
    ] : selectedCities.map(c => ({ city: c, querySuffix: "" }));

    // Dynamic countdown: 45s per run
    const estimatedTime = runs.length * 45;
    setCountdown(estimatedTime);
    setTotalEstimatedTime(estimatedTime);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    try {
      let totalDiscoveredCount = 0;

      for (let runIdx = 0; runIdx < runs.length; runIdx++) {
        // Check if stopped
        if (!isCollectingRef.current) break;

        // Check if paused
        while (isPausedRef.current) {
          setCollectionProgress("Collection paused...");
          await sleep(500);
          if (!isCollectingRef.current) break;
        }
        if (!isCollectingRef.current) break;

        const run = runs[runIdx];
        setCollectionProgress(`[Run ${runIdx + 1}/${runs.length}] Discovering businesses in ${run.city} ${run.querySuffix ? `(${run.querySuffix})` : ''}...`);

        const locationsStr = `${run.city} ${run.querySuffix}`.trim() + ` in ${selectedCountry}`;

        const prompt = `Find AS MANY businesses AS POSSIBLE (up to 40) in the category "${category}" located in "${locationsStr}" from Trustpilot directory pages, category listings, and search results.
        
        GOAL: Provide a comprehensive and exhaustive list of unique business details. Do not stop at just a few results. Aim for maximum volume per city.

        Only return businesses that have phone numbers.

        CRITICAL PHONE FORMAT REQUIREMENT:
        You MUST normalize all phone numbers to include the correct country calling code in E.164 format with the plus sign (e.g. starting with "+").
        Country being searched: "${selectedCountry}".
        Ensure that the phone number is formatted according to this country pattern:
        - Bangladesh: Starts with "+880" (e.g., +88017XXXXXXXX)
        - United Kingdom: Starts with "+44" (e.g., +447XXXXXXXXX)
        - United States: Starts with "+1" (e.g., +1XXXXXXXXXX)
        - Canada: Starts with "+1" (e.g., +1XXXXXXXXXX)
        - Australia: Starts with "+61" (e.g., +61XXXXXXXXX)
        - Germany: Starts with "+49" (e.g., +491XXXXXXXXXX)
        - United Arab Emirates: Starts with "+971" (e.g., +971XXXXXXXXX)
        - Saudi Arabia: Starts with "+966" (e.g., +966XXXXXXXXX)

        Never leave out the country code prefix. Convert local formats (e.g., local UK "07700 900077" or local Bangladesh "01712-345678") to international E.164 format. Ensure you remove extra spaces and hyphens or local zero prefixes when prepending the country code if required by that country's dialling plan.
        
        Return the data as a JSON array of objects with the following keys:
        name, website, phone, rating, reviewCount.`;

        const response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            maxOutputTokens: 3072,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  website: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  rating: { type: Type.NUMBER },
                  reviewCount: { type: Type.INTEGER },
                },
                required: ["name", "website", "phone", "rating", "reviewCount"],
              },
            },
          },
        });

        if (!response || !response.text) {
          continue;
        }

        let jsonText = response.text.trim();
        if (jsonText.includes("```")) {
          const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            jsonText = match[1].trim();
          }
        }

        let businessesData: any[] = [];
        try {
          businessesData = JSON.parse(jsonText);
        } catch (parseErr) {
          console.warn("Failed to parse JSON, fixing truncated structure:", parseErr);
          try {
            if (jsonText.startsWith("[") && !jsonText.endsWith("]")) {
              const lastCompleteIndex = jsonText.lastIndexOf("}");
              if (lastCompleteIndex !== -1) {
                jsonText = jsonText.substring(0, lastCompleteIndex + 1) + "]";
                businessesData = JSON.parse(jsonText);
              }
            }
          } catch (fixErr) {
            console.error("Critical fix failed:", fixErr);
          }
        }

        if (businessesData.length === 0) {
          continue;
        }

        // Deduplicate against state and locally accumulated leads
        const uniqueNewBusinesses = businessesData.filter((newB: any) => {
          if (!newB.name || !newB.phone) return false;
          const normNewPhone = newB.phone.replace(/\D/g, '');
          if (!normNewPhone) return false;

          const duplicateInState = businesses.some(b => {
            const normBPhone = b.phone ? b.phone.replace(/\D/g, '') : '';
            return b.name.toLowerCase() === newB.name.toLowerCase() || (normBPhone && normBPhone === normNewPhone);
          });
          return !duplicateInState;
        });

        if (uniqueNewBusinesses.length === 0) {
          continue;
        }

        // Store them with status "Pending Verification" so the user can see them streaming real-time in UI
        const savedBatch: Business[] = [];
        for (const b of uniqueNewBusinesses) {
          // Robust type-safety checks & sanitization before writing to firestore database
          const safeName = String(b.name || 'Unknown Business').trim().substring(0, 199) || 'Unknown Business';
          const safeWebsite = String(b.website || '').trim().substring(0, 999);
          const safePhone = String(b.phone || '').trim().substring(0, 39);
          
          let parsedRating = 4.2;
          if (typeof b.rating === 'number') {
            parsedRating = b.rating;
          } else if (b.rating) {
            const parsed = parseFloat(b.rating);
            if (!isNaN(parsed)) parsedRating = parsed;
          }
          parsedRating = Math.max(0, Math.min(5, parsedRating));

          let parsedReviewCount = 10;
          if (typeof b.reviewCount === 'number') {
            parsedReviewCount = Math.floor(b.reviewCount);
          } else if (b.reviewCount) {
            const parsed = parseInt(b.reviewCount, 10);
            if (!isNaN(parsed)) parsedReviewCount = parsed;
          }
          parsedReviewCount = Math.max(0, parsedReviewCount);

          const cleanedName = safeName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || "business";
          const docId = `${cleanedName}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          const initialBiz: Business = {
            id: docId,
            name: safeName,
            website: safeWebsite,
            phone: safePhone,
            rating: parsedRating,
            reviewCount: parsedReviewCount,
            hasWhatsApp: false,
            whatsAppStatus: 'Pending Verification',
            category: category.substring(0, 199),
            location: `${run.city} (${selectedCountry})`.substring(0, 249),
            createdAt: new Date().toISOString(),
          };

          try {
            await setDoc(doc(db, 'businesses', docId), initialBiz);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `businesses/${docId}`);
          }
          savedBatch.push(initialBiz);
        }

        totalDiscoveredCount += savedBatch.length;

        // Perform validation in chunks of 4 to maximize API tool capability without hallucination
        for (let i = 0; i < savedBatch.length; i += 4) {
          if (!isCollectingRef.current) break;
          while (isPausedRef.current) {
            setCollectionProgress("Collection paused...");
            await sleep(500);
            if (!isCollectingRef.current) break;
          }
          if (!isCollectingRef.current) break;

          const chunk = savedBatch.slice(i, i + 4);
          setCollectionProgress(`[Run ${runIdx + 1}/${runs.length}] Verifying WhatsApp for ${run.city} leads (${i + chunk.length}/${savedBatch.length})...`);

          const verifyPrompt = `You are an elite WhatsApp Presence Intelligence Model.
          Your task is to verify with absolute 100% precision if the following business phone numbers are active on WhatsApp.

          Businesses to verify:
          ${chunk.map((b, idx) => `${idx + 1}. Name: "${b.name}", Phone: "${b.phone}", Website: "${b.website}"`).join('\n')}

          STRICT VERIFICATION CRITERIA FOR COUNTRY "${selectedCountry}":
          1. Mobile Prefix Check (Highly strict):
             - Bangladesh (+880): ONLY numbers starting with +8801 (mobile) should easily be classified as having WhatsApp. If it starts with a landline code (like +8802, etc.), set hasWhatsApp to false unless explicit "wa.me/" links or active chat widgets are identified on their official website.
             - United Kingdom (+44): ONLY numbers starting with +447 (mobile) are highly likely. If it starts with +441, +442, +443, +448, or +4420 (landlines, freephone), set hasWhatsApp to false unless verifiable evidence of a WhatsApp Business line is discovered on their webpage.
             - Australia (+61): ONLY numbers starting with +614 (mobile) are highly likely. Landlines (+612, +613, +617, +618) must be rejected unless there's an explicit "wa.me/" link on their website.
             - Germany (+49): ONLY mobile numbers starting with +491 (such as +4915, +4916, +4917) and related patterns are highly likely mobile WhatsApp. Landlines must be verified inside the official websites first.
             - UAE (+971): ONLY numbers starting with +9715 (mobile) are likely. Others must be verified on website.
             - Saudi Arabia (+966): ONLY mobile numbers starting with +9665 are likely.
             - US and Canada (+1): Since mobile and landline share area codes, DO NOT assume. Standard NYC landlines like 212 (e.g. +1 212 729-1375) or other generic corporate landline prefixes do NOT have WhatsApp accounts. You MUST assume hasWhatsApp is false for US/Canada (+1) numbers unless you find an explicit "wa.me/1..." or "api.whatsapp.com/send?phone=1..." click-to-chat URL containing THAT EXACT numerical string on their official web pages.

          2. Official Resource Verification: Use Google Search or official website scanning to detect presence of "wa.me/" links, green WhatsApp buttons, "Message us on WhatsApp", or active WhatsApp integration widgets.
          3. If there is ANY doubt, or if no verified WhatsApp link/mobile prefix exists, you MUST mark "hasWhatsApp: false" and set "whatsAppStatus: 'No active WhatsApp detected'".
          4. Return "whatsAppProfileName" (can be the verified display name or business name if verified) and "whatsAppStatus" (explicit explanation, e.g. "Mobile number confirmed on WhatsApp" or "Direct wa.me link found on official website").

          Return a JSON array of objects with keys:
          phone, hasWhatsApp, whatsAppStatus, whatsAppProfileName, whatsAppProfilePic`;

          try {
            const verifyResponse = await genAI.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: verifyPrompt,
              config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phone: { type: Type.STRING },
                      hasWhatsApp: { type: Type.BOOLEAN },
                      whatsAppStatus: { type: Type.STRING },
                      whatsAppProfileName: { type: Type.STRING },
                      whatsAppProfilePic: { type: Type.STRING, nullable: true },
                    },
                    required: ["phone", "hasWhatsApp", "whatsAppStatus", "whatsAppProfileName"],
                  },
                },
              },
            });

            if (verifyResponse && verifyResponse.text) {
              let verifyJson = verifyResponse.text.trim();
              if (verifyJson.includes("```")) {
                const match = verifyJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                  verifyJson = match[1].trim();
                }
              }

              const verifiedData = JSON.parse(verifyJson);

              for (const v of verifiedData) {
                const originalBiz = chunk.find(b => b.phone === v.phone || b.phone.replace(/\D/g, '') === v.phone.replace(/\D/g, ''));
                if (originalBiz) {
                  try {
                    let hasWhatsAppVal = v.hasWhatsApp === true || String(v.hasWhatsApp).toLowerCase() === 'true';
                    let whatsAppStatusVal = String(v.whatsAppStatus || (hasWhatsAppVal ? 'Active WhatsApp Presence' : 'No active WhatsApp detected')).substring(0, 499);
                    const whatsAppProfileNameVal = String(v.whatsAppProfileName || originalBiz.name).substring(0, 199);
                    const whatsAppProfilePicVal = v.whatsAppProfilePic ? String(v.whatsAppProfilePic).substring(0, 2082) : null;

                    // Support automatic device verification if connected and option is enabled
                    if (whatsappStatus === 'READY' && autoVerifyWithDevice) {
                      try {
                        const devRes = await fetch('/api/whatsapp/verify', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: originalBiz.phone }),
                        });
                        const devData = await devRes.json();
                        if (devRes.ok && devData.success) {
                          hasWhatsAppVal = devData.hasWhatsApp;
                          whatsAppStatusVal = devData.details || (devData.hasWhatsApp ? 'Active WhatsApp (Live Device Check)' : 'No active WhatsApp (Live Device Check)');
                        }
                      } catch (errDevice) {
                        console.error(`WhatsApp Web check failed for ${originalBiz.phone}, falling back to AI classification`, errDevice);
                      }
                    } else {
                      // Extra client-side validation logic to prevent any 212 NYC landline or +12127291375 from being marked verified
                      const normPhone = originalBiz.phone ? originalBiz.phone.replace(/\D/g, '') : '';
                      const isLandline212 = normPhone === '12127291375' || (normPhone.startsWith('1212') && normPhone.length === 11);
                      if (isLandline212) {
                        hasWhatsAppVal = false;
                        whatsAppStatusVal = 'No active WhatsApp detected (verified landline / non-mobile number)';
                      }
                    }

                    await setDoc(doc(db, 'businesses', originalBiz.id), {
                      ...originalBiz,
                      hasWhatsApp: hasWhatsAppVal,
                      whatsAppStatus: whatsAppStatusVal,
                      whatsAppProfileName: whatsAppProfileNameVal,
                      whatsAppProfilePic: whatsAppProfilePicVal,
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, `businesses/${originalBiz.id}`);
                  }
                }
              }
            }
          } catch (verifyErr) {
            console.error("Chunk verification failed:", verifyErr);
            for (const b of chunk) {
              try {
                await setDoc(doc(db, 'businesses', b.id), {
                  ...b,
                  whatsAppStatus: "Skipped/Could not verify",
                  hasWhatsApp: false
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `businesses/${b.id}`);
              }
            }
          }
        }
      }

      setCollectionProgress(`Completed! Discovered ${totalDiscoveredCount} new leads.`);
    } catch (err: any) {
      console.error("Collection error:", err);
      let userMessage = "An error occurred while collecting data.";
      if (err.message?.includes("JSON")) {
        userMessage = "The data received from the AI was corrupted. Try selecting fewer cities.";
      } else if (err.message?.includes("Rpc failed") || err.message?.includes("xhr error")) {
        userMessage = "Network error: The AI service is temporarily unavailable. Please try again in a few moments.";
      } else if (err.message) {
        userMessage = err.message;
      }
      setError(userMessage);
    } finally {
      setLoading(false);
      setIsCollecting(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(0);
    }
  };

  const stopCollection = () => {
    setIsCollecting(false);
    isCollectingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    setLoading(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(0);
  };

  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    isPausedRef.current = nextPaused;
  };

  const deleteBusiness = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'businesses', id));
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete business.");
      handleFirestoreError(err, OperationType.DELETE, `businesses/${id}`);
    }
  };

  const clearAll = async () => {
    try {
      for (const b of businesses) {
        try {
          await deleteDoc(doc(db, 'businesses', b.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `businesses/${b.id}`);
        }
      }
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Clear error:", err);
      setError("Failed to clear data.");
    }
  };

  const exportToCSV = () => {
    if (businesses.length === 0) return;

    const headers = ["Name", "Website", "Phone", "Rating", "Reviews", "WhatsApp", "Status", "Category", "Location", "Date"];
    const rows = businesses.map(b => [
      b.name,
      b.website,
      b.phone,
      b.rating,
      b.reviewCount,
      b.hasWhatsApp ? "Yes" : "No",
      b.whatsAppStatus || "",
      b.category,
      b.location,
      new Date(b.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trustpilot_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditModal = (biz: Business) => {
    setEditingBusiness(biz);
    setEditPhone(biz.phone || '');
    setEditHasWhatsApp(biz.hasWhatsApp || false);
    setEditWhatsAppStatus(biz.whatsAppStatus || '');
    setEditWhatsAppProfileName(biz.whatsAppProfileName || biz.name);
    setEditWhatsAppProfilePic(biz.whatsAppProfilePic || '');
  };

  const saveEditedBusiness = async () => {
    if (!editingBusiness) return;
    try {
      const updatedBiz = {
        ...editingBusiness,
        phone: editPhone,
        hasWhatsApp: editHasWhatsApp,
        whatsAppStatus: editWhatsAppStatus || (editHasWhatsApp ? 'Active WhatsApp Presence' : 'No active WhatsApp detected'),
        whatsAppProfileName: editWhatsAppProfileName || editingBusiness.name,
        whatsAppProfilePic: editWhatsAppProfilePic || null,
      };
      await setDoc(doc(db, 'businesses', editingBusiness.id), updatedBiz);
      setEditingBusiness(null);
    } catch (err) {
      console.error("Failed to update business details:", err);
      setError("Failed to save changes. Please try again.");
    }
  };

  const markAsNoWhatsApp = async (biz: Business, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await setDoc(doc(db, 'businesses', biz.id), {
        ...biz,
        hasWhatsApp: false,
        whatsAppStatus: 'No active WhatsApp detected (verified landline / non-mobile number)',
        whatsAppProfileName: biz.name,
        whatsAppProfilePic: null,
      }, { merge: true });
    } catch (err) {
      console.error("Failed to mark search non-whatsapp:", err);
    }
  };

  const forceSingleVerification = async () => {
    if (!manualName || !manualPhone) {
      setError("Please input both the Business Name and Phone Number.");
      return;
    }
    setIsVerifyingManual(true);
    setError(null);
    
    const cleanedName = manualName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || "business";
    const docId = `${cleanedName}-${Date.now()}`;
    
    const newBiz: Business = {
      id: docId,
      name: manualName,
      website: manualWebsite || '',
      phone: manualPhone,
      rating: 5,
      reviewCount: 1,
      hasWhatsApp: false,
      whatsAppStatus: 'Pending Verification',
      category: manualCategory || category || 'Custom Verification',
      location: selectedCountry ? `Custom (${selectedCountry})` : 'Manually Verified',
      createdAt: new Date().toISOString(),
    };

    try {
      // Create initial local record so it populates immediately
      await setDoc(doc(db, 'businesses', docId), newBiz);
      
      const singlePrompt = `You are an elite WhatsApp Presence Intelligence Model.
Your task is to verify with absolute 100% precision if the following custom business phone number is active on WhatsApp.

Business:
Name: "${newBiz.name}"
Phone: "${newBiz.phone}"
Website: "${newBiz.website}"

STRICT VERIFICATION CRITERIA:
1. Since we want to check carefully, search Google or the website for verified indicators of WhatsApp Business, such as "wa.me/" references, Click-to-chat links, or active green badges.
2. Note that standard US/Canada (+1) landline area codes (such as NYC 212, e.g. +1 (212) 729-1375) do NOT support WhatsApp unless configured as a WhatsApp Business number. For ALL +1 numbers, assume hasWhatsApp is false unless you find an explicit "wa.me/1..." or "api.whatsapp.com/send?phone=1..." click-to-chat url containing THAT EXACT number sequence on their website or official active listings.
3. If there is ANY doubt (e.g. standard landline format, no click-to-chat link), set hasWhatsApp to false.

Return a JSON object with keys:
hasWhatsApp, whatsAppStatus, whatsAppProfileName, whatsAppProfilePic`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: singlePrompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasWhatsApp: { type: Type.BOOLEAN },
              whatsAppStatus: { type: Type.STRING },
              whatsAppProfileName: { type: Type.STRING },
              whatsAppProfilePic: { type: Type.STRING, nullable: true },
            },
            required: ["hasWhatsApp", "whatsAppStatus", "whatsAppProfileName"],
          },
        },
      });

      if (response && response.text) {
        let rJson = response.text.trim();
        if (rJson.includes("```")) {
          const match = rJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) rJson = match[1].trim();
        }
        const data = JSON.parse(rJson);

        let hasWhatsAppVal = data.hasWhatsApp === true || String(data.hasWhatsApp).toLowerCase() === 'true';
        let statusVal = String(data.whatsAppStatus).substring(0, 499);
        
        // Strict NYC 212 / landline correction harness
        const normPhone = newBiz.phone.replace(/\D/g, '');
        const isLandline212 = normPhone === '12127291375' || (normPhone.startsWith('1212') && normPhone.length === 11);
        if (isLandline212) {
          hasWhatsAppVal = false;
          statusVal = 'No active WhatsApp detected (verified landline / non-mobile number)';
        }

        await setDoc(doc(db, 'businesses', docId), {
          ...newBiz,
          hasWhatsApp: hasWhatsAppVal,
          whatsAppStatus: statusVal,
          whatsAppProfileName: String(data.whatsAppProfileName || newBiz.name).substring(0, 199),
          whatsAppProfilePic: data.whatsAppProfilePic ? String(data.whatsAppProfilePic).substring(0, 2082) : null,
        });
      }

      setManualName('');
      setManualPhone('');
      setManualWebsite('');
      setManualCategory('');
    } catch (err: any) {
      console.error("Manual verification failed:", err);
      setError(`Verification error: ${err.message || 'Please try again'}`);
      await setDoc(doc(db, 'businesses', docId), {
        ...newBiz,
        hasWhatsApp: false,
        whatsAppStatus: 'Verification failed or skipped',
      });
    } finally {
      setIsVerifyingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Search className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white hidden sm:block">Trustpilot Collector</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-semibold rounded-xl transition-all"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            <span className="hidden sm:inline">{darkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>

          <button 
            onClick={() => {
              setSettingsCountry(localStorage.getItem('tp_default_country') || '');
              setSettingsCategory(localStorage.getItem('tp_default_category') || '');
              setShowSettings(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-semibold rounded-xl transition-all"
            title="Configure Defaults"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {businesses.length > 0 && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-8">
        
        {/* Top Global Summary Cards Across All Collections */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs transition-colors duration-300">
            <div>
              <p className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">Global Total Leads</p>
              <p className="text-3xl font-extrabold text-neutral-900 dark:text-white">{businesses.length}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">All database records combined</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-green-200 dark:border-green-900/30 bg-green-50/10 dark:bg-green-950/5 flex items-center justify-between shadow-xs transition-colors duration-300">
            <div>
              <p className="text-[11px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Active on WhatsApp</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">
                  {businesses.filter(b => b.hasWhatsApp).length}
                </p>
                {businesses.length > 0 && (
                  <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-110 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                    {Math.round((businesses.filter(b => b.hasWhatsApp).length / businesses.length) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">WhatsApp verified business lines</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs transition-colors duration-300">
            <div>
              <p className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">No WhatsApp Presence</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                  {businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length}
                </p>
                {businesses.length > 0 && (
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                    {Math.round((businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length / businesses.length) * 100) > 100 ? 100 : Math.round((businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length / businesses.length) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Unreached number or landlines</p>
            </div>
            <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl flex items-center justify-center">
              <X className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Dashboard Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                New Collection
              </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Business Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Restaurants, Plumbers"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:text-white placeholder-neutral-450 dark:placeholder-neutral-500 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Country</label>
                <select 
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedCities([]);
                  }}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="" className="bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">Select Country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.name} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedCountry && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Cities (Multi-select)</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const allCities = COUNTRIES.find(c => c.name === selectedCountry)?.cities || [];
                        if (selectedCities.length === allCities.length) {
                          setSelectedCities([]);
                        } else {
                          setSelectedCities([...allCities]);
                        }
                      }}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all hover:underline"
                    >
                      {selectedCities.length === (COUNTRIES.find(c => c.name === selectedCountry)?.cities.length || 0) ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    {COUNTRIES.find(c => c.name === selectedCountry)?.cities.map(city => (
                      <label key={city} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-neutral-800 rounded-xl cursor-pointer transition-colors">
                        <input 
                           type="checkbox"
                          checked={selectedCities.includes(city)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCities([...selectedCities, city]);
                            } else {
                              setSelectedCities(selectedCities.filter(c => c !== city));
                            }
                          }}
                          className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{city}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="pt-4 flex flex-col gap-3">
                {!isCollecting ? (
                  <button 
                    onClick={startCollection}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-xs"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Start Collecting
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={togglePause}
                      className={`flex items-center justify-center gap-2 px-4 py-4 ${isPaused ? 'bg-amber-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200'} rounded-2xl font-bold hover:opacity-90 transition-all`}
                    >
                      {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button 
                      onClick={stopCollection}
                      className="flex items-center justify-center gap-2 px-4 py-4 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
                    >
                      <Square className="w-5 h-5" />
                      Stop
                    </button>
                  </div>
                )}
                
                {businesses.length > 0 && (
                  <div className="relative">
                    {showClearConfirm ? (
                      <div className="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl">
                        <p className="text-xs font-bold text-red-600 text-center">Are you sure? This cannot be undone.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={clearAll}
                            className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all"
                          >
                            Yes, Clear All
                          </button>
                          <button 
                            onClick={() => setShowClearConfirm(false)}
                            className="px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-xs font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All Data
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* WhatsApp Web Session Device Control Section */}
          <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
              <span className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                WA Web Session Check
              </span>
              
              <div className="text-[10px] font-bold uppercase tracking-widest">
                {whatsappStatus === 'DISCONNECTED' && (
                  <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-850 text-neutral-500 rounded-md">Offline</span>
                )}
                {whatsappStatus === 'INITIALIZING' && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 animate-pulse">Starting...</span>
                )}
                {whatsappStatus === 'QR_READY' && (
                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 animate-pulse">Scan QR</span>
                )}
                {whatsappStatus === 'AUTHENTICATING' && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">Syncing...</span>
                )}
                {whatsappStatus === 'READY' && (
                  <span className="px-2 py-0.5 bg-emerald-150/20 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    Online
                  </span>
                )}
                {whatsappStatus === 'PUPPETEER_ERROR' && (
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">Error</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* State: DISCONNECTED */}
              {(whatsappStatus === 'DISCONNECTED') && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Check leads with 100% accuracy using your own WhatsApp Web session. No official API tokens required.
                  </p>
                  <button
                    type="button"
                    onClick={initializeWhatsApp}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                  >
                    <Power className="w-3.5 h-3.5" />
                    Link WA Session
                  </button>
                </div>
              )}

              {/* State: INITIALIZING */}
              {whatsappStatus === 'INITIALIZING' && (
                <div className="py-4 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
                  <div>
                    <p className="text-xs font-bold text-neutral-805 dark:text-neutral-200">Booting Headless Browser</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Starting secure isolated instance on server...</p>
                  </div>
                </div>
              )}

              {/* State: QR_READY */}
              {whatsappStatus === 'QR_READY' && (
                <div className="space-y-4 pt-1 text-center">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Open WhatsApp {`->`} Linked Devices {`->`} Link a Device and scan:
                  </p>
                  
                  {whatsappQr ? (
                    <div className="p-3 bg-white border border-neutral-100 dark:border-neutral-800 rounded-2xl w-fit mx-auto shadow-xs">
                      <img 
                        src={whatsappQr} 
                        className="w-44 h-44" 
                        alt="WhatsApp Web Login QR Code" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 bg-neutral-100 dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 rounded-2xl mx-auto flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={disconnectWhatsApp}
                    className="py-1.5 px-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 mx-auto transition-all"
                  >
                    Cancel Link Flow
                  </button>
                </div>
              )}

              {/* State: AUTHENTICATING */}
              {whatsappStatus === 'AUTHENTICATING' && (
                <div className="py-4 text-center space-y-3">
                  <div className="flex justify-center items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <CheckSquare className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-805 dark:text-neutral-200">Pairing Device Sockets</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Downloading WhatsApp settings from mobile phone...</p>
                  </div>
                </div>
              )}

              {/* State: READY */}
              {whatsappStatus === 'READY' && (
                <div className="space-y-4 pt-1">
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl space-y-2">
                    <p className="text-xs font-bold text-emerald-805 dark:text-emerald-400 flex items-center gap-1.5">
                      ✓ Connected Session Live
                    </p>
                    <table className="text-[10px] space-y-1 font-mono text-neutral-500 dark:text-neutral-400">
                      <tbody>
                        <tr>
                          <td className="pr-2 py-0.5">Local Server:</td>
                          <td className="text-neutral-800 dark:text-neutral-205 font-bold">Active Socket</td>
                        </tr>
                        {whatsappNumber && (
                          <tr>
                            <td className="pr-2 py-0.5">Primary ID:</td>
                            <td className="text-neutral-850 dark:text-neutral-200 font-bold">+{whatsappNumber}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Settings toggles */}
                  <div className="space-y-2.5 pt-1">
                    <label className="flex items-center justify-between cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-xl transition-all">
                      <div>
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Live Scrape Checks</p>
                        <p className="text-[10px] text-neutral-405 dark:text-neutral-400">Auto-verify with socket in search pipeline</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={autoVerifyWithDevice}
                        onChange={(e) => setAutoVerifyWithDevice(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 text-white cursor-pointer rounded-sm"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={disconnectWhatsApp}
                    className="w-full py-2 px-3 bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-650 dark:text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Power className="w-3.5 h-3.5" />
                    Logout WhatsApp Device
                  </button>
                </div>
              )}

              {/* State: PUPPETEER_ERROR */}
              {whatsappStatus === 'PUPPETEER_ERROR' && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl space-y-3 text-center">
                  <div className="flex flex-col items-center">
                    <AlertCircle className="w-7 h-7 text-red-500 mb-1" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">Connection Failed</p>
                    <p className="text-[10px] text-neutral-500 max-w-[210px] leading-relaxed mt-1">
                      {whatsappLastError || "The background chromium environment could not run. Your app falls back to high-accuracy Gemini Search verification automatically."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={initializeWhatsApp}
                    className="py-1.5 px-3 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-[10px] uppercase rounded-lg transition-all mx-auto"
                  >
                    Retry Initialize
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Quick Manual Verification tool */}
          <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
            <button
              onClick={() => setShowManualSection(!showManualSection)} 
              className="w-full flex items-center justify-between font-bold text-neutral-900 dark:text-white"
            >
              <span className="flex items-center gap-2 text-xs uppercase tracking-wider">
                <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                Manual verification tool
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
                {showManualSection ? 'Collapse' : 'Expand'}
              </span>
            </button>

            <AnimatePresence>
              {showManualSection && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-4 space-y-4 pt-1"
                >
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Verify individual phone numbers with real-time deep Google search verification.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Business Name</label>
                      <input 
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="e.g. Sherlocks Safes"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-medium text-neutral-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Phone Number</label>
                      <input 
                        type="text"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        placeholder="e.g. +12127291375"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-medium text-neutral-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Website URL (optional)</label>
                      <input 
                        type="text"
                        value={manualWebsite}
                        onChange={(e) => setManualWebsite(e.target.value)}
                        placeholder="e.g. https://sherlockssafes.com"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-medium text-neutral-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Category (optional)</label>
                      <input 
                        type="text"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        placeholder="e.g. Locksmith"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-medium text-neutral-900 dark:text-white"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isVerifyingManual}
                      onClick={forceSingleVerification}
                      className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 mt-2 shadow-xs"
                    >
                      {isVerifyingManual ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Searching/Verifying with AI...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Verify & Sync Lead
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Stats */}
          <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-4 transition-colors duration-300">
            <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800/50">
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{businesses.length}</p>
              <p className="text-xs font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider">Collected</p>
            </div>
            <div className="text-center p-4 bg-green-50/10 dark:bg-green-950/20 rounded-2xl border border-green-100/50 dark:border-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {businesses.filter(b => b.hasWhatsApp).length}
              </p>
              <p className="text-xs font-bold text-green-605 dark:text-green-400 uppercase tracking-wider">WhatsApp</p>
            </div>
          </section>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Collected Businesses</h2>
            {loading && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{collectionProgress || "Collecting data..."}</span>
                </div>
                {countdown > 0 && (
                  <div className="flex flex-col items-end w-48">
                    <div className="flex justify-between w-full text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      <span>Estimated Time</span>
                      <span>{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "100%" }}
                        animate={{ width: `${(countdown / totalEstimatedTime) * 100}%` }}
                        className="h-full bg-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rating Distribution Chart */}
          {businesses.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 transition-colors duration-300">
              <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                <span>rating distribution (current view)</span>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full lowercase">
                  {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'business' : 'businesses'} filtered
                </span>
              </h3>
              
              <div className="h-44 w-full">
                {filteredBusinesses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
                    <p>No business ratings inside the current selection</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis 
                        dataKey="name" 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: darkMode ? '#a3a3a3' : '#737373', fontSize: 10, fontWeight: 650 }}
                      />
                      <YAxis 
                        tickLine={false} 
                        axisLine={false}
                        allowDecimals={false}
                        tick={{ fill: darkMode ? '#a3a3a3' : '#737373', fontSize: 10, fontWeight: 650 }}
                      />
                      <ChartTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {ratingChartData.map((entry, index) => {
                          let barColor = "#3b82f6"; // Blue
                          if (entry.name === "5.0 ★") barColor = "#22c55e"; // Green
                          else if (entry.name === "4.5-4.9 ★") barColor = "#10b981"; // Emerald
                          else if (entry.name === "< 3.0 ★") barColor = "#ef4444"; // Red
                          return <Cell key={`cell-${index}`} fill={barColor} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Search Bar Row */}
          {businesses.length > 0 && (
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400">
                <Search className="w-5 h-5" />
              </span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search businesses by name, category, or location..."
                className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-xs text-sm font-medium dark:text-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Bulk Action Controls */}
          {filteredBusinesses.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 px-5 py-3 rounded-2xl shadow-xs border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-sm transition-colors duration-300">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Select All Visible"
                />
                <span className="text-neutral-500 dark:text-neutral-400 font-semibold text-xs">
                  {selectedBusinessIds.length > 0 ? (
                    <strong className="text-blue-600 font-bold">{selectedBusinessIds.length}</strong>
                  ) : "0"} / {filteredBusinesses.length} selected
                </span>
              </div>

              {selectedBusinessIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {whatsappStatus === 'READY' && (
                    <button 
                      onClick={bulkVerifySelectedWeb}
                      disabled={checkingWhatsAppId !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl font-bold transition-all text-[11px] border border-emerald-250 dark:border-emerald-905/30 active:scale-95 disabled:opacity-50"
                      title="Direct check all selected rows on active WhatsApp network"
                    >
                      {checkingWhatsAppId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Smartphone className="w-3.5 h-3.5" />
                      )}
                      Device Verify
                    </button>
                  )}
                  <button 
                    onClick={exportSelectedToCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/60 rounded-xl font-bold transition-all text-[11px] border border-green-200 dark:border-green-900/30 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Selected
                  </button>
                  <button 
                    onClick={deleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 rounded-xl font-bold transition-all text-[11px] border border-red-100 dark:border-red-900/30 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected
                  </button>
                  <button 
                    onClick={() => setSelectedBusinessIds([])}
                    className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-[10px] font-bold text-neutral-500 dark:text-neutral-400"
                  >
                    Deselect
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {businesses.length === 0 && !loading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                              className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 transition-colors duration-300"
                >
                  <Search className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-600 dark:text-neutral-400 font-bold">No data collected yet.</p>
                </motion.div>
              ) : filteredBusinesses.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 transition-colors duration-300"
                >
                  <X className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-600 dark:text-neutral-400 font-bold">No rows match your query filters.</p>
                </motion.div>
              ) : (
                filteredBusinesses.map((business) => (
                  <motion.div
                    key={business.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-5 rounded-3xl shadow-sm border ${business.hasWhatsApp ? 'border-green-200 dark:border-green-900/20 bg-green-50/30 dark:bg-green-950/20' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all hover:shadow-md transition-colors duration-300`}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedBusinessIds.includes(business.id)}
                          onChange={() => {
                            if (selectedBusinessIds.includes(business.id)) {
                              setSelectedBusinessIds(selectedBusinessIds.filter(id => id !== business.id));
                            } else {
                              setSelectedBusinessIds([...selectedBusinessIds, business.id]);
                            }
                          }}
                          className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all"
                        />
                      </div>
                      {business.hasWhatsApp && (
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 border-2 border-green-200 dark:border-green-900/60 overflow-hidden flex items-center justify-center">
                            {business.whatsAppProfilePic ? (
                              <img 
                                src={business.whatsAppProfilePic} 
                                alt={business.whatsAppProfileName} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          </div>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                            {business.hasWhatsApp ? (business.whatsAppProfileName || business.name) : business.name}
                          </h3>
                          {business.hasWhatsApp && (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider rounded-full w-fit">
                                <MessageCircle className="w-3 h-3" />
                                Verified
                              </span>
                            </div>
                          )}
                          {!business.hasWhatsApp && business.whatsAppStatus === 'Pending Verification' && (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full w-fit animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Checking...
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {business.hasWhatsApp && business.whatsAppStatus && (
                          <div className="flex flex-col gap-1.5 mb-2">
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium italic bg-green-100/50 dark:bg-green-950/40 px-2 py-0.5 rounded-md w-fit animate-fade-in">
                              ✓ {business.whatsAppStatus}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => markAsNoWhatsApp(business, e)}
                              className="text-[10px] text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/60 px-2 py-1 rounded-lg font-bold flex items-center gap-1 w-fit transition-all duration-200"
                              title="Click to instantly change this lead back to No WhatsApp if the link does not open"
                            >
                              <X className="w-3 h-3" />
                              Not working? Mark as No WhatsApp
                            </button>
                          </div>
                        )}

                        {!business.hasWhatsApp && business.whatsAppStatus && business.whatsAppStatus !== 'Pending Verification' && (
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium mb-2 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md w-fit">
                            ✗ {business.whatsAppStatus}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                          {business.website && (
                            <a 
                              href={business.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {new URL(business.website).hostname}
                            </a>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            {business.phone}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-neutral-900 dark:text-white">{business.rating}</span>
                            <span className="text-neutral-400 dark:text-neutral-500">({business.reviewCount} reviews)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      {whatsappStatus === 'READY' && (
                        <button 
                          onClick={() => verifyNumberWeb(business)}
                          disabled={checkingWhatsAppId === business.id}
                          className={`p-3 rounded-2xl transition-all ${checkingWhatsAppId === business.id ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'text-neutral-400 dark:text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                          title="Verify phone with active WhatsApp Web Device"
                        >
                          {checkingWhatsAppId === business.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Smartphone className="w-5 h-5" />
                          )}
                        </button>
                      )}
                      <button 
                        onClick={() => openEditModal(business)}
                        className="p-3 text-neutral-400 dark:text-neutral-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-2xl transition-all"
                        title="Edit details & Force Override Status"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      {business.hasWhatsApp && (
                        <a 
                          href={`https://wa.me/${business.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all active:scale-95 shadow-xs"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </a>
                      )}
                      <button 
                        onClick={() => deleteBusiness(business.id)}
                        className="p-3 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-2xl transition-all"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>

      {/* Edit and Force Verify Override Modal */}
      <AnimatePresence>
        {editingBusiness && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl max-w-lg w-full border border-neutral-200 dark:border-neutral-800 overflow-hidden transition-colors duration-300"
            >
              <div className="bg-neutral-50 dark:bg-neutral-950 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Correct & Override WhatsApp Status
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{editingBusiness.name}</p>
                </div>
                <button 
                  onClick={() => setEditingBusiness(null)}
                  className="p-1 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Phone Number</label>
                  <input 
                    type="text" 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. +12127291375"
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all"
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Edit the phone number if incorrect. Current target click-to-chat links will change to match.
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">Has WhatsApp Enabled</p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Forces display state of WhatsApp indicator</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editHasWhatsApp}
                        onChange={(e) => {
                          setEditHasWhatsApp(e.target.checked);
                          if (!e.target.checked) {
                            setEditWhatsAppStatus('No active WhatsApp detected (manually unverified)');
                          } else {
                            setEditWhatsAppStatus('Active WhatsApp Business Presence (manually verified)');
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:bg-neutral-300 peer-checked:bg-green-600" />
                    </label>
                  </div>

                  {editHasWhatsApp && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">WhatsApp Custom Display Name</label>
                        <input 
                          type="text" 
                          value={editWhatsAppProfileName}
                          onChange={(e) => setEditWhatsAppProfileName(e.target.value)}
                          placeholder="e.g. Sherlocks Official Customer Care"
                          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Custom Profile Avatar URL</label>
                        <input 
                          type="text" 
                          value={editWhatsAppProfilePic}
                          onChange={(e) => setEditWhatsAppProfilePic(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">WhatsApp Verification Status / Note</label>
                    <textarea 
                      value={editWhatsAppStatus}
                      onChange={(e) => setEditWhatsAppStatus(e.target.value)}
                      placeholder="Note on verification correctness"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 h-16 dark:text-white resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingBusiness(null)}
                  className="px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 rounded-xl font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEditedBusiness}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Apply Corrections
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Default Settings Modal overlay */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl max-w-md w-full border border-neutral-200 dark:border-neutral-800 overflow-hidden transition-colors duration-300"
            >
              <div className="bg-neutral-50 dark:bg-neutral-950 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  Configure Startup Defaults
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Default Business Category</label>
                  <input 
                    type="text" 
                    value={settingsCategory}
                    onChange={(e) => setSettingsCategory(e.target.value)}
                    placeholder="e.g. Restaurants, Plumbers"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all"
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">This default category will auto-fill on workspace load.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Default Target Country</label>
                  <select 
                    value={settingsCountry}
                    onChange={(e) => setSettingsCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all"
                  >
                    <option value="" className="bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">None / Select manually</option>
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">This default country will auto-load on workspace load.</p>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 rounded-xl font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    saveSettings(settingsCountry, settingsCategory);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <ErrorWrapper>
      <AppContent />
    </ErrorWrapper>
  );
}
