"use client"

import { Package, ShoppingCart, AlertTriangle, DollarSign, TrendingUp, CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatsCardsProps {
  totalProductos: number
  ventasHoy: number
  ingresoHoy: number
  gananciaHoy: number
  alertasStock: number
  alertasVencimiento: number
}

function formatPrecio(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value ?? 0)
}

export function StatsCards({
  totalProductos,
  ventasHoy,
  ingresoHoy,
  gananciaHoy,
  alertasStock,
  alertasVencimiento,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{totalProductos}</div>
          <p className="text-xs text-muted-foreground">en catalogo</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Hoy</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{ventasHoy}</div>
          <p className="text-xs text-muted-foreground">transacciones</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ingreso Hoy</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatPrecio(ingresoHoy)}</div>
          <p className="text-xs text-muted-foreground">recaudado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia Hoy</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">{formatPrecio(gananciaHoy)}</div>
          <p className="text-xs text-muted-foreground">neto</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Stock Bajo</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${alertasStock > 0 ? "text-destructive" : "text-muted-foreground"}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${alertasStock > 0 ? "text-destructive" : "text-foreground"}`}>
            {alertasStock}
          </div>
          <p className="text-xs text-muted-foreground">productos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Por Vencer</CardTitle>
          <CalendarDays
            className={`h-4 w-4 ${alertasVencimiento > 0 ? "text-warning-foreground" : "text-muted-foreground"}`}
          />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${alertasVencimiento > 0 ? "text-warning-foreground" : "text-foreground"}`}>
            {alertasVencimiento}
          </div>
          <p className="text-xs text-muted-foreground">en 30 dias</p>
        </CardContent>
      </Card>
    </div>
  )
}