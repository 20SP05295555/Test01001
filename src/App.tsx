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
  Moon
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
  const [user, setUser] = useState<User | null>(null);
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(isPaused);
  const isCollectingRef = useRef(isCollecting);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isCollectingRef.current = isCollecting;
  }, [isCollecting]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

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
    if (user) {
      const q = query(collection(db, 'businesses'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
        setBusinesses(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }, (err) => {
        console.error("Firestore error:", err);
        setError("Failed to sync with database.");
        handleFirestoreError(err, OperationType.LIST, 'businesses');
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in with Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setBusinesses([]);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

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
          const docId = `${b.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const initialBiz: Business = {
            id: docId,
            name: b.name,
            website: b.website,
            phone: b.phone,
            rating: b.rating || 4.2,
            reviewCount: b.reviewCount || 10,
            hasWhatsApp: false,
            whatsAppStatus: 'Pending Verification',
            category,
            location: `${run.city} (${selectedCountry})`,
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
             - US and Canada (+1): Since mobile and landline share area codes, DO NOT assume. Search the website for "wa.me", "api.whatsapp.com", or explicit mention of "WhatsApp us" to set hasWhatsApp to true.

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
                    await setDoc(doc(db, 'businesses', originalBiz.id), {
                      ...originalBiz,
                      hasWhatsApp: v.hasWhatsApp,
                      whatsAppStatus: v.hasWhatsApp ? v.whatsAppStatus : 'No active WhatsApp detected',
                      whatsAppProfileName: v.hasWhatsApp ? (v.whatsAppProfileName || originalBiz.name) : originalBiz.name,
                      whatsAppProfilePic: v.hasWhatsApp ? (v.whatsAppProfilePic || null) : null,
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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 transition-colors duration-350 relative">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-6 right-6 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-xs"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-550" />}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Trustpilot Collector</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8">Sign in to start collecting business data from Trustpilot.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-neutral-850 border-2 border-neutral-200 dark:border-neutral-750 rounded-2xl font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all active:scale-95 shadow-xs"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

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
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-305 text-sm font-semibold rounded-xl transition-all"
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
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-305 text-sm font-semibold rounded-xl transition-all"
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
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-250">{user.displayName}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-red-650 dark:hover:text-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-8">
        
        {/* Top Global Summary Cards Across All Collections */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs transition-colors duration-300">
            <div>
              <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wider mb-1">Global Total Leads</p>
              <p className="text-3xl font-extrabold text-neutral-905 dark:text-white">{businesses.length}</p>
              <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-1">All database records combined</p>
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
              <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-wider mb-1">No WhatsApp Presence</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-neutral-905 dark:text-white">
                  {businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length}
                </p>
                {businesses.length > 0 && (
                  <span className="text-xs font-bold text-neutral-400 dark:text-neutral-350 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                    {Math.round((businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length / businesses.length) * 100) > 100 ? 100 : Math.round((businesses.filter(b => !b.hasWhatsApp && b.whatsAppStatus !== 'Pending Verification').length / businesses.length) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Unreached number or landlines</p>
            </div>
            <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-2xl flex items-center justify-center">
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
                <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Business Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Restaurants, Plumbers"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-202 dark:border-neutral-750 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Country</label>
                <select 
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedCities([]);
                  }}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-202 dark:border-neutral-750 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Select Country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.name} className="dark:bg-neutral-900 dark:text-white">{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedCountry && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Cities (Multi-select)</label>
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
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-neutral-50 dark:bg-neutral-850 border border-neutral-202 dark:border-neutral-750 rounded-2xl">
                    {COUNTRIES.find(c => c.name === selectedCountry)?.cities.map(city => (
                      <label key={city} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-neutral-850 rounded-xl cursor-pointer transition-colors">
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
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-neutral-400 dark:text-neutral-550 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm font-medium"
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

          {/* Stats */}
          <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-4 transition-colors duration-300">
            <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-850 rounded-2xl">
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{businesses.length}</p>
              <p className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">Collected</p>
            </div>
            <div className="text-center p-4 bg-green-50/10 dark:bg-green-950/20 rounded-2xl border border-green-100/50 dark:border-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {businesses.filter(b => b.hasWhatsApp).length}
              </p>
              <p className="text-xs font-bold text-green-500 dark:text-green-500 uppercase tracking-wider">WhatsApp</p>
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
              <h3 className="text-xs font-bold text-neutral-450 dark:text-neutral-400 uppercase tracking-wider flex items-center justify-between">
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
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-400 dark:text-neutral-550 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
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
                <div className="flex items-center gap-2">
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
                    className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 rounded-lg text-[10px] font-bold text-neutral-500 dark:text-neutral-400"
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
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 transition-colors duration-300"
                >
                  <Search className="w-12 h-12 text-neutral-250 dark:text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-400 dark:text-neutral-500 font-medium font-medium">No data collected yet.</p>
                </motion.div>
              ) : filteredBusinesses.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 transition-colors duration-300"
                >
                  <X className="w-12 h-12 text-neutral-350 dark:text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-450 dark:text-neutral-500 font-medium">No rows match your query filters.</p>
                </motion.div>
              ) : (
                filteredBusinesses.map((business) => (
                  <motion.div
                    key={business.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-5 rounded-3xl shadow-sm border ${business.hasWhatsApp ? 'border-green-200 dark:border-green-955/20 bg-green-50/30 dark:bg-green-950/20' : 'bg-white dark:bg-neutral-900 border-neutral-202 dark:border-neutral-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all hover:shadow-md transition-colors duration-300`}
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
                          <p className="text-[10px] text-green-600 dark:text-green-400 font-medium mb-2 italic bg-green-100/50 dark:bg-green-950/40 px-2 py-0.5 rounded-md w-fit animate-fade-in">
                            ✓ {business.whatsAppStatus}
                          </p>
                        )}

                        {!business.hasWhatsApp && business.whatsAppStatus && business.whatsAppStatus !== 'Pending Verification' && (
                          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 font-medium mb-2 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md w-fit">
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
              <div className="bg-neutral-50 dark:bg-neutral-850 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
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
                  <label className="block text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider mb-2">Default Business Category</label>
                  <input 
                    type="text" 
                    value={settingsCategory}
                    onChange={(e) => setSettingsCategory(e.target.value)}
                    placeholder="e.g. Restaurants, Plumbers"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all"
                  />
                  <p className="text-[11px] text-neutral-405 dark:text-neutral-500 mt-1">This default category will auto-fill on workspace load.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider mb-2">Default Target Country</label>
                  <select 
                    value={settingsCountry}
                    onChange={(e) => setSettingsCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold transition-all"
                  >
                    <option value="" className="dark:bg-neutral-900 dark:text-white">None / Select manually</option>
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name} className="dark:bg-neutral-900 dark:text-white">{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-405 dark:text-neutral-500 mt-1">This default country will auto-load on workspace load.</p>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-250 dark:border-neutral-700 rounded-xl font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-all active:scale-95"
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
