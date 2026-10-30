import React from 'react';
import { Sparkles, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 py-8 text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Alma Project
          </span>
          <span>— Arquitectura RAG con Embeddings Semánticos de 384 dim</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <span>Construido con</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>para alta fidelidad documental & QA auditado</span>
        </div>
      </div>
    </footer>
  );
};
