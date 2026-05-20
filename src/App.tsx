/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Sparkles, 
  Camera, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  AlertCircle, 
  User, 
  LogIn, 
  LogOut, 
  Cloud, 
  Check, 
  Key, 
  Mail, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

// Firebase core configuration
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firebaseErrors';

// --- Types ---

interface Thought {
  id: string;
  content: string;
  timestamp: number;
  color: string;
}

const BUBBLE_COLORS = [
  '219, 234, 254', // Blue
  '233, 213, 255', // Purple
  '252, 231, 243', // Pink
  '254, 243, 199', // Amber
  '209, 250, 229', // Emerald
  '255, 228, 230', // Rose
  '207, 250, 254', // Cyan
  '224, 231, 255', // Indigo
  '237, 233, 254', // Violet
  '250, 232, 255', // Fuchsia
  '204, 251, 241', // Teal
  '254, 249, 195', // Yellow
  '255, 237, 213', // Orange
];

// --- Helper Functions ---

const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    // If it's not a data URL (e.g. empty or placeholder path), skip processing
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      let width = img.width;
      let height = img.height;
      let quality = 0.85;
      let maxDimension = 1600;

      const attemptCompression = () => {
        let currentW = width;
        let currentH = height;
        
        // Calculate dimensions to fit maxDimension
        if (currentW > maxDimension || currentH > maxDimension) {
          if (currentW > currentH) {
            currentH = Math.round((currentH * maxDimension) / currentW);
            currentW = maxDimension;
          } else {
            currentW = Math.round((currentW * maxDimension) / currentH);
            currentH = maxDimension;
          }
        }

        canvas.width = currentW;
        canvas.height = currentH;
        ctx.clearRect(0, 0, currentW, currentH);
        ctx.drawImage(img, 0, 0, currentW, currentH);

        // Compress as jpeg/webp for optimal byte reduction
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Firestore row size limit is 1MB. Since Base64 has ~33% overhead, ~800,000 characters is a very safe ceiling.
        if (dataUrl.length <= 800000 || maxDimension <= 360) {
          resolve(dataUrl);
        } else {
          // Progressively decrease both dimensions and quality factors to guarantee we fall below the Firestore row limit.
          maxDimension = Math.round(maxDimension * 0.75);
          quality = Math.max(0.2, quality - 0.15);
          attemptCompression();
        }
      };

      attemptCompression();
    };
    img.onerror = () => {
      resolve(base64Str); // Fallback to raw if loading fails
    };
  });
};

// --- Components ---

const ThoughtContent = React.memo(({ content, isExpanded, onToggle }: { content: string, isExpanded: boolean, onToggle: () => void }) => {
  const [canTruncate, setCanTruncate] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  const checkTruncation = useCallback(() => {
    if (textRef.current) {
      const el = textRef.current;
      
      const originalStyle = el.style.display;
      const originalClamp = el.style.webkitLineClamp;
      const originalBoxOrient = el.style.webkitBoxOrient;
      const originalOverflow = el.style.overflow;

      el.style.display = '-webkit-box';
      el.style.webkitLineClamp = '10';
      el.style.webkitBoxOrient = 'vertical';
      el.style.overflow = 'hidden';
      const clampedHeight = el.offsetHeight;

      el.style.display = 'block';
      el.style.webkitLineClamp = '';
      el.style.overflow = 'visible';
      const fullHeight = el.scrollHeight;

      el.style.display = originalStyle;
      el.style.webkitLineClamp = originalClamp;
      el.style.webkitBoxOrient = originalBoxOrient;
      el.style.overflow = originalOverflow;

      const nextCanTruncate = fullHeight > clampedHeight + 2;
      setCanTruncate(prev => prev !== nextCanTruncate ? nextCanTruncate : prev);
    }
  }, []);

  useEffect(() => {
    if (!textRef.current) return;
    
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        checkTruncation();
      });
    });
    
    observer.observe(textRef.current);
    checkTruncation();
    
    return () => observer.disconnect();
  }, [content, checkTruncation]);

  return (
    <div className="relative group/content">
      <div 
        className={cn(
          "transition-all duration-500 ease-in-out overflow-hidden",
          !isExpanded ? "max-h-[15rem]" : "max-h-[100rem]"
        )}
      >
        <p 
          ref={textRef}
          className={cn(
            "text-sm font-medium leading-relaxed whitespace-pre-wrap text-left text-gray-900",
            !isExpanded ? "line-clamp-[10]" : ""
          )}
        >
          {content}
        </p>
      </div>
      {canTruncate && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-900/60 hover:text-gray-900 transition-colors flex items-center gap-1 py-1"
        >
          {isExpanded ? (
            <>Show Less <ChevronUp size={12} /></>
          ) : (
            <>Read More <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </div>
  );
});

const FlameIcon = ({ size = 28 }: { size?: number }) => (
  <div className="relative" style={{ width: size, height: size }}>
    <motion.div
      animate={{
        scale: [1, 1.1, 1],
        rotate: [-2, 2, -2],
        y: [0, -2, 0],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <Sparkles className="text-orange-500 fill-orange-500" size={size} />
    </motion.div>
    <motion.div
      animate={{
        scale: [1, 1.3, 1],
        opacity: [0.5, 0.8, 0.5],
        y: [0, -4, 0],
      }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <Sparkles className="text-yellow-400 fill-yellow-400 blur-[2px]" size={size * 0.8} />
    </motion.div>
    <motion.div
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0, 0.4, 0],
        y: [0, -8, 0],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeOut",
      }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="w-2 h-4 bg-orange-300 blur-[4px] rounded-full" />
    </motion.div>
  </div>
);

export default function App() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [bgImage, setBgImage] = useState<string>('');
  const [cardOpacity, setCardOpacity] = useState<number>(0.4);
  const [isDarkBg, setIsDarkBg] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const editInputRef = React.useRef<HTMLTextAreaElement>(null);

  const [activeCols, setActiveCols] = useState(4);
  const [viewportLimit, setViewportLimit] = useState(12);

  // --- New User & Sync States ---
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [localThoughtsBackup, setLocalThoughtsBackup] = useState<Thought[]>([]);

  // Toast notifier
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let cols = 1;
      if (width >= 1280) cols = 4;
      else if (width >= 1024) cols = 3;
      else if (width >= 640) cols = 2;
      
      setActiveCols(cols);

      const availableHeight = height - 300;
      const rows = Math.max(2, Math.ceil(availableHeight / 180));
      setViewportLimit(rows * cols);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // 1. Load Local State (Guest Mode Only)
  useEffect(() => {
    if (currentUser) return;
    try {
      const savedThoughts = localStorage.getItem('thoughts');
      const savedBg = localStorage.getItem('bgImage');
      const savedOpacity = localStorage.getItem('cardOpacity');
      if (savedThoughts) {
        const parsed = JSON.parse(savedThoughts);
        if (Array.isArray(parsed)) setThoughts(parsed);
      } else {
        setThoughts([]);
      }
      if (savedBg) setBgImage(savedBg);
      else setBgImage('');
      
      if (savedOpacity) setCardOpacity(parseFloat(savedOpacity));
      else setCardOpacity(0.4);
    } catch (e) {
      console.error("Failed to load data from localStorage:", e);
    }
  }, [currentUser]);

  // 2. Save Local State (Guest Mode Only)
  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem('thoughts', JSON.stringify(thoughts));
    } catch (e) {
      console.error("Failed to save thoughts:", e);
    }
  }, [thoughts, currentUser]);

  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem('bgImage', bgImage);
    } catch (e) {
      console.error("Failed to save background image:", e);
    }
  }, [bgImage, currentUser]);

  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem('cardOpacity', cardOpacity.toString());
    } catch (e) {
      console.error("Failed to save card opacity:", e);
    }
  }, [cardOpacity, currentUser]);

  // 3. Firestore Sync (Authenticated Mode)
  useEffect(() => {
    if (!currentUser) return;

    // A. Sync user settings
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubSettings = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bgImage !== undefined) setBgImage(data.bgImage);
        if (data.cardOpacity !== undefined) setCardOpacity(data.cardOpacity);
      }
    }, (err) => {
      console.error("Firestore settings sync failed:", err);
    });

    // B. Sync thought records
    const thoughtsColRef = collection(db, 'users', currentUser.uid, 'thoughts');
    const q = query(thoughtsColRef, orderBy('timestamp', 'desc'));
    const unsubThoughts = onSnapshot(q, (snapshot) => {
      const dbThoughts: Thought[] = [];
      snapshot.forEach((snapshotDoc) => {
        dbThoughts.push({
          id: snapshotDoc.id,
          ...snapshotDoc.data()
        } as Thought);
      });
      setThoughts(dbThoughts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}/thoughts`);
    });

    // Check if guest thoughts can be imported to this user
    try {
      const localContents = localStorage.getItem('thoughts');
      if (localContents) {
        const parsed = JSON.parse(localContents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalThoughtsBackup(parsed);
          setShowImportPrompt(true);
        }
      }
    } catch (e) {
      console.error("Error backing up guest thoughts:", e);
    }

    return () => {
      unsubSettings();
      unsubThoughts();
    };
  }, [currentUser]);

  // Background Custom Image Processing & Brightness Analyzer (for both Local & Sync Modes)
  useEffect(() => {
    if (bgImage) {
      const img = new Image();
      if (bgImage.startsWith('http')) {
        img.crossOrigin = "Anonymous";
      }
      img.src = bgImage;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = 20;
          canvas.height = 20;
          ctx.drawImage(img, 0, 0, 20, 20);
          const data = ctx.getImageData(0, 0, 20, 20).data;
          let brightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            brightness += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
          }
          setIsDarkBg((brightness / (data.length / 4)) < 128);
        } catch (e) {
          console.warn("Could not analyze background brightness:", e);
          setIsDarkBg(false);
        }
      };
      img.onerror = () => {
        setIsDarkBg(false);
      };
    } else {
      setIsDarkBg(false);
    }
  }, [bgImage]);

  const updateOpacity = async (opacity: number) => {
    setCardOpacity(opacity);
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, { 
          cardOpacity: opacity, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync cardOpacity to Firestore:", err);
      }
    }
  };

  const updateBgImage = async (imageSrc: string) => {
    let processedSrc = imageSrc;
    
    // Auto-compress base64 images that exceed the Firestore safety limit
    if (imageSrc && imageSrc.startsWith('data:image/')) {
      showToast('正在为您优化并设定背景图...');
      try {
        processedSrc = await compressImage(imageSrc);
      } catch (err) {
        console.error("Compression during updateBgImage failed:", err);
      }
    }

    setBgImage(processedSrc);
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, { 
          bgImage: processedSrc, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
        showToast('背景设计已保存在云端');
      } catch (err) {
        console.error("Failed to sync bgImage to Firestore:", err);
        showToast('云端保存失败，请重试');
      }
    }
  };

  const handleAddThought = async () => {
    if (!newContent.trim()) return;
    
    // Prevent consecutive colors
    let colorIndex = Math.floor(Math.random() * BUBBLE_COLORS.length);
    if (thoughts.length > 0) {
      const lastColor = thoughts[0].color;
      if (BUBBLE_COLORS[colorIndex] === lastColor) {
        colorIndex = (colorIndex + 1) % BUBBLE_COLORS.length;
      }
    }

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const newThoughtPayload = {
      content: newContent.trim(),
      timestamp: Date.now(),
      color: BUBBLE_COLORS[colorIndex],
      userId: currentUser ? currentUser.uid : 'guest'
    };

    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'thoughts', newId);
        await setDoc(docRef, newThoughtPayload);
        showToast('已记录并同步到云端');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}/thoughts/${newId}`);
      }
    } else {
      const newThought: Thought = {
        id: newId,
        ...newThoughtPayload
      };
      setThoughts([newThought, ...thoughts]);
    }

    setNewContent('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleStartEdit = (thought: Thought) => {
    setEditingId(thought.id);
    setEditContent(thought.content);
    // Auto-resize textarea after state update
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.style.height = 'auto';
        editInputRef.current.style.height = `${editInputRef.current.scrollHeight}px`;
        editInputRef.current.focus();
      }
    }, 0);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const finalContent = editContent.trim();
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'thoughts', editingId);
        await updateDoc(docRef, { content: finalContent });
        showToast('云端内容已修改');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}/thoughts/${editingId}`);
      }
    } else {
      setThoughts(prev => prev.map(t => 
        t.id === editingId ? { ...t, content: finalContent } : t
      ));
    }
    setEditingId(null);
    setEditContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, isEdit: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      isEdit ? handleSaveEdit() : handleAddThought();
    }
    if (e.key === 'Escape' && isEdit) {
      setEditingId(null);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>, isEdit: boolean) => {
    if (isEdit) {
      setEditContent(e.target.value);
    } else {
      setNewContent(e.target.value);
    }
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleDelete = async (id: string) => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'thoughts', id);
        await deleteDoc(docRef);
        showToast('已成功从云端删除');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/thoughts/${id}`);
      }
    } else {
      setThoughts(thoughts.filter(t => t.id !== id));
    }
    setConfirmingDeleteId(null);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleBgChange = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast('正在读取图片...');
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          try {
            const compressed = await compressImage(result);
            updateBgImage(compressed);
          } catch (err) {
            console.error("Compression error inside handleBgChange:", err);
            updateBgImage(result);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const filteredThoughts = useMemo(() => {
    if (!searchQuery.trim()) return thoughts;
    const query = searchQuery.toLowerCase();
    return thoughts.filter(t => 
      t.content.toLowerCase().includes(query)
    );
  }, [thoughts, searchQuery]);

  const displayedThoughts = showAll ? filteredThoughts : filteredThoughts.slice(0, viewportLimit);

  const textColor = isDarkBg ? 'text-white' : 'text-gray-900';
  const subTextColor = isDarkBg ? 'text-white/60' : 'text-gray-500';
  const borderColor = isDarkBg ? 'border-white/20' : 'border-black/10';

  return (
    <div 
      className={cn(
        "min-h-screen w-full bg-cover bg-center bg-fixed transition-all duration-1000 flex flex-col items-center p-6 md:p-12 font-sans relative overflow-x-hidden",
        textColor
      )}
      style={{ 
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundColor: '#e0f2fe'
      }}
    >
      {/* Dynamic Background Gradient (only if no bgImage) */}
      {!bgImage && (
        <motion.div 
          animate={{
            background: [
              'linear-gradient(135deg, #bae6fd 0%, #0ea5e9 100%)',
              'linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%)',
              'linear-gradient(135deg, #bae6fd 0%, #38bdf8 100%)',
              'linear-gradient(135deg, #bae6fd 0%, #0ea5e9 100%)',
            ]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-0 -z-20"
        />
      )}

      {/* Top Branding & Controls */}
      <div className="w-full max-w-7xl flex items-center mb-8 px-4 z-10 relative h-16">
        {/* Left: Branding */}
        <div className="w-1/4 flex justify-start">
          <h1 className={cn("text-4xl md:text-5xl font-artistic flex items-center gap-3 drop-shadow-sm shrink-0", textColor)}>
            <FlameIcon size={32} />
            <span className="hidden sm:inline">Sparkles</span>
          </h1>
        </div>
        
        {/* Center: Search Bar - Re-engineered for maximum stability */}
        <div className="w-2/4 flex justify-center px-4">
          <div className={cn(
            "w-full max-w-xl flex items-center relative rounded-full transition-all duration-300 border shadow-sm",
            isDarkBg 
              ? "bg-[#1e1e1e]/90 border-white/10 focus-within:border-white/20 focus-within:bg-[#252525]" 
              : "bg-white/95 border-gray-200 focus-within:border-gray-300 focus-within:bg-white"
          )}>
            <div className="pl-4 flex items-center pointer-events-none">
              <Search 
                size={18} 
                className={cn(
                  "transition-colors duration-300",
                  isDarkBg ? "text-white/30" : "text-gray-400"
                )} 
              />
            </div>
            <input 
              type="text"
              placeholder="Search your sparks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 py-3 px-3 outline-none text-sm md:text-base",
                isDarkBg ? "text-white placeholder:text-white/20" : "text-gray-900 placeholder:text-gray-400"
              )}
              style={{ 
                boxShadow: 'none',
                WebkitAppearance: 'none'
              }}
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-1/4 flex items-center justify-end gap-3 md:gap-4 shrink-0">
          {bgImage && (
          <div className="hidden md:flex flex-col items-end gap-0.5">
            <span className={cn("text-[8px] font-bold uppercase tracking-widest opacity-40", isDarkBg ? "text-white" : "text-gray-900")}>Opacity</span>
            <input 
              type="range" 
              min="0.15" 
              max="1" 
              step="0.01" 
              value={cardOpacity}
              onChange={(e) => updateOpacity(parseFloat(e.target.value))}
              className={cn("custom-range w-20 h-1 rounded-lg appearance-none cursor-pointer", isDarkBg ? "bg-white/30" : "bg-gray-300")}
            />
          </div>
          )}

          {/* User Account / Sync Access Button */}
          <button 
            onClick={() => {
              setAuthError('');
              setIsAuthModalOpen(true);
            }}
            className={cn(
              "p-2.5 md:px-4 md:py-2.5 rounded-full backdrop-blur-md transition-all shadow-sm border flex items-center gap-2 relative",
              isDarkBg 
                ? "bg-white/10 hover:bg-white/20 text-white border-white/20" 
                : "bg-white/30 hover:bg-white/60 text-gray-700 border-white/30"
            )}
            title={currentUser ? `Logged in: ${currentUser.email}` : 'Click to Login & Sync across devices'}
          >
            {currentUser ? (
              <>
                <Cloud size={18} className="text-emerald-400 fill-emerald-400 shrink-0" />
                <span className="text-xs font-bold hidden lg:inline max-w-[100px] truncate">
                  {currentUser.email?.split('@')[0]}
                </span>
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse absolute top-1 right-1 border border-white" />
              </>
            ) : (
              <>
                <User size={18} className="shrink-0" />
                <span className="text-xs font-bold hidden sm:inline">Guest Mode</span>
              </>
            )}
          </button>

          <button 
            onClick={(e) => { e.preventDefault(); handleBgChange(); }}
            className={cn(
              "p-2.5 rounded-full backdrop-blur-md transition-all shadow-sm border group relative flex items-center justify-center",
              isDarkBg ? "bg-white/10 hover:bg-white/20 text-white border-white/20" : "bg-white/35 hover:bg-white/65 text-gray-700 border-white/30"
            )}
            title={bgImage ? 'Change Background' : 'Set Background'}
          >
            <Camera size={18} />
            {bgImage && (
              <div 
                onClick={(e) => { e.stopPropagation(); updateBgImage(''); }}
                className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full p-0.5 hover:bg-black transition-colors cursor-pointer animate-fade-in"
                title="移除背景图"
              >
                <X size={10} />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* "Tap" Card - Positioned below search bar, centered and narrower */}
      {!searchQuery && (
        <div className="w-full max-w-7xl flex justify-center mb-6 px-4 z-20 isolate">
          <motion.div
            layout
            className={cn(
              "w-full max-w-md p-4 rounded-xl shadow-lg shadow-black/5 border flex flex-col cursor-text group relative transition-all hover:brightness-105 transform-gpu",
              isDarkBg ? "border-white/20" : "border-white/40"
            )}
            style={{ 
              backgroundColor: isDarkBg ? `rgba(30, 30, 30, ${cardOpacity})` : `rgba(255, 255, 255, ${cardOpacity})`,
              color: isDarkBg ? 'white' : 'black',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Isolated Backdrop Filter Layer - Using motion to sync with parent height changes */}
            {cardOpacity > 0 && (
              <motion.div 
                key="tap-backdrop"
                layout
                className="absolute inset-0 -z-10 rounded-xl pointer-events-none" 
                style={{ 
                  backdropFilter: `blur(${cardOpacity * 12}px)`,
                  WebkitBackdropFilter: `blur(${cardOpacity * 12}px)`,
                }} 
              />
            )}
            <div className="relative flex flex-col h-full">
              <div className="relative min-h-[52px] flex items-start text-left">
                {!newContent && (
                  <div className={cn("flex items-center gap-1 font-medium absolute pointer-events-none top-0 left-0", isDarkBg ? "text-white/40" : "text-gray-400")}>
                    <motion.div 
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className={cn("w-[2px] h-5", isDarkBg ? "bg-white/40" : "bg-gray-400")}
                    />
                    <span className="text-base">tap...</span>
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={newContent}
                  onChange={(e) => handleInput(e, false)}
                  onKeyDown={(e) => handleKeyDown(e, false)}
                  rows={1}
                  className={cn(
                    "w-full bg-transparent border-none focus:ring-0 p-0 text-base font-medium leading-relaxed resize-none overflow-hidden placeholder-transparent text-left outline-none",
                    isDarkBg ? "text-white" : "text-gray-900"
                  )}
                />
              </div>
              
              <div className={cn("transition-all duration-200 flex justify-end items-center mt-auto", newContent.trim() ? "h-8 pt-2" : "h-0 pt-0 overflow-hidden")}>
                <AnimatePresence>
                  {newContent.trim() && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ 
                        duration: 0.1,
                        ease: [0.7, 0, 0.84, 0]
                      }}
                      onClick={(e) => { e.stopPropagation(); handleAddThought(); }}
                      className={cn(
                        "px-3 py-1 rounded-full backdrop-blur-md text-[8px] font-bold tracking-widest transition-all shadow-lg active:scale-90 relative z-20 border",
                        isDarkBg 
                          ? "bg-white/20 text-white border-white/20 hover:bg-white/30" 
                          : "bg-white/40 text-gray-900 border-black/10 hover:bg-white/60"
                      )}
                    >
                      SAVE SPARK
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tetris-like packing using manual columns for minimum total height and chronological flow */}
      <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 z-10 isolate items-start">
        {Array.from({ length: activeCols }).map((_, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-6 w-full">
            <AnimatePresence mode="popLayout" initial={false}>
              {displayedThoughts
                .filter((_, i) => i % activeCols === colIndex)
                .map((thought) => (
                  <motion.div
                    key={thought.id}
                    layoutId={thought.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className={cn(
                      "w-full p-5 rounded-2xl border flex flex-col relative overflow-hidden group transition-all hover:scale-[1.01] transform-gpu will-change-transform",
                      isDarkBg ? "border-white/10" : "border-white/20"
                    )}
                    transition={{
                      layout: { type: "spring", stiffness: 250, damping: 32, mass: 0.8 },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 }
                    }}
                    style={{ 
                      backgroundColor: thought.color.includes(',') 
                        ? `rgba(${thought.color}, ${cardOpacity})`
                        : `rgba(255, 255, 255, ${cardOpacity})`,
                    }}
                  >
                    {/* Isolated Backdrop Filter Layer - Using motion to sync with layout changes */}
                    {cardOpacity > 0 && (
                      <motion.div 
                        key={`backdrop-${thought.id}`}
                        layout
                        className="absolute inset-0 -z-10 rounded-2xl pointer-events-none" 
                        style={{ 
                          backdropFilter: `blur(${cardOpacity * 12}px)`,
                          WebkitBackdropFilter: `blur(${cardOpacity * 12}px)`,
                        }} 
                      />
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-900/40">
                        {format(thought.timestamp, 'yy.MM.dd')}
                      </span>
                      
                      <div className="flex items-center bg-white/30 backdrop-blur-md rounded-full px-1 py-0.5 border border-white/40 shadow-sm">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(thought.id); }}
                          className="p-1 rounded-full text-gray-700 hover:bg-red-100 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 text-left cursor-pointer" onClick={() => handleStartEdit(thought)}>
                      {editingId === thought.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            ref={editInputRef}
                            value={editContent}
                            onChange={(e) => handleInput(e, true)}
                            onKeyDown={(e) => handleKeyDown(e, true)}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium leading-relaxed text-gray-900 resize-none overflow-hidden outline-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                              className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full hover:bg-black/5 text-gray-500 transition-all"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                              className="text-[9px] font-bold uppercase tracking-widest bg-gray-900 text-white px-2 py-1 rounded-full hover:bg-gray-800 transition-all"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ThoughtContent 
                          content={thought.content} 
                          isExpanded={expandedIds.has(thought.id)} 
                          onToggle={() => toggleExpand(thought.id)} 
                        />
                      )}
                    </div>
                    
                    <div className="mt-3 text-[9px] font-mono text-right text-gray-900/60">
                      {format(thought.timestamp, 'HH:mm')}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Show More Button */}
      {thoughts.length > viewportLimit && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowAll(!showAll)}
          className={cn(
            "mt-12 flex items-center gap-2 px-6 py-3 rounded-full backdrop-blur-md shadow-md transition-all font-medium",
            isDarkBg 
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20" 
              : "bg-white/80 hover:bg-white text-gray-700"
          )}
        >
          {showAll ? (
            <>收起 <ChevronUp size={20} /></>
          ) : (
            <>查看更多 <ChevronDown size={20} /></>
          )}
        </motion.button>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmingDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingDeleteId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">确认删除？</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                这条记录将被永久移除，此操作无法撤销。
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setConfirmingDeleteId(null)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(confirmingDeleteId)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all active:scale-95"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Synchronous Action Toasts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-full bg-gray-900/90 text-white backdrop-blur-md shadow-2xl flex items-center gap-2 border border-white/10"
          >
            <Cloud size={16} className="text-emerald-400 fill-emerald-400 shrink-0" />
            <span className="text-xs font-semibold tracking-wider font-sans whitespace-nowrap leading-none">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Account & Security Auth Dialog */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isAuthLoading) setIsAuthModalOpen(false);
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className={cn(
                "relative w-full max-w-md rounded-3xl p-8 shadow-2xl border flex flex-col relative overflow-hidden",
                isDarkBg ? "bg-zinc-900 text-white border-zinc-800" : "bg-white text-gray-950 border-gray-100"
              )}
            >
              <button
                disabled={isAuthLoading}
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              {currentUser ? (
                // L1: Logged In Account Overview
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5 text-emerald-500 animate-bounce-slow">
                    <Cloud size={34} className="fill-emerald-500/25" />
                  </div>
                  <h2 className="text-xl font-bold mb-1">云端同步中心</h2>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 mb-6 font-semibold border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    实现在线同步已激活
                  </span>

                  <div className="w-full text-left bg-black/5 dark:bg-white/5 rounded-2xl p-4 mb-6 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-60">当前主空间账号</span>
                      <span className="font-bold underline truncate max-w-[180px]">{currentUser.email}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-60">云端存储名片数</span>
                      <span className="font-bold">{thoughts.length} 张</span>
                    </div>
                  </div>

                  <p className="text-xs opacity-60 leading-relaxed mb-8">
                    你的 Sparkles 壁画在电脑和手机端保持实时同步。每个人都有自己独属的高阶空间，互不干扰！
                  </p>

                  <button
                    disabled={isAuthLoading}
                    onClick={async () => {
                      try {
                        setIsAuthLoading(true);
                        await signOut(auth);
                        setThoughts([]); // React effect will reload LocalStorage automatically
                        setIsAuthModalOpen(false);
                        showToast('已断开同步，进入客体模式');
                      } catch (err: any) {
                        setAuthError(err.message);
                      } finally {
                        setIsAuthLoading(false);
                      }
                    }}
                    className="w-full px-5 py-3 rounded-2xl border border-red-500/30 text-red-500 font-semibold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    {isAuthLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <LogOut size={16} />
                    )}
                    断开实现在线同步 (登出)
                  </button>
                </div>
              ) : (
                // L2: Auth Forms (Login / Register) Include standard validation
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                      <Sparkles size={20} className="fill-orange-500/20" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Sparkles 云空间</h2>
                      <p className="text-xs opacity-60">同步合并名片，解锁互通壁画</p>
                    </div>
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{authError}</span>
                    </motion.div>
                  )}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setAuthError('');
                      if (!authEmail.trim() || !authPassword) {
                        setAuthError('请输入完整的账号信息');
                        return;
                      }

                      setIsAuthLoading(true);
                      if (isRegistering) {
                        // Registration logic
                        if (authPassword !== authConfirmPassword) {
                          setAuthError('两次输入的密码不一致');
                          setIsAuthLoading(false);
                          return;
                        }
                        if (authPassword.length < 6) {
                          setAuthError('密码太简单，长度至少需要 6 个字符');
                          setIsAuthLoading(false);
                          return;
                        }
                        try {
                          await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                          showToast('注册并同步激活成功！');
                          setAuthEmail('');
                          setAuthPassword('');
                          setAuthConfirmPassword('');
                          setIsAuthModalOpen(false);
                        } catch (err: any) {
                          console.error("Register Error:", err);
                          if (err.code === 'auth/email-already-in-use') {
                            setAuthError('该邮箱已被注册，请直接点击登录');
                          } else if (err.code === 'auth/invalid-email') {
                            setAuthError('请输入格式合法的邮箱地址');
                          } else {
                            setAuthError(err.message || '注册失败，请检查密码后重试');
                          }
                        }
                      } else {
                        // Login Logic
                        try {
                          await signInWithEmailAndPassword(auth, authEmail, authPassword);
                          showToast('欢迎回来，同步已加载！');
                          setAuthEmail('');
                          setAuthPassword('');
                          setIsAuthModalOpen(false);
                        } catch (err: any) {
                          console.error("Login Error:", err);
                          if (
                            err.code === 'auth/user-not-found' || 
                            err.code === 'auth/wrong-password' || 
                            err.code === 'auth/invalid-credential'
                          ) {
                            setAuthError('邮箱或密码不正确');
                          } else {
                            setAuthError(err.message || '登录失败，请再次重试');
                          }
                        }
                      }
                      setIsAuthLoading(false);
                    }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 opacity-40" />
                      <input
                        type="email"
                        placeholder="请输入邮箱"
                        disabled={isAuthLoading}
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className={cn(
                          "w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:ring-1 focus:ring-sky-500 outline-none transition-all",
                          isDarkBg 
                            ? "bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500 focus:border-sky-500" 
                            : "bg-gray-50 text-gray-950 border-gray-200 placeholder:text-gray-400 focus:border-sky-500"
                        )}
                        required
                      />
                    </div>

                    <div className="relative">
                      <Key size={16} className="absolute left-3.5 top-3.5 opacity-40" />
                      <input
                        type="password"
                        placeholder="请输入密码"
                        disabled={isAuthLoading}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className={cn(
                          "w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:ring-1 focus:ring-sky-500 outline-none transition-all",
                          isDarkBg 
                            ? "bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500 focus:border-sky-500" 
                            : "bg-gray-50 text-gray-950 border-gray-200 placeholder:text-gray-400 focus:border-sky-500"
                        )}
                        required
                      />
                    </div>

                    {isRegistering && (
                      <div className="relative">
                        <Key size={16} className="absolute left-3.5 top-3.5 opacity-40" />
                        <input
                          type="password"
                          placeholder="请确认密码"
                          disabled={isAuthLoading}
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          className={cn(
                            "w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:ring-1 focus:ring-sky-500 outline-none transition-all",
                            isDarkBg 
                              ? "bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500 focus:border-sky-500" 
                              : "bg-gray-50 text-gray-950 border-gray-200 placeholder:text-gray-400 focus:border-sky-500"
                          )}
                          required={isRegistering}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full py-3.5 bg-gray-900 text-white dark:bg-white dark:text-gray-950 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      {isAuthLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isRegistering ? (
                        '创建账户并激活同步'
                      ) : (
                        '登录并加载同步数据'
                      )}
                    </button>
                  </form>

                  <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                    <span className="flex-shrink mx-4 text-[10px] uppercase tracking-widest opacity-40 font-semibold">或者</span>
                    <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
                  </div>

                  {/* Standard Google Popup login Option */}
                  <button
                    onClick={async () => {
                      setAuthError('');
                      try {
                        setIsAuthLoading(true);
                        const provider = new GoogleAuthProvider();
                        await signInWithPopup(auth, provider);
                        showToast('Google 账号已成功接入！');
                        setIsAuthModalOpen(false);
                      } catch (err: any) {
                        console.error("Google Authentication error:", err);
                        setAuthError(err.message || 'Google 登录失败，请重试');
                      } finally {
                        setIsAuthLoading(false);
                      }
                    }}
                    disabled={isAuthLoading}
                    className={cn(
                      "w-full py-3 border rounded-2xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer",
                      isDarkBg 
                        ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100" 
                        : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 12-4.53z" />
                    </svg>
                    使用 Google 账号一键同步
                  </button>

                  <div className="mt-5 text-center">
                    <button
                      disabled={isAuthLoading}
                      onClick={() => {
                        setAuthError('');
                        setIsRegistering(!isRegistering);
                      }}
                      className="text-xs text-sky-500 hover:underline hover:text-sky-600 font-semibold cursor-pointer"
                    >
                      {isRegistering ? '已有专属账号？立即登录' : '没有专属账号？创建同步新账户'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guest Backup Sync Prompt overlay */}
      <AnimatePresence>
        {showImportPrompt && currentUser && localThoughtsBackup.length > 0 && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border flex flex-col items-center text-center",
                isDarkBg ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-950"
              )}
            >
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-5 animate-pulse">
                <RefreshCw size={28} />
              </div>

              <h2 className="text-xl font-bold mb-2">发现本地名片记录！</h2>
              <p className="text-gray-500 dark:text-zinc-400 text-xs mb-6 px-1 leading-relaxed">
                我们在你的设备中发现了 <strong>{localThoughtsBackup.length} 条</strong> 客体记录。要将它们以及自定义设置(背景图、不透明度)一键合并到你的新账号云端空间吗？
              </p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  disabled={isAuthLoading}
                  onClick={async () => {
                    setIsAuthLoading(true);
                    try {
                      const batch = writeBatch(db);
                      localThoughtsBackup.forEach((thought) => {
                        const docRef = doc(db, 'users', currentUser.uid, 'thoughts', thought.id);
                        batch.set(docRef, {
                          content: thought.content,
                          timestamp: thought.timestamp,
                          color: thought.color,
                          userId: currentUser.uid
                        });
                      });
                      await batch.commit();

                      const savedBg = localStorage.getItem('bgImage');
                      const savedOpacity = localStorage.getItem('cardOpacity');
                      const userDocRef = doc(db, 'users', currentUser.uid);
                      await setDoc(userDocRef, {
                        bgImage: savedBg || '',
                        cardOpacity: parseFloat(savedOpacity || '0.4'),
                        updatedAt: new Date().toISOString()
                      }, { merge: true });

                      showToast(`已成功将 ${localThoughtsBackup.length} 条名片同步！`);
                      localStorage.removeItem('thoughts'); // Clear local cache to finalize sync!
                      setLocalThoughtsBackup([]);
                      setShowImportPrompt(false);
                    } catch (err: any) {
                      console.error("Critical Merge Error:", err);
                      showToast('数据同步合并失败');
                    } finally {
                      setIsAuthLoading(false);
                    }
                  }}
                  className="w-full py-3.5 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isAuthLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    '一键同步合并到云端'
                  )}
                </button>

                <button
                  disabled={isAuthLoading}
                  onClick={() => {
                    localStorage.removeItem('thoughts'); // ignore to skip and clear
                    setLocalThoughtsBackup([]);
                    setShowImportPrompt(false);
                    showToast('已切换至全新空云端');
                  }}
                  className={cn(
                    "w-full py-3 rounded-2xl text-xs font-medium transition-all active:scale-[0.98] cursor-pointer",
                    isDarkBg ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
                  )}
                >
                  暂时忽略 (开始全新云壁画)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px;
          height: 8px;
          background: ${isDarkBg ? 'rgba(255,255,255,0.8)' : 'rgba(17,24,39,0.8)'};
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .custom-range::-webkit-slider-thumb:hover {
          transform: scale(1.3);
          background: ${isDarkBg ? 'white' : '#111827'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .custom-range::-moz-range-thumb {
          width: 8px;
          height: 8px;
          background: ${isDarkBg ? 'rgba(255,255,255,0.8)' : 'rgba(17,24,39,0.8)'};
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .custom-range::-moz-range-thumb:hover {
          transform: scale(1.3);
          background: ${isDarkBg ? 'white' : '#111827'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
