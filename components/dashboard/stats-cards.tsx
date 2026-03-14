"use client"

import { Package, ShoppingCart, AlertTriangle, DollarSign, TrendingUp, CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  const montoClassName = "text-base font-bold leading-tight text-foreground tabular-nums md:text-lg xl:text-xl"

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{totalProductos}</div>
          <p className="text-xs text-muted-foreground">en catalogo</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Patrimonio Stock</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`${montoClassName} whitespace-nowrap`}>{formatPrecio(patrimonioStock)}</div>
          <p className="text-xs text-muted-foreground">a costo</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Patrimonio Venta</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`${montoClassName} whitespace-nowrap`}>{formatPrecio(patrimonioVenta)}</div>
          <p className="text-xs text-muted-foreground">a precio de venta</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Hoy</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{ventasHoy}</div>
          <p className="text-xs text-muted-foreground">transacciones</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ingreso Hoy</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`${montoClassName} whitespace-nowrap`}>{formatPrecio(ingresoHoy)}</div>
          <p className="text-xs text-muted-foreground">recaudado</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia Hoy</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="whitespace-nowrap text-base font-bold leading-tight text-success tabular-nums md:text-lg xl:text-xl">
            {formatPrecio(gananciaHoy)}
          </div>
          <p className="text-xs text-muted-foreground">neto</p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
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

      <Card className="min-w-0">
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
