"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/lib/auth-context"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  return <AppShell>{children}</AppShell>
}