"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { Rol } from "@/lib/mock-data"
import api from "@/lib/api"

interface AuthUser {
  id: number
  nombre: string
  rol: Rol
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (usuario: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    api
      .get("/api/auth")
      .then((res) => {
        if (cancelled) return
        const data = res.data
        setUser({ id: data.id, nombre: data.nombre, rol: data.rol })
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (usuario: string, password: string) => {
    try {
      const res = await api.post("/api/auth", { usuario, password })
      const data = res.data
      setUser({ id: data.id, nombre: data.nombre, rol: data.rol })
      return { ok: true }
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { data?: { error?: string; message?: string } }
        message?: string
      }
      const msg = apiErr.response?.data?.error || apiErr.response?.data?.message || apiErr.message || "Error al iniciar sesion"
      return { ok: false, error: msg }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.delete("/api/auth")
    } finally {
      setUser(null)
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

