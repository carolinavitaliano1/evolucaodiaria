import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from './button';
import { Eraser, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SignaturePadRef {
  clear: () => void;
  save: () => string;
}

interface SignaturePadProps {
  value?: string;
  onChange?: (signature: string) => void;
  className?: string;
  disabled?: boolean;
  hideButtons?: boolean;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ value, onChange, className, disabled, hideButtons }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(!!value);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (value) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = value;
      }
    }, [value]);

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      setHasSignature(false);
      onChange?.('');
    };

    const saveCanvas = (): string => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      const dataUrl = canvas.toDataURL('image/png');
      onChange?.(dataUrl);
      return dataUrl;
    };

    useImperativeHandle(ref, () => ({
      clear: clearCanvas,
      save: saveCanvas,
    }));

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      setIsDrawing(true);
      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
    };

    return (
      <div className={cn('space-y-2', className)}>
        <div className="relative border-2 border-dashed border-border rounded-lg overflow-hidden bg-background">
          <canvas
            ref={canvasRef}
            className={cn(
              'w-full h-40 sm:h-48 cursor-crosshair touch-none',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasSignature && !disabled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-muted-foreground text-sm">Assine aqui</span>
            </div>
          )}
        </div>
        {!disabled && !hideButtons && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              className="gap-1"
            >
              <Eraser className="w-3 h-3" />
              Limpar
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={saveCanvas}
              disabled={!hasSignature}
              className="gap-1"
            >
              <Check className="w-3 h-3" />
              Confirmar
            </Button>
          </div>
        )}
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
