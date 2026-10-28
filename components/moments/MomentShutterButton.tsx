'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  RECORDING_HOLD_THRESHOLD_MS,
  MAX_VIDEO_RECORDING_MS,
  MIN_VIDEO_RECORDING_MS,
  CANCEL_DRAG_DISTANCE_PX,
} from '@/lib/media/momentMedia'

interface MomentShutterButtonProps {
  onCapturePhoto: () => void | Promise<void>
  onStartRecording: () => void | Promise<void>
  onStopRecording: () => void | Promise<void>
  onCancelRecording?: () => void
  disabled?: boolean
  isRecording?: boolean
  className?: string
}

const SVG_SIZE = 88
const STROKE_WIDTH = 4
const RADIUS = (SVG_SIZE - STROKE_WIDTH) / 2 // 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ~263.89

export default function MomentShutterButton({
  onCapturePhoto,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  disabled = false,
  isRecording: externalIsRecording,
  className = '',
}: MomentShutterButtonProps) {
  const [internalRecording, setInternalRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0) // 0 to 1

  const isRecording = externalIsRecording !== undefined ? externalIsRecording : internalRecording

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const autoStopTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const isCancelledRef = useRef<boolean>(false)

  // Clear all pending timers and RAF
  const clearTimers = useCallback(() => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    recordingStartTimeRef.current = null
  }, [])

  // Safely release pointer capture
  const safeReleasePointerCapture = useCallback(() => {
    if (pointerIdRef.current !== null && buttonRef.current) {
      try {
        if (buttonRef.current.hasPointerCapture(pointerIdRef.current)) {
          buttonRef.current.releasePointerCapture(pointerIdRef.current)
        }
      } catch {
        // ignore capture errors
      }
      pointerIdRef.current = null
    }
    startPosRef.current = null
  }, [])

  // Reset internal states
  const resetState = useCallback(() => {
    clearTimers()
    setInternalRecording(false)
    setRecordingProgress(0)
    isCancelledRef.current = false
    safeReleasePointerCapture()
  }, [clearTimers, safeReleasePointerCapture])

  // Sync when external recording stops
  useEffect(() => {
    if (externalIsRecording === false && internalRecording) {
      resetState()
    }
  }, [externalIsRecording, internalRecording, resetState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  // Progress animation tick
  const startProgressAnimation = useCallback(() => {
    recordingStartTimeRef.current = performance.now()
    setRecordingProgress(0)

    const updateFrame = () => {
      if (!recordingStartTimeRef.current) return
      const elapsed = performance.now() - recordingStartTimeRef.current
      const progress = Math.min(1, elapsed / MAX_VIDEO_RECORDING_MS)
      setRecordingProgress(progress)

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(updateFrame)
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(updateFrame)
  }, [])

  // Handle start of recording after 300ms hold
  const triggerStartRecording = useCallback(() => {
    if (isCancelledRef.current) return
    setInternalRecording(true)
    startProgressAnimation()
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(50)
      } catch {
        // ignore vibrate failures
      }
    }
    void onStartRecording()

    // 2s auto-stop
    autoStopTimerRef.current = window.setTimeout(() => {
      autoStopTimerRef.current = null
      void onStopRecording()
      resetState()
    }, MAX_VIDEO_RECORDING_MS)
  }, [onStartRecording, onStopRecording, startProgressAnimation, resetState])

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return
    // Prevent double pointerdown if already holding or recording
    if (pressTimerRef.current !== null || isRecording) return
    e.preventDefault()

    isCancelledRef.current = false
    startPosRef.current = { x: e.clientX, y: e.clientY }
    pointerIdRef.current = e.pointerId

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    // Schedule recording start after 300ms hold threshold
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null
      triggerStartRecording()
    }, RECORDING_HOLD_THRESHOLD_MS)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPosRef.current || isCancelledRef.current) return

    const dx = e.clientX - startPosRef.current.x
    const dy = e.clientY - startPosRef.current.y
    const distance = Math.hypot(dx, dy)

    if (distance > CANCEL_DRAG_DISTANCE_PX) {
      // Drag cancel threshold exceeded (> 50px)
      isCancelledRef.current = true
      clearTimers()

      if (isRecording) {
        if (onCancelRecording) {
          onCancelRecording()
        } else {
          void onStopRecording()
        }
      }

      resetState()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    if (isCancelledRef.current) {
      resetState()
      return
    }

    if (pressTimerRef.current !== null) {
      // Tap detected (< 300ms): Photo capture
      clearTimers()
      safeReleasePointerCapture()
      void onCapturePhoto()
    } else if (isRecording) {
      // Released during recording: Stop video recording early
      const elapsed = recordingStartTimeRef.current ? performance.now() - recordingStartTimeRef.current : 0
      if (elapsed < MIN_VIDEO_RECORDING_MS) {
        // Less than min duration (< 200ms recorded, total < 500ms): too short, cancel safely
        if (onCancelRecording) {
          onCancelRecording()
        } else {
          void onStopRecording()
        }
      } else {
        void onStopRecording()
      }
      resetState()
    } else {
      resetState()
    }
  }

  const handlePointerCancel = () => {
    clearTimers()
    if (isRecording) {
      if (onCancelRecording) {
        onCancelRecording()
      } else {
        void onStopRecording()
      }
    }
    resetState()
  }

  const strokeDashoffset = CIRCUMFERENCE * (1 - recordingProgress)

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer SVG Progress Ring for 2s Recording */}
      <svg
        className={`pointer-events-none absolute -inset-[5px] z-20 h-[88px] w-[88px] -rotate-90 transition-opacity duration-150 ${
          isRecording ? 'opacity-100' : 'opacity-0'
        }`}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      >
        {/* Background track */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Animated active progress */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#EF4444"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-75 ease-linear"
        />
      </svg>

      {/* Main Shutter Button */}
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={isRecording ? 'Đang quay video 2 giây' : 'Chụp ảnh hoặc giữ để quay video 2 giây'}
        className={`relative flex h-[78px] w-[78px] touch-none select-none items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40 ${
          isRecording ? 'scale-105' : ''
        }`}
        style={{
          WebkitTouchCallout: 'none',
          userSelect: 'none',
        }}
      >
        {/* Outer 3D metallic champagne-gold jewelry bezel / Red glow when recording */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-200 ${
            isRecording
              ? 'bg-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]'
              : 'bg-gradient-to-br from-[#FFF8E7] via-[#E8D08D] to-[#99732B] shadow-[0_0_30px_rgba(232,208,141,0.55),0_0_60px_rgba(232,208,141,0.25)]'
          }`}
        />

        {/* Subtle inner dark bezel ring */}
        <div className="absolute inset-[3.5px] rounded-full bg-[#121214]" />

        {/* Center Core: Solid White Circle (photo) -> Red Rounded Core (recording) */}
        <span
          className={`relative z-10 transition-all duration-200 ease-out ${
            isRecording
              ? 'h-8 w-8 rounded-lg bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]'
              : 'h-[52px] w-[52px] rounded-full bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_12px_rgba(255,255,255,0.8)]'
          }`}
        />
      </button>
    </div>
  )
}
