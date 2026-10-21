'use client'

import React, { Component, type ReactNode } from 'react'
import Link from 'next/link'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Đã xảy ra sự cố hiển thị tin nhắn.'
      return (
        <div className="flex min-h-[calc(100dvh-6rem)] w-full flex-col items-center justify-center bg-[#050505] px-6 py-12 text-center text-[#F0F0F0]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 className="mt-4 font-serif text-2xl font-semibold text-[#E8D08D]">
            Không thể tải cuộc trò chuyện
          </h2>

          <p className="mt-2 max-w-sm text-xs leading-relaxed text-neutral-400 break-words font-mono bg-white/5 p-3 rounded-xl border border-white/10">
            {errorMsg}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-[#E8D08D] px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-[#E8D08D]/20 transition active:scale-95 cursor-pointer hover:brightness-105"
            >
              Thử lại
            </button>
            <Link
              href="/tin-nhan"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition active:scale-95 hover:bg-white/10"
            >
              Danh sách tin nhắn
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
