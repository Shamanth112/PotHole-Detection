import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageViewerProps {
  url: string | null;
  onClose: () => void;
  title?: string;
}

export default function ImageViewer({ url, onClose, title = "Image File" }: ImageViewerProps) {
  if (!url) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div 
          className="relative max-w-5xl w-full max-h-[90vh] flex flex-col justify-center items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 p-4 z-10 flex justify-between w-full">
            <h3 className="text-white font-black uppercase tracking-widest drop-shadow-md bg-black/40 px-3 py-1 rounded-xl">{title}</h3>
            <button 
              onClick={onClose}
              className="bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors shadow-lg border border-white/10"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            src={url} 
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 mt-12"
            alt={title}
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
