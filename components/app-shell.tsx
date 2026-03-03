"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"

// Rutas que el empleado puede ver
const RUTAS_EMPLEADO = ["/ventas", "/compras"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && user.rol === "empleado") {
      const permitida = RUTAS_EMPLEADO.some((r) => pathname.startsWith(r))
      if (!permitida) {
        router.push("/ventas")
      }
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando SADAPOS...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-dvh flex-col md:flex-row md:overflow-hidden">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
