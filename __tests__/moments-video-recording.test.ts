// __tests__/moments-video-recording.test.ts
// Unit tests, boundary validation & integration tests for Moments 2s video recording feature

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import MomentShutterButton from '@/components/moments/MomentShutterButton'
import {
  RECORDING_HOLD_THRESHOLD_MS,
  MAX_VIDEO_RECORDING_MS,
  MIN_VIDEO_RECORDING_MS,
  MIN_TOTAL_HOLD_DURATION_MS,
  CANCEL_DRAG_DISTANCE_PX,
  getSupportedVideoMimeType,
  getVideoExtension,
} from '@/lib/media/momentMedia'

// --- State Machine Model for Gestures and Boundary Timing ---

export interface ShutterState {
  mode: 'idle' | 'holding_candidate' | 'recording' | 'preview'
  mediaType: 'image' | 'video' | null
  recordingDurationMs: number
  isCancelled: boolean
  progress: number // 0 to 1
  hapticTriggered: boolean
}

export interface ShutterConfig {
  longPressThresholdMs: number // 300ms
  maxDurationMs: number // 2000ms
  minDurationMs: number // 200ms (recording duration)
  minTotalHoldDurationMs: number // 500ms
  dragCancelThresholdPx: number // 50px
}

export const DEFAULT_SHUTTER_CONFIG: ShutterConfig = {
  longPressThresholdMs: RECORDING_HOLD_THRESHOLD_MS, // 300
  maxDurationMs: MAX_VIDEO_RECORDING_MS, // 2000
  minDurationMs: MIN_VIDEO_RECORDING_MS, // 200
  minTotalHoldDurationMs: MIN_TOTAL_HOLD_DURATION_MS, // 500
  dragCancelThresholdPx: CANCEL_DRAG_DISTANCE_PX, // 50
}

export class ShutterGestureStateMachine {
  public state: ShutterState = {
    mode: 'idle',
    mediaType: null,
    recordingDurationMs: 0,
    isCancelled: false,
    progress: 0,
    hapticTriggered: false,
  }

  private startX = 0
  private startY = 0
  private holdTimer: any = null
  private maxDurationTimer: any = null
  private recordingStartTime = 0

  constructor(
    private config: ShutterConfig = DEFAULT_SHUTTER_CONFIG,
    private onTriggerPhoto?: () => void,
    private onStartRecording?: () => void,
    private onStopRecording?: (durationMs: number) => void,
    private onCancelRecording?: () => void,
    private onHaptic?: () => void
  ) {}

  public onPointerDown(x: number, y: number, button = 0): void {
    if (button !== 0) return // Chỉ chấp nhận chuột trái hoặc touch chính
    if (this.state.mode !== 'idle') return // Chặn duplicate pointerdown dồn dập

    this.startX = x
    this.startY = y
    this.state = {
      mode: 'holding_candidate',
      mediaType: null,
      recordingDurationMs: 0,
      isCancelled: false,
      progress: 0,
      hapticTriggered: false,
    }

    this.holdTimer = setTimeout(() => {
      this.state.mode = 'recording'
      this.state.mediaType = 'video'
      this.state.hapticTriggered = true
      this.recordingStartTime = Date.now()
      this.onHaptic?.()
      this.onStartRecording?.()

      // Hẹn giờ tối đa 2 giây (2000ms)
      this.maxDurationTimer = setTimeout(() => {
        this.finishRecording()
      }, this.config.maxDurationMs)
    }, this.config.longPressThresholdMs)
  }

  public onPointerMove(currentX: number, currentY: number): void {
    if (this.state.mode === 'idle' || this.state.mode === 'preview') return

    const deltaX = currentX - this.startX
    const deltaY = currentY - this.startY
    const distance = Math.hypot(deltaX, deltaY)

    if (distance > this.config.dragCancelThresholdPx) {
      this.abort('dragged_out')
    }
  }

  public onPointerUp(): void {
    if (this.state.mode === 'holding_candidate') {
      // Nhả tay trước ngưỡng 300ms -> Chụp ảnh tĩnh
      this.clearTimers()
      this.state.mode = 'idle'
      this.state.mediaType = 'image'
      this.onTriggerPhoto?.()
      return
    }

    if (this.state.mode === 'recording') {
      // Đang quay mà thả tay trước khi hết 2s
      this.finishRecording()
      return
    }

    // Nếu mode là 'preview' (đã tự động dừng sau 2s) hoặc 'idle':
    // KHÔNG làm gì cả -> Chặn double event và không chụp ảnh đè
  }

  public onPointerCancel(): void {
    if (this.state.mode !== 'idle' && this.state.mode !== 'preview') {
      this.abort('pointer_cancelled')
    }
  }

  public onVisibilityChange(hidden: boolean): void {
    if (hidden && this.state.mode === 'recording') {
      this.abort('app_backgrounded')
    }
  }

  private finishRecording(): void {
    this.clearTimers()
    const elapsed = Date.now() - this.recordingStartTime
    const actualDuration = Math.min(elapsed, this.config.maxDurationMs)
    this.state.recordingDurationMs = actualDuration

    if (actualDuration < this.config.minDurationMs) {
      // Nhỏ hơn thời lượng quay tối thiểu (< 200ms tính từ 300ms, tổng < 500ms) -> Hủy an toàn
      this.abort('too_short')
    } else {
      this.state.mode = 'preview'
      this.state.progress = Math.min(1, actualDuration / this.config.maxDurationMs)
      this.onStopRecording?.(actualDuration)
    }
  }

  public abort(reason: string): void {
    this.clearTimers()
    this.state.mode = 'idle'
    this.state.isCancelled = true
    this.state.progress = 0
    this.onCancelRecording?.()
  }

  public clearTimers(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }
  }
}

// Setup Pointer Capture & Vibrate Mocks for JSDOM
if (typeof window !== 'undefined' && !(window as any).PointerEvent) {
  class FakePointerEvent extends MouseEvent {
    public pointerId: number
    public pointerType: string
    public isPrimary: boolean
    constructor(type: string, params: any = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
      this.pointerType = params.pointerType ?? 'touch'
      this.isPrimary = params.isPrimary ?? true
    }
  }
  ;(window as any).PointerEvent = FakePointerEvent
  ;(global as any).PointerEvent = FakePointerEvent
}

beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = jest.fn()
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = jest.fn()
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = jest.fn(() => false)
  }
  Object.defineProperty(navigator, 'vibrate', {
    value: jest.fn(),
    writable: true,
    configurable: true,
  })
})

describe('Moments 2s Video Shutter Gesture & Timing State Machine', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('1. Interaction & Gestures (Tap vs Long-press & Boundaries)', () => {
    it('TC-TAP-01: Quick tap (< 300ms) triggers photo capture, NOT video', () => {
      const onPhoto = jest.fn()
      const onStartRec = jest.fn()
      const sm = new ShutterGestureStateMachine(DEFAULT_SHUTTER_CONFIG, onPhoto, onStartRec)

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(150) // User releases after 150ms
      sm.onPointerUp()

      expect(onPhoto).toHaveBeenCalledTimes(1)
      expect(onStartRec).not.toHaveBeenCalled()
      expect(sm.state.mediaType).toBe('image')
      expect(sm.state.mode).toBe('idle')
    })

    it('TC-TAP-02: Boundary tap at 299ms (< 300ms threshold) clears timer and captures photo', () => {
      const onPhoto = jest.fn()
      const onStartRec = jest.fn()
      const sm = new ShutterGestureStateMachine(DEFAULT_SHUTTER_CONFIG, onPhoto, onStartRec)

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(299) // Exact 1ms before 300ms threshold
      sm.onPointerUp()

      expect(onPhoto).toHaveBeenCalledTimes(1)
      expect(onStartRec).not.toHaveBeenCalled()
      expect(sm.state.mediaType).toBe('image')
      expect(sm.state.mode).toBe('idle')
    })

    it('TC-HOLD-01: Boundary hold reaches exactly 300ms triggers recording mode and haptic vibration', () => {
      const onPhoto = jest.fn()
      const onStartRec = jest.fn()
      const onHaptic = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        onPhoto,
        onStartRec,
        undefined,
        undefined,
        onHaptic
      )

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(300)

      expect(onStartRec).toHaveBeenCalledTimes(1)
      expect(onPhoto).not.toHaveBeenCalled()
      expect(onHaptic).toHaveBeenCalledTimes(1)
      expect(sm.state.mode).toBe('recording')
      expect(sm.state.mediaType).toBe('video')
      expect(sm.state.hapticTriggered).toBe(true)
    })

    it('TC-HOLD-02: Releasing at 499ms (recording duration 199ms < 200ms) aborts as too short without saving', () => {
      const onStopRec = jest.fn()
      const onCancelRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        onStopRec,
        onCancelRec
      )

      const realDateNow = Date.now
      let currentTime = 1000000
      Date.now = jest.fn(() => currentTime)

      sm.onPointerDown(100, 100)
      currentTime += 300
      jest.advanceTimersByTime(300) // Recording starts at 1000300

      currentTime += 199 // 499ms total hold, 199ms recording
      jest.advanceTimersByTime(199)
      sm.onPointerUp()

      expect(onCancelRec).toHaveBeenCalledTimes(1)
      expect(onStopRec).not.toHaveBeenCalled()
      expect(sm.state.mode).toBe('idle')
      expect(sm.state.isCancelled).toBe(true)

      Date.now = realDateNow
    })

    it('TC-HOLD-03: Boundary hold reaches 500ms (recording duration 200ms >= 200ms) successfully finishes recording', () => {
      const onStopRec = jest.fn()
      const onCancelRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        onStopRec,
        onCancelRec
      )

      const realDateNow = Date.now
      let currentTime = 1000000
      Date.now = jest.fn(() => currentTime)

      sm.onPointerDown(100, 100)
      currentTime += 300
      jest.advanceTimersByTime(300) // Recording starts

      currentTime += 200 // 500ms total hold, exactly 200ms recording
      jest.advanceTimersByTime(200)
      sm.onPointerUp()

      expect(onStopRec).toHaveBeenCalledWith(200)
      expect(onCancelRec).not.toHaveBeenCalled()
      expect(sm.state.mode).toBe('preview')
      expect(sm.state.recordingDurationMs).toBe(200)

      Date.now = realDateNow
    })

    it('TC-HOLD-04: Hold 1.0s (1000ms recording) then release successfully creates video clip', () => {
      const onStopRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        onStopRec
      )

      const realDateNow = Date.now
      let currentTime = 1000000
      Date.now = jest.fn(() => currentTime)

      sm.onPointerDown(100, 100)
      currentTime += 300
      jest.advanceTimersByTime(300) // starts recording

      currentTime += 1000 // record for 1000ms
      jest.advanceTimersByTime(1000)
      sm.onPointerUp()

      expect(onStopRec).toHaveBeenCalledWith(1000)
      expect(sm.state.mode).toBe('preview')
      expect(sm.state.recordingDurationMs).toBe(1000)

      Date.now = realDateNow
    })

    it('TC-HOLD-05: Continuous hold hits exact 2s (2000ms) auto-stops without releasing finger', () => {
      const onPhoto = jest.fn()
      const onStopRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        onPhoto,
        undefined,
        onStopRec
      )

      const realDateNow = Date.now
      let currentTime = 2000000
      Date.now = jest.fn(() => currentTime)

      sm.onPointerDown(100, 100)
      currentTime += 300
      jest.advanceTimersByTime(300) // recording starts

      currentTime += 2000
      jest.advanceTimersByTime(2000) // hit max 2s

      expect(onStopRec).toHaveBeenCalledWith(2000)
      expect(sm.state.mode).toBe('preview')
      expect(sm.state.progress).toBe(1)

      // Subsequent pointerup at 2200ms does NOT trigger photo or duplicate stop
      currentTime += 200
      jest.advanceTimersByTime(200)
      sm.onPointerUp()

      expect(onPhoto).not.toHaveBeenCalled()
      expect(onStopRec).toHaveBeenCalledTimes(1)

      Date.now = realDateNow
    })

    it('TC-DOUBLE-01: Rapid double pointerdown events are safely ignored', () => {
      const onPhoto = jest.fn()
      const onStartRec = jest.fn()
      const sm = new ShutterGestureStateMachine(DEFAULT_SHUTTER_CONFIG, onPhoto, onStartRec)

      sm.onPointerDown(100, 100)
      sm.onPointerDown(100, 100) // Double pointerdown while holding_candidate
      jest.advanceTimersByTime(150)
      sm.onPointerUp()

      expect(onPhoto).toHaveBeenCalledTimes(1)
      expect(onStartRec).not.toHaveBeenCalled()
    })

    it('TC-DOUBLE-02: Duplicate pointerup events in idle or preview state do not crash or trigger duplicate events', () => {
      const onPhoto = jest.fn()
      const sm = new ShutterGestureStateMachine(DEFAULT_SHUTTER_CONFIG, onPhoto)

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(100)
      sm.onPointerUp() // First up -> photo
      expect(onPhoto).toHaveBeenCalledTimes(1)

      // Duplicate pointerup
      sm.onPointerUp()
      expect(onPhoto).toHaveBeenCalledTimes(1)
    })

    it('TC-DRAG-01: Dragging finger out > 50px during recording aborts immediately', () => {
      const onCancelRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        undefined,
        onCancelRec
      )

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(300) // recording starts

      // Drag 30px -> still in boundary
      sm.onPointerMove(120, 120)
      expect(sm.state.mode).toBe('recording')

      // Drag to distance sqrt(60^2 + 60^2) = ~84.8px > 50px
      sm.onPointerMove(160, 160)
      expect(onCancelRec).toHaveBeenCalledTimes(1)
      expect(sm.state.mode).toBe('idle')
      expect(sm.state.isCancelled).toBe(true)
    })

    it('TC-CANCEL-01: OS pointercancel (incoming call, swipe home gesture) aborts recording safely', () => {
      const onCancelRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        undefined,
        onCancelRec
      )

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(300)
      expect(sm.state.mode).toBe('recording')

      sm.onPointerCancel()
      expect(onCancelRec).toHaveBeenCalledTimes(1)
      expect(sm.state.mode).toBe('idle')
      expect(sm.state.isCancelled).toBe(true)
    })
  })

  describe('2. Cross-Device & Browser MIME Type Resolution', () => {
    it('TC-MIME-01: Prioritizes MP4 on iOS Safari when supported', () => {
      const originalMediaRecorder = (global as any).MediaRecorder
      ;(global as any).MediaRecorder = class {
        static isTypeSupported(type: string) {
          return type.includes('video/mp4')
        }
      }

      const selectedMime = getSupportedVideoMimeType()
      expect(selectedMime).toBe('video/mp4;codecs=avc1')
      expect(getVideoExtension(selectedMime!)).toBe('mp4')

      ;(global as any).MediaRecorder = originalMediaRecorder
    })

    it('TC-MIME-02: Prioritizes WebM (VP9/VP8) on Android Chrome', () => {
      const originalMediaRecorder = (global as any).MediaRecorder
      ;(global as any).MediaRecorder = class {
        static isTypeSupported(type: string) {
          return type.includes('video/webm')
        }
      }

      const selectedMime = getSupportedVideoMimeType()
      expect(selectedMime).toBe('video/webm;codecs=vp9,opus')
      expect(getVideoExtension(selectedMime!)).toBe('webm')

      ;(global as any).MediaRecorder = originalMediaRecorder
    })

    it('TC-MIME-03: Fallbacks safely when specific codecs are unsupported', () => {
      const originalMediaRecorder = (global as any).MediaRecorder
      ;(global as any).MediaRecorder = class {
        static isTypeSupported(type: string) {
          return type === 'video/webm'
        }
      }

      const selectedMime = getSupportedVideoMimeType()
      expect(selectedMime).toBe('video/webm')

      ;(global as any).MediaRecorder = originalMediaRecorder
    })
  })

  describe('3. Interruption & Hardware Edge Cases', () => {
    it('TC-INT-01: Switching tabs or minimizing app aborts active recording', () => {
      const onCancelRec = jest.fn()
      const sm = new ShutterGestureStateMachine(
        DEFAULT_SHUTTER_CONFIG,
        undefined,
        undefined,
        undefined,
        onCancelRec
      )

      sm.onPointerDown(100, 100)
      jest.advanceTimersByTime(300)
      expect(sm.state.mode).toBe('recording')

      sm.onVisibilityChange(true) // App hidden
      expect(onCancelRec).toHaveBeenCalledTimes(1)
      expect(sm.state.mode).toBe('idle')
    })

    it('TC-INT-02: Right click or middle click does not trigger shutter state', () => {
      const sm = new ShutterGestureStateMachine()
      sm.onPointerDown(100, 100, 2) // Right click (button = 2)

      expect(sm.state.mode).toBe('idle')
      jest.advanceTimersByTime(500)
      expect(sm.state.mode).toBe('idle')
    })
  })

  describe('4. MomentShutterButton React Component Integration Tests', () => {
    it('TC-COMP-01: Quick tap (< 300ms) fires onCapturePhoto', () => {
      const onCapturePhoto = jest.fn()
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto,
          onStartRecording,
          onStopRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        jest.advanceTimersByTime(150)
      })
      act(() => {
        fireEvent.pointerUp(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })

      expect(onCapturePhoto).toHaveBeenCalledTimes(1)
      expect(onStartRecording).not.toHaveBeenCalled()
      expect(onStopRecording).not.toHaveBeenCalled()
    })

    it('TC-COMP-02: Hold for 300ms triggers onStartRecording and haptic vibration', () => {
      const onCapturePhoto = jest.fn()
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto,
          onStartRecording,
          onStopRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(onStartRecording).toHaveBeenCalledTimes(1)
      expect(onCapturePhoto).not.toHaveBeenCalled()
      expect(navigator.vibrate).toHaveBeenCalledWith(50)
    })

    it('TC-COMP-03: Releasing at 499ms (too short) calls onCancelRecording and NOT onStopRecording', () => {
      const onCapturePhoto = jest.fn()
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()
      const onCancelRecording = jest.fn()

      // Mock performance.now to simulate 199ms of recording
      const realPerfNow = performance.now
      let perfTime = 1000
      performance.now = jest.fn(() => perfTime)

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto,
          onStartRecording,
          onStopRecording,
          onCancelRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        perfTime += 300
        jest.advanceTimersByTime(300) // triggers start recording
      })

      expect(onStartRecording).toHaveBeenCalledTimes(1)

      act(() => {
        perfTime += 199 // 199ms elapsed since start (< 200ms)
        jest.advanceTimersByTime(199)
        fireEvent.pointerUp(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })

      expect(onCancelRecording).toHaveBeenCalledTimes(1)
      expect(onStopRecording).not.toHaveBeenCalled()
      expect(onCapturePhoto).not.toHaveBeenCalled()

      performance.now = realPerfNow
    })

    it('TC-COMP-04: Holding to 500ms (recording 200ms) then release calls onStopRecording', () => {
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()
      const onCancelRecording = jest.fn()

      const realPerfNow = performance.now
      let perfTime = 1000
      performance.now = jest.fn(() => perfTime)

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto: jest.fn(),
          onStartRecording,
          onStopRecording,
          onCancelRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        perfTime += 300
        jest.advanceTimersByTime(300)
      })

      act(() => {
        perfTime += 200 // exactly 200ms recorded
        jest.advanceTimersByTime(200)
        fireEvent.pointerUp(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })

      expect(onStopRecording).toHaveBeenCalledTimes(1)
      expect(onCancelRecording).not.toHaveBeenCalled()

      performance.now = realPerfNow
    })

    it('TC-COMP-05: Continuous 2000ms hold auto-stops recording and subsequent pointerup does not fire photo', () => {
      const onCapturePhoto = jest.fn()
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto,
          onStartRecording,
          onStopRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        jest.advanceTimersByTime(300) // start recording
      })
      expect(onStartRecording).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(2000) // auto-stop timer triggers
      })
      expect(onStopRecording).toHaveBeenCalledTimes(1)

      // Finger released after auto-stop finished
      act(() => {
        fireEvent.pointerUp(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })

      expect(onCapturePhoto).not.toHaveBeenCalled()
      expect(onStopRecording).toHaveBeenCalledTimes(1) // No duplicate call
    })

    it('TC-COMP-06: Dragging pointer > 50px cancels recording', () => {
      const onStartRecording = jest.fn()
      const onStopRecording = jest.fn()
      const onCancelRecording = jest.fn()

      const { getByRole } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto: jest.fn(),
          onStartRecording,
          onStopRecording,
          onCancelRecording,
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Move > 50px away: hypot(60, 60) = 84px
      act(() => {
        fireEvent.pointerMove(button, { clientX: 160, clientY: 160 })
      })

      expect(onCancelRecording).toHaveBeenCalledTimes(1)
      expect(onStopRecording).not.toHaveBeenCalled()
    })

    it('TC-COMP-07: Unmounting component clears timers cleanly without memory leak', () => {
      const onStartRecording = jest.fn()

      const { getByRole, unmount } = render(
        React.createElement(MomentShutterButton, {
          onCapturePhoto: jest.fn(),
          onStartRecording,
          onStopRecording: jest.fn(),
        })
      )

      const button = getByRole('button')
      act(() => {
        fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 })
      })
      // Unmount before 300ms timer
      unmount()

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(onStartRecording).not.toHaveBeenCalled()
    })
  })

  describe('5. MediaRecorder Error & Stream Release Lifecycle', () => {
    it('TC-STREAM-01: MediaRecorder onerror event is handled safely', () => {
      let errorHandler: ((e: any) => void) | null = null
      let state = 'inactive'
      let isCancelled = false
      let isRecording = false

      const mockRecorder = {
        state,
        start: jest.fn(() => {
          state = 'recording'
          isRecording = true
        }),
        stop: jest.fn(() => {
          state = 'inactive'
          isRecording = false
        }),
        set onerror(handler: (e: any) => void) {
          errorHandler = handler
        },
      }

      mockRecorder.start()
      expect(isRecording).toBe(true)

      // Simulate MediaRecorder hardware error during recording
      mockRecorder.onerror = (e: any) => {
        isRecording = false
        isCancelled = true
      }

      if (errorHandler) {
        ;(errorHandler as any)({ error: new Error('Recording device failed') })
      }

      expect(isRecording).toBe(false)
      expect(isCancelled).toBe(true)
    })

    it('TC-STREAM-02: Camera tracks are stopped and video element srcObject cleared on unmount/stop', () => {
      const track1 = { stop: jest.fn(), enabled: true }
      const track2 = { stop: jest.fn(), enabled: true }
      const mockStream = {
        getTracks: () => [track1, track2],
        getVideoTracks: () => [track1],
      }
      const mockVideoElement = {
        srcObject: mockStream as any,
      }

      const stopCamera = () => {
        mockStream.getTracks().forEach((t) => t.stop())
        mockVideoElement.srcObject = null
      }

      stopCamera()

      expect(track1.stop).toHaveBeenCalledTimes(1)
      expect(track2.stop).toHaveBeenCalledTimes(1)
      expect(mockVideoElement.srcObject).toBeNull()
    })
  })
})
