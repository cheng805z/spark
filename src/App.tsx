/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Sparkles, Camera, Trash2, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

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

  // Load data
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let cols = 1;
      if (width >= 1280) cols = 4;
      else if (width >= 1024) cols = 3;
      else if (width >= 640) cols = 2;
      
      setActiveCols(cols);

      // Estimate how many cards fill the screen
      // Header + Tap card take roughly 300px
      // Average card height is ~200px
      const availableHeight = height - 300;
      const rows = Math.max(2, Math.ceil(availableHeight / 180));
      setViewportLimit(rows * cols);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      const savedThoughts = localStorage.getItem('thoughts');
      const savedBg = localStorage.getItem('bgImage');
      const savedOpacity = localStorage.getItem('cardOpacity');
      if (savedThoughts) {
        const parsed = JSON.parse(savedThoughts);
        if (Array.isArray(parsed)) setThoughts(parsed);
      }
      if (savedBg) setBgImage(savedBg);
      if (savedOpacity) setCardOpacity(parseFloat(savedOpacity));
    } catch (e) {
      console.error("Failed to load data from localStorage:", e);
    }
  }, []);

  // Save data
  useEffect(() => {
    try {
      localStorage.setItem('thoughts', JSON.stringify(thoughts));
    } catch (e) {
      console.error("Failed to save thoughts:", e);
    }
  }, [thoughts]);

  useEffect(() => {
    try {
      localStorage.setItem('bgImage', bgImage);
    } catch (e) {
      console.error("Failed to save background image (likely quota exceeded):", e);
      // If it's too big, we might want to clear it or warn the user
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn("Background image is too large for localStorage.");
      }
    }
    if (bgImage) {
      const img = new Image();
      // Add crossOrigin for URL-based images to prevent canvas security errors
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

  useEffect(() => {
    try {
      localStorage.setItem('cardOpacity', cardOpacity.toString());
    } catch (e) {
      console.error("Failed to save card opacity:", e);
    }
  }, [cardOpacity]);

  const handleAddThought = () => {
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
    const newThought: Thought = {
      id: newId,
      content: newContent,
      timestamp: Date.now(),
      color: BUBBLE_COLORS[colorIndex],
    };
    setThoughts([newThought, ...thoughts]);
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

  const handleSaveEdit = () => {
    if (!editingId) return;
    setThoughts(prev => prev.map(t => 
      t.id === editingId ? { ...t, content: editContent } : t
    ));
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

  const handleDelete = (id: string) => {
    setThoughts(thoughts.filter(t => t.id !== id));
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
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setBgImage(result);
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
        <div className="w-1/4 flex items-center justify-end gap-4 shrink-0">
          {bgImage && (
          <div className="hidden md:flex flex-col items-end gap-0.5">
            <span className={cn("text-[8px] font-bold uppercase tracking-widest opacity-40", isDarkBg ? "text-white" : "text-gray-900")}>Opacity</span>
            <input 
              type="range" 
              min="0.15" 
              max="1" 
              step="0.01" 
              value={cardOpacity}
              onChange={(e) => setCardOpacity(parseFloat(e.target.value))}
              className={cn("custom-range w-20 h-1 rounded-lg appearance-none cursor-pointer", isDarkBg ? "bg-white/30" : "bg-gray-300")}
            />
          </div>
          )}
          <button 
            onClick={(e) => { e.preventDefault(); handleBgChange(); }}
            className={cn(
              "p-2.5 rounded-full backdrop-blur-md transition-all shadow-sm border group relative flex items-center justify-center",
              isDarkBg ? "bg-white/10 hover:bg-white/20 text-white border-white/20" : "bg-white/20 hover:bg-white/40 text-gray-700 border-white/30"
            )}
            title={bgImage ? 'Change Background' : 'Set Background'}
          >
            <Camera size={18} />
            {bgImage && (
              <div 
                onClick={(e) => { e.stopPropagation(); setBgImage(''); }}
                className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full p-0.5 hover:bg-black transition-colors cursor-pointer"
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
            <>查看更多 ({thoughts.length - viewportLimit}) <ChevronDown size={20} /></>
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
