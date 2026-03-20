"use client"

import type { ComponentType } from "react"
import { AlertTriangle, CalendarDays, DollarSign, Package, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

interface StatsCardsProps {
  totalProductos: number
  patrimonioStock: number
  patrimonioVenta: number
  ventasHoy: number
  ingresoHoy: number
  gananciaHoy: number
  alertasStock: number
  alertasVencimiento: number
}

type StatItem = {
  label: string
  value: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  cardTone: string
  iconTone: string
  valueClassName?: string
  mono?: boolean
  pulse?: "warning" | "critical"
}

function formatPrecio(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value ?? 0)
}

export function StatsCards({
  totalProductos,
  patrimonioStock,
  patrimonioVenta,
  ventasHoy,
  ingresoHoy,
  gananciaHoy,
  alertasStock,
  alertasVencimiento,
}: StatsCardsProps) {
  const gananciaHoyNegativa = gananciaHoy < 0

  const stats: StatItem[] = [
    {
      label: "Productos",
      value: String(totalProductos),
      subtitle: "en catalogo",
      icon: Package,
      cardTone: "from-primary/18 via-primary/6 to-transparent border-primary/30",
      iconTone: "bg-primary/18 text-primary",
    },
    {
      label: "Patrimonio Stock",
      value: formatPrecio(patrimonioStock),
      subtitle: "a costo",
      icon: DollarSign,
      cardTone: "from-success/16 via-success/5 to-transparent border-success/26",
      iconTone: "bg-success/18 text-success",
      valueClassName: "text-success",
      mono: true,
    },
    {
      label: "Patrimonio Venta",
      value: formatPrecio(patrimonioVenta),
      subtitle: "a precio de venta",
      icon: DollarSign,
      cardTone: "from-success/22 via-success/7 to-transparent border-success/32",
      iconTone: "bg-success/20 text-success",
      valueClassName: "text-success",
      mono: true,
    },
    {
      label: "Ventas Hoy",
      value: String(ventasHoy),
      subtitle: "transacciones",
      icon: ShoppingCart,
      cardTone: "from-primary/18 via-primary/6 to-transparent border-primary/30",
      iconTone: "bg-primary/18 text-primary",
    },
    {
      label: "Ingreso Hoy",
      value: formatPrecio(ingresoHoy),
      subtitle: "recaudado",
      icon: DollarSign,
      cardTone: "from-success/20 via-success/6 to-transparent border-success/30",
      iconTone: "bg-success/20 text-success",
      valueClassName: "text-success",
      mono: true,
    },
    {
      label: "Ganancia Hoy",
      value: formatPrecio(gananciaHoy),
      subtitle: gananciaHoyNegativa ? "resultado negativo" : "neto",
      icon: gananciaHoyNegativa ? TrendingDown : TrendingUp,
      cardTone: gananciaHoyNegativa
        ? "from-destructive/22 via-destructive/8 to-transparent border-destructive/35"
        : "from-success/18 via-success/5 to-transparent border-success/30",
      iconTone: gananciaHoyNegativa ? "bg-destructive/22 text-destructive" : "bg-success/18 text-success",
      valueClassName: gananciaHoyNegativa ? "text-destructive" : "text-success",
      pulse: gananciaHoyNegativa ? "critical" : undefined,
      mono: true,
    },
    {
      label: "Stock Bajo",
      value: String(alertasStock),
      subtitle: "productos",
      icon: AlertTriangle,
      cardTone:
        alertasStock > 0
          ? "from-destructive/20 via-destructive/8 to-transparent border-destructive/34"
          : "from-muted/25 via-muted/8 to-transparent border-border/70",
      iconTone: alertasStock > 0 ? "bg-destructive/20 text-destructive" : "bg-muted/55 text-muted-foreground",
      valueClassName: alertasStock > 0 ? "text-destructive" : undefined,
      pulse: alertasStock > 0 ? "critical" : undefined,
    },
    {
      label: "Por Vencer",
      value: String(alertasVencimiento),
      subtitle: "en 30 dias",
      icon: CalendarDays,
      cardTone:
        alertasVencimiento > 0
          ? "from-warning/20 via-warning/8 to-transparent border-warning/36"
          : "from-muted/25 via-muted/8 to-transparent border-border/70",
      iconTone: alertasVencimiento > 0 ? "bg-warning/18 text-warning" : "bg-muted/55 text-muted-foreground",
      valueClassName: alertasVencimiento > 0 ? "text-warning" : undefined,
      pulse: alertasVencimiento > 0 ? "warning" : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className={cn(
            "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
            stat.cardTone,
            stat.pulse === "critical" && "alert-critical-blink",
            stat.pulse === "warning" && "alert-warning-pulse"
          )}
        >
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current opacity-[0.08]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
              <p
                className={cn(
                  "mt-2 truncate text-2xl font-bold tracking-tight text-foreground md:text-[1.7rem]",
                  stat.valueClassName,
                  stat.mono && "text-base tabular-nums md:text-lg xl:text-xl"
                )}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.subtitle}</p>
            </div>

            <div className={cn("rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-105", stat.iconTone)}>
              <stat.icon className="h-4.5 w-4.5" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
