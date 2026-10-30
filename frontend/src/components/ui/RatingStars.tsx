'use client';

import React, { useState } from 'react';
import { Star, CheckCircle, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';

interface RatingStarsProps {
  messageId: string;
  initialRating?: number;
  initialComment?: string;
  onRated?: (rating: number) => void;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  messageId,
  initialRating,
  initialComment,
  onRated,
}) => {
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(initialComment || '');
  const [showCommentBox, setShowCommentBox] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!!initialRating);

  const handleSelectRating = async (val: number) => {
    setRating(val);
    setIsSubmitting(true);
    try {
      await api.analytics.submitFeedback(messageId, val, comment);
      setIsSubmitted(true);
      if (onRated) onRated(val);
    } catch (err) {
      console.error('Error al enviar feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setIsSubmitting(true);
    try {
      await api.analytics.submitFeedback(messageId, rating, comment);
      setShowCommentBox(false);
    } catch (err) {
      console.error('Error al enviar comentario:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">¿Te fue útil esta respuesta?</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = (hoverRating || rating || 0) >= star;
            return (
              <button
                key={star}
                type="button"
                disabled={isSubmitting}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleSelectRating(star)}
                aria-label={`Calificar con ${star} estrellas`}
                className="p-0.5 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-300 dark:text-slate-600 hover:text-amber-400"
              >
                <Star
                  className={`w-4 h-4 transition-colors ${
                    isFilled
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
        {isSubmitted && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in">
            <CheckCircle className="w-3.5 h-3.5" />
            ¡Gracias!
          </span>
        )}
        {rating && !showCommentBox && (
          <button
            type="button"
            onClick={() => setShowCommentBox(true)}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1 inline-flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            Agregar nota
          </button>
        )}
      </div>

      {showCommentBox && (
        <form onSubmit={handleSubmitComment} className="mt-2 flex gap-2 animate-fade-in">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Cómo podemos mejorar esta respuesta?"
            className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setShowCommentBox(false)}
            className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
};
