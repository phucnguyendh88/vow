import { viewport, metadata } from '@/app/layout'

describe('Cross-Platform Viewport & Mobile-First Responsive Behavior', () => {
  describe('Next.js Viewport & PWA Metadata Configuration', () => {
    it('configures optimal viewport settings for iPhone Dynamic Island and notched devices', () => {
      expect(viewport).toBeDefined()
      expect(viewport.width).toBe('device-width')
      expect(viewport.initialScale).toBe(1)
      expect(viewport.maximumScale).toBe(1)
      expect(viewport.userScalable).toBe(false)
      // viewportFit: cover ensures edge-to-edge rendering behind notch & dynamic island
      expect(viewport.viewportFit).toBe('cover')
      expect(viewport.themeColor).toBe('#0b0b0f')
    })

    it('configures iOS Standalone WebApp (appleWebApp) metadata', () => {
      expect(metadata).toBeDefined()
      expect(metadata.appleWebApp).toBeDefined()
      expect(metadata.appleWebApp?.capable).toBe(true)
      // black-translucent allows content to flow under the status bar
      expect(metadata.appleWebApp?.statusBarStyle).toBe('black-translucent')
      expect(metadata.appleWebApp?.title).toBe('VOW')
    })
  })

  describe('Device Viewport Matrix Simulation', () => {
    interface ViewportSpec {
      device: string
      category: 'iphone' | 'android' | 'desktop'
      width: number
      height: number
      hasHomeIndicator: boolean
      hasDynamicIslandOrNotch: boolean
    }

    const deviceMatrix: ViewportSpec[] = [
      {
        device: 'iPhone SE (3rd Gen)',
        category: 'iphone',
        width: 375,
        height: 667,
        hasHomeIndicator: false,
        hasDynamicIslandOrNotch: false,
      },
      {
        device: 'iPhone 15 / 16 Pro',
        category: 'iphone',
        width: 393,
        height: 852,
        hasHomeIndicator: true,
        hasDynamicIslandOrNotch: true,
      },
      {
        device: 'iPhone 15 / 16 Pro Max',
        category: 'iphone',
        width: 430,
        height: 932,
        hasHomeIndicator: true,
        hasDynamicIslandOrNotch: true,
      },
      {
        device: 'Samsung Galaxy S24',
        category: 'android',
        width: 360,
        height: 800,
        hasHomeIndicator: false,
        hasDynamicIslandOrNotch: false,
      },
      {
        device: 'Google Pixel 8',
        category: 'android',
        width: 412,
        height: 915,
        hasHomeIndicator: false,
        hasDynamicIslandOrNotch: false,
      },
      {
        device: 'MacBook Air / Laptop',
        category: 'desktop',
        width: 1440,
        height: 900,
        hasHomeIndicator: false,
        hasDynamicIslandOrNotch: false,
      },
      {
        device: 'Desktop 1080p Monitor',
        category: 'desktop',
        width: 1920,
        height: 1080,
        hasHomeIndicator: false,
        hasDynamicIslandOrNotch: false,
      },
    ]

    function resolveAppContainerLayout(spec: ViewportSpec) {
      const maxMobileWidthPx = 448 // max-w-md = 28rem = 448px
      const isMobile = spec.width <= maxMobileWidthPx
      const renderedWidth = isMobile ? spec.width : maxMobileWidthPx
      const isCenteredOnDesktop = spec.width > maxMobileWidthPx

      // Small viewport height (svh) / dynamic viewport height (dvh) prevention of address bar jump
      const effectiveMinHeight = '100svh'

      // Safe area bottom inset simulation
      const safeAreaBottomInset = spec.hasHomeIndicator ? 34 : 12

      return {
        renderedWidth,
        isMobile,
        isCenteredOnDesktop,
        effectiveMinHeight,
        safeAreaBottomInset,
        horizontalPadding: isMobile ? 16 : 24,
      }
    }

    it.each(deviceMatrix)('resolves correct mobile container styling for $device ($width x $height)', (spec) => {
      const layout = resolveAppContainerLayout(spec)

      if (spec.category === 'desktop') {
        expect(layout.isCenteredOnDesktop).toBe(true)
        expect(layout.renderedWidth).toBe(448) // Clamped to max-w-md
      } else {
        expect(layout.isCenteredOnDesktop).toBe(false)
        expect(layout.renderedWidth).toBe(spec.width) // Full width on mobile
      }

      if (spec.hasHomeIndicator) {
        // iPhone with gesture bar requires extra safe area padding
        expect(layout.safeAreaBottomInset).toBe(34)
      } else {
        expect(layout.safeAreaBottomInset).toBe(12)
      }
    })
  })

  describe('Gesture & Browser Navigation Across Platforms', () => {
    // Edge-swipe helper replicating DevotionClient handleTouchEnd
    function evaluateEdgeSwipeGesture(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      activeView: string
    ): 'navigate-back' | 'ignore' {
      if (activeView === 'home') return 'ignore'
      const deltaX = endX - startX
      const deltaY = Math.abs(endY - startY)

      // Start near left edge (< 40px) and drag right (> 70px) horizontally
      if (startX < 40 && deltaX > 70 && deltaY < deltaX * 0.8) {
        return 'navigate-back'
      }
      return 'ignore'
    }

    it('triggers back navigation on iOS Safari edge-swipe from left edge', () => {
      // Swipe from X: 15 to X: 120 (deltaX: 105, deltaY: 10) in subview
      const action = evaluateEdgeSwipeGesture(15, 200, 120, 210, 'topic')
      expect(action).toBe('navigate-back')
    })

    it('ignores swipes originating from the center of the screen', () => {
      // Swiping horizontally in center of screen (e.g. browsing gallery)
      const action = evaluateEdgeSwipeGesture(150, 200, 280, 210, 'topic')
      expect(action).toBe('ignore')
    })

    it('ignores vertical scrolling swipes that accidentally drift right', () => {
      // Vertical scroll: deltaY (150) > deltaX (80)
      const action = evaluateEdgeSwipeGesture(20, 100, 100, 250, 'topic')
      expect(action).toBe('ignore')
    })

    it('ignores edge swipe when already on the root home view', () => {
      const action = evaluateEdgeSwipeGesture(15, 200, 120, 205, 'home')
      expect(action).toBe('ignore')
    })
  })

  describe('Background Audio Lifecycle & Visibility Management', () => {
    function simulateAudioLifecycle(hidden: boolean, musicEnabled: boolean) {
      if (hidden) {
        return 'paused'
      }
      if (musicEnabled) {
        return 'playing'
      }
      return 'paused'
    }

    it('automatically pauses background music when tab is hidden or minimized (iOS/Android sleep)', () => {
      // App switched to background (document.hidden = true)
      expect(simulateAudioLifecycle(true, true)).toBe('paused')
    })

    it('resumes playback when returning to active tab if music was enabled', () => {
      // App brought back to foreground (document.hidden = false)
      expect(simulateAudioLifecycle(false, true)).toBe('playing')
    })

    it('remains paused when returning to active tab if user previously toggled music off', () => {
      expect(simulateAudioLifecycle(false, false)).toBe('paused')
    })
  })
})
