"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Truck,
  Building2,
  Store,
  Menu,
  X,
  Users,
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"

const navItems = [
  
  { href: "/ventas", label: "Punto de Venta", icon: ShoppingCart, rol: "todos" as const },
  { href: "/compras", label: "Compras", icon: Truck, rol: "admin" as const },
  { href: "/productos", label: "Productos", icon: Package, rol: "admin" as const },
  { href: "/proveedores", label: "Proveedores", icon: Building2, rol: "admin" as const },
  { href: "/reportes", label: "Reportes", icon: BarChart3, rol: "admin" as const },
  { href: "/usuarios", label: "Usuarios", icon: Users, rol: "admin" as const },
  { href: "/", label: "Administracion", icon: LayoutDashboard, rol: "admin" as const },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  const [dialogCerrarSesionAbierto, setDialogCerrarSesionAbierto] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const { user, logout } = useAuth()

  const itemsFiltrados = navItems.filter((item) => item.rol === "todos" || user?.rol === "admin")

  function abrirConfirmacionLogout() {
    setAbierto(false)
    setDialogCerrarSesionAbierto(true)
  }

  async function confirmarLogout() {
    setCerrandoSesion(true)

    // Fuerza salida inmediata sin prompts de navegacion pendientes.
    if (typeof window !== "undefined") {
      window.onbeforeunload = null
    }

    try {
      await logout()
    } catch {
      // Incluso si falla la llamada de logout, cerramos sesion del lado cliente y redirigimos.
    }

    if (typeof window !== "undefined") {
      window.location.replace("/login?logout=1")
    }

    setCerrandoSesion(false)
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Store className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-sidebar-foreground">SADAPOS</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Badge variant="outline" className="border-sidebar-border text-xs text-sidebar-foreground/70">
              {user.nombre}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setAbierto(!abierto)}
            aria-label={abierto ? "Cerrar menu" : "Abrir menu"}
          >
            {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setAbierto(false)} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200",
          "hidden md:flex md:w-56 lg:w-64",
          abierto && "fixed inset-y-0 left-0 z-50 flex w-64 shadow-xl md:relative md:shadow-none"
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Store className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">SADAPOS</h1>
            <p className="text-xs text-sidebar-foreground/60">Sistema de gestion</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {itemsFiltrados.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {user && (
          <div className="border-t border-sidebar-border px-3 py-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                <User className="h-4 w-4 text-sidebar-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{user.nombre}</p>
                <p className="text-xs capitalize text-sidebar-foreground/50">
                  {user.rol === "admin" ? "Administrador" : "Empleado"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-1 w-full justify-start gap-3 px-3 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              onClick={abrirConfirmacionLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesion
            </Button>
          </div>
        )}
      </aside>

      <Dialog
        open={dialogCerrarSesionAbierto}
        onOpenChange={(open) => {
          if (!cerrandoSesion) {
            setDialogCerrarSesionAbierto(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar sesion</DialogTitle>
            <DialogDescription>Estas seguro que quieres cerrar sesion?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogCerrarSesionAbierto(false)}
              disabled={cerrandoSesion}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarLogout} disabled={cerrandoSesion}>
              {cerrandoSesion ? "Cerrando..." : "Si, cerrar sesion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
