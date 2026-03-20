"use client"

import { type ComponentType, useMemo, useState } from "react"
import useSWR from "swr"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { DollarSign, Download, ShoppingCart, TrendingDown, TrendingUp, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type MedioPago = "efectivo" | "debito" | "credito" | "transferencia"
type EstadoVenta = "activa" | "anulada"
type ReporteVista = "detalle" | "dia" | "usuario" | "medio"

type Usuario = {
  id: number
  nombre: string
  usuario: string
  rol: "admin" | "empleado"
  activo: boolean
}

type VentaItem = {
  id: number
  productoId: number
  nombre: string
  cantidad: number
}

type Venta = {
  id: number
  fecha: string
  total: number
  ganancia: number
  recargo: number
  medioPago: MedioPago
  estado: EstadoVenta
  items: VentaItem[]
}

type VentasPage = {
  items: Venta[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type BackupFile = {
  fileName: string
  sizeBytes: number
  lastModifiedAt: string
}

type BackupStatus = {
  enabled: boolean
  allowRestore: boolean
}

type ReporteVentaPorDia = {
  fecha: string
  cantidadVentas: number
  totalVendido: number
  totalCosto: number
  totalGanancia: number
  margenPorcentaje: number
}

type ReporteVentaPorUsuario = {
  usuarioId: number | null
  usuarioNombre: string | null
  cantidadVentas: number
  totalVendido: number
  totalCosto: number
  totalGanancia: number
  margenPorcentaje: number
}

type ReporteVentaPorMedio = {
  medioPago: MedioPago
  cantidadVentas: number
  totalVendido: number
  totalCosto: number
  totalGanancia: number
  margenPorcentaje: number
}

type ReporteVentaDetalle = {
  fecha: string
  usuarioId: number | null
  usuarioNombre: string | null
  medioPago: MedioPago
  cantidadVentas: number
  totalVendido: number
  totalCosto: number
  totalGanancia: number
  margenPorcentaje: number
}

type ReporteVentasResponse = {
  cantidadVentas: number
  totalVendido: number
  totalCosto: number
  totalGanancia: number
  margenPorcentaje: number
  porDia: ReporteVentaPorDia[]
  porUsuario: ReporteVentaPorUsuario[]
  porMedioPago: ReporteVentaPorMedio[]
  detalle: ReporteVentaDetalle[]
}

type ResumenCard = {
  key: string
  label: string
  value: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  cardTone: string
  iconTone: string
  valueClassName?: string
  pulse?: "critical" | "warning"
}

const fetcher = <T,>(url: string) => api.get<T>(url).then((r) => r.data)

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n || 0)
}

function classGanancia(value: number) {
  if (value < 0) return "text-destructive"
  if (value === 0) return "text-muted-foreground"
  return "text-success"
}

function formatFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(2)} ${units[i]}`
}

function getErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message || fallback
}

function extraerNombreArchivo(contentDisposition: string | null | undefined, fallback: string) {
  if (!contentDisposition) return fallback

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, "").trim())
    } catch {
      return utf8Match[1].replace(/["']/g, "").trim()
    }
  }

  const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return filenameMatch?.[1]?.trim() || fallback
}

function descargarArchivo(blob: Blob, fileName: string) {
  const a = document.createElement("a")
  const objectUrl = window.URL.createObjectURL(blob)
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export default function ReportesPanel() {
  const { user } = useAuth()
  const esAdmin = user?.rol === "admin"

  const [filtroCajaId, setFiltroCajaId] = useState("")
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("")
  const [filtroMedioPago, setFiltroMedioPago] = useState<"" | MedioPago>("")
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("")
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("")
  const [vistaExport, setVistaExport] = useState<ReporteVista>("detalle")
  const [exportandoReporte, setExportandoReporte] = useState(false)

  const [dialogAnularAbierto, setDialogAnularAbierto] = useState(false)
  const [ventaAAnular, setVentaAAnular] = useState<Venta | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState("")
  const [anulandoVenta, setAnulandoVenta] = useState(false)

  const [restoreDialogAbierto, setRestoreDialogAbierto] = useState(false)
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([])
  const [backupSeleccionado, setBackupSeleccionado] = useState("")
  const [motivoRestore, setMotivoRestore] = useState("")
  const [cargandoBackups, setCargandoBackups] = useState(false)
  const [guardandoBackup, setGuardandoBackup] = useState(false)

  const fechasInvalidas =
    Boolean(filtroFechaDesde) && Boolean(filtroFechaHasta) && filtroFechaDesde > filtroFechaHasta

  const filtrosQuery = useMemo(() => {
    const params = new URLSearchParams()
    const cajaId = filtroCajaId.trim()
    const usuarioId = filtroUsuarioId.trim()

    if (cajaId) params.set("cajaId", cajaId)
    if (esAdmin && usuarioId) params.set("usuarioId", usuarioId)
    if (filtroMedioPago) params.set("medioPago", filtroMedioPago)
    if (filtroFechaDesde) params.set("fechaDesde", filtroFechaDesde)
    if (filtroFechaHasta) params.set("fechaHasta", filtroFechaHasta)

    return params
  }, [filtroCajaId, esAdmin, filtroUsuarioId, filtroMedioPago, filtroFechaDesde, filtroFechaHasta])

  const reporteUrl = useMemo(() => {
    const query = filtrosQuery.toString()
    return query ? `/api/reportes/ventas?${query}` : "/api/reportes/ventas"
  }, [filtrosQuery])

  const ventasUrl = useMemo(() => {
    const params = new URLSearchParams(filtrosQuery)
    params.set("page", "0")
    params.set("size", "200")
    params.set("sortBy", "fecha")
    params.set("sortDir", "desc")
    return `/api/ventas/paginado?${params.toString()}`
  }, [filtrosQuery])
  const {
    data: usuarios = [],
    isLoading: loadingUsuarios,
    error: errorUsuarios,
  } = useSWR<Usuario[]>(esAdmin ? "/api/usuarios" : null, fetcher)

  const {
    data: backupStatus,
    isLoading: loadingBackupStatus,
    error: errorBackupStatus,
  } = useSWR<BackupStatus>(esAdmin ? "/api/admin/backups/status" : null, fetcher)

  const {
    data: reporte,
    isLoading: loadingReporte,
    error: errorReporte,
    mutate: mutateReporte,
  } = useSWR<ReporteVentasResponse>(fechasInvalidas ? null : reporteUrl, fetcher)

  const {
    data: ventasPage,
    isLoading: loadingVentas,
    error: errorVentas,
    mutate: mutateVentas,
  } = useSWR<VentasPage>(fechasInvalidas ? null : ventasUrl, fetcher)

  const ventas = ventasPage?.items ?? []

  const backupEnabled = backupStatus?.enabled === true
  const restoreEnabled = backupStatus?.allowRestore === true

  const loading = !fechasInvalidas && (loadingReporte || loadingVentas || (esAdmin && (loadingUsuarios || loadingBackupStatus)))
  const error = !fechasInvalidas && (errorReporte || errorVentas || (esAdmin ? (errorUsuarios || errorBackupStatus) : null))

  const cantidadVentas = toNumber(reporte?.cantidadVentas)
  const totalVendido = toNumber(reporte?.totalVendido)
  const totalCosto = toNumber(reporte?.totalCosto)
  const totalGanancia = toNumber(reporte?.totalGanancia)
  const margen = toNumber(reporte?.margenPorcentaje)
  const ticketPromedio = cantidadVentas > 0 ? totalVendido / cantidadVentas : 0
  const gananciaNegativa = totalGanancia < 0
  const margenCritico = cantidadVentas > 0 && margen < 0
  const margenBajo = cantidadVentas > 0 && margen >= 0 && margen < 20
  const resumenCards: ResumenCard[] = [
    {
      key: "total-vendido",
      label: "Total vendido",
      value: formatPrecio(totalVendido),
      subtitle: `${cantidadVentas} ${cantidadVentas === 1 ? "venta" : "ventas"}`,
      icon: DollarSign,
      cardTone: "from-success/20 via-success/7 to-transparent border-success/32",
      iconTone: "bg-success/20 text-success",
      valueClassName: "text-success",
    },
    {
      key: "total-costo",
      label: "Total costo",
      value: formatPrecio(totalCosto),
      subtitle: "acumulado del periodo",
      icon: DollarSign,
      cardTone: "from-warning/20 via-warning/8 to-transparent border-warning/34",
      iconTone: "bg-warning/18 text-warning",
      valueClassName: "text-warning",
    },
    {
      key: "ganancia-neta",
      label: "Ganancia neta",
      value: formatPrecio(totalGanancia),
      subtitle: gananciaNegativa ? "perdida del periodo" : "resultado del periodo",
      icon: gananciaNegativa ? TrendingDown : TrendingUp,
      cardTone: gananciaNegativa
        ? "from-destructive/24 via-destructive/9 to-transparent border-destructive/36"
        : "from-success/18 via-success/5 to-transparent border-success/30",
      iconTone: gananciaNegativa ? "bg-destructive/22 text-destructive" : "bg-success/18 text-success",
      valueClassName: classGanancia(totalGanancia),
      pulse: gananciaNegativa ? "critical" : undefined,
    },
    {
      key: "ticket-promedio",
      label: "Ticket promedio",
      value: formatPrecio(ticketPromedio),
      subtitle: `${margenCritico ? "margen critico" : margenBajo ? "margen bajo" : "margen"} ${margen.toFixed(2)}%`,
      icon: ShoppingCart,
      cardTone: margenCritico
        ? "from-destructive/22 via-destructive/8 to-transparent border-destructive/35"
        : margenBajo
          ? "from-warning/20 via-warning/8 to-transparent border-warning/34"
          : "from-success/16 via-success/5 to-transparent border-success/28",
      iconTone: margenCritico
        ? "bg-destructive/20 text-destructive"
        : margenBajo
          ? "bg-warning/18 text-warning"
          : "bg-success/18 text-success",
      valueClassName: margenCritico ? "text-destructive" : margenBajo ? "text-warning" : "text-success",
      pulse: margenCritico ? "critical" : margenBajo ? "warning" : undefined,
    },
  ]

  function limpiarFiltros() {
    setFiltroCajaId("")
    setFiltroUsuarioId("")
    setFiltroMedioPago("")
    setFiltroFechaDesde("")
    setFiltroFechaHasta("")
  }

  function abrirDialogAnular(venta: Venta) {
    setVentaAAnular(venta)
    setMotivoAnulacion("")
    setDialogAnularAbierto(true)
  }

  async function confirmarAnulacion() {
    if (!ventaAAnular) {
      toast.error("Selecciona una venta")
      return
    }

    const motivo = motivoAnulacion.trim()
    if (!motivo) {
      toast.error("Ingresa un motivo de anulacion")
      return
    }

    setAnulandoVenta(true)
    try {
      await api.post(`/api/ventas/${ventaAAnular.id}/anular`, { motivo })
      toast.success(`Venta #${ventaAAnular.id} anulada`)
      setDialogAnularAbierto(false)
      setVentaAAnular(null)
      setMotivoAnulacion("")
      await Promise.all([mutateVentas(), mutateReporte()])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo anular la venta"))
    } finally {
      setAnulandoVenta(false)
    }
  }

  async function exportarReporteCsv() {
    if (fechasInvalidas) {
      toast.error("La fecha desde no puede ser mayor a la fecha hasta")
      return
    }

    setExportandoReporte(true)
    try {
      const params = new URLSearchParams(filtrosQuery)
      params.set("vista", vistaExport)
      const url = `/api/reportes/ventas/export?${params.toString()}`
      const res = await api.get(url, { responseType: "blob" })

      const contentDisposition = (res.headers?.["content-disposition"] as string | undefined) ?? null
      const fileName = extraerNombreArchivo(contentDisposition, `reporte_ventas_${vistaExport}.csv`)
      descargarArchivo(res.data as Blob, fileName)

      toast.success(`CSV exportado: ${fileName}`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo exportar el reporte"))
    } finally {
      setExportandoReporte(false)
    }
  }

  async function exportarBackup() {
    if (!backupEnabled) {
      toast.error("Backups deshabilitados por configuracion del backend")
      return
    }

    setGuardandoBackup(true)
    try {
      const run = await api.post("/api/admin/backups/run").then((r) => r.data as { fileName?: string; message?: string })
      const fileName = run?.fileName

      if (!fileName) {
        toast.success(run?.message || "Backup ejecutado")
        return
      }

      const baseURL = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin
      const url = `${baseURL}/api/admin/backups/download/${encodeURIComponent(fileName)}`
      const res = await fetch(url, { credentials: "include" })

      if (!res.ok) {
        throw new Error(`No se pudo descargar backup (${res.status})`)
      }

      descargarArchivo(await res.blob(), fileName)
      toast.success(`Backup generado: ${fileName}`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al generar backup"))
    } finally {
      setGuardandoBackup(false)
    }
  }

  async function importarBackup() {
    if (!backupEnabled) {
      toast.error("Backups deshabilitados por configuracion del backend")
      return
    }
    if (!restoreEnabled) {
      toast.error("Restore deshabilitado por configuracion del backend")
      return
    }

    setRestoreDialogAbierto(true)
    setCargandoBackups(true)
    try {
      const files = await api.get("/api/admin/backups/files").then((r) => r.data as BackupFile[])
      setBackupFiles(files)
      setBackupSeleccionado(files[0]?.fileName ?? "")
      setMotivoRestore("")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo cargar la lista de backups"))
    } finally {
      setCargandoBackups(false)
    }
  }

  async function confirmarRestore() {
    if (!backupEnabled || !restoreEnabled) {
      toast.error("Restore deshabilitado por configuracion del backend")
      return
    }

    const motivo = motivoRestore.trim()
    if (!backupSeleccionado) {
      toast.error("Selecciona un backup")
      return
    }
    if (!motivo) {
      toast.error("Ingresa un motivo de restauracion")
      return
    }

    setGuardandoBackup(true)
    try {
      await api.post("/api/admin/backups/restore", {
        fileName: backupSeleccionado,
        motivo,
      })
      toast.success(`Restore ejecutado: ${backupSeleccionado}`)
      setRestoreDialogAbierto(false)
      setMotivoRestore("")
      setBackupSeleccionado("")
      setBackupFiles([])
      await Promise.all([mutateVentas(), mutateReporte()])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al restaurar backup"))
    } finally {
      setGuardandoBackup(false)
    }
  }

  if (fechasInvalidas) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            La fecha desde no puede ser mayor a la fecha hasta.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando reportes...</CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            No se pudieron cargar los reportes.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Reportes</h1>
          <p className="text-sm text-muted-foreground">Ventas por dia, usuario, medio de pago y margen</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={vistaExport}
            onChange={(e) => setVistaExport(e.target.value as ReporteVista)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="detalle">Exportar: Detalle</option>
            <option value="dia">Exportar: Por dia</option>
            <option value="usuario">Exportar: Por usuario</option>
            <option value="medio">Exportar: Por medio</option>
          </select>
          <Button variant="outline" onClick={exportarReporteCsv} disabled={exportandoReporte}>
            <Download className="mr-2 h-4 w-4" />
            {exportandoReporte ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Button variant="outline" onClick={exportarBackup} disabled={guardandoBackup || !esAdmin || !backupEnabled}>
            Backup
          </Button>
          <Button variant="outline" onClick={importarBackup} disabled={guardandoBackup || !esAdmin || !backupEnabled || !restoreEnabled}>
            Restaurar
          </Button>
        </div>
      </div>

      {esAdmin && !backupEnabled && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            Backups deshabilitados por configuracion del backend.
          </CardContent>
        </Card>
      )}
      {esAdmin && backupEnabled && !restoreEnabled && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            Backup habilitado, pero restore deshabilitado por configuracion.
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="filtroCajaId">Caja ID</Label>
              <Input
                id="filtroCajaId"
                type="number"
                min={1}
                value={filtroCajaId}
                onChange={(e) => setFiltroCajaId(e.target.value)}
                placeholder="Todas"
              />
            </div>

            {esAdmin && (
              <div className="grid gap-2">
                <Label htmlFor="filtroUsuarioId">Usuario</Label>
                <select
                  id="filtroUsuarioId"
                  value={filtroUsuarioId}
                  onChange={(e) => setFiltroUsuarioId(e.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.usuario})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="filtroMedioPago">Medio de pago</Label>
              <select
                id="filtroMedioPago"
                value={filtroMedioPago}
                onChange={(e) => setFiltroMedioPago(e.target.value as "" | MedioPago)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="debito">Debito</option>
                <option value="credito">Credito</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroFechaDesde">Fecha desde</Label>
              <Input
                id="filtroFechaDesde"
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroFechaHasta">Fecha hasta</Label>
              <Input
                id="filtroFechaHasta"
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
            <Badge variant="secondary">Ventas filtradas: {cantidadVentas}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {resumenCards.map((card) => (
          <article
            key={card.key}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
              card.cardTone,
              card.pulse === "critical" && "alert-critical-blink",
              card.pulse === "warning" && "alert-warning-pulse"
            )}
          >
            <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current opacity-[0.08]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                <p className={cn("mt-2 truncate text-2xl font-bold tracking-tight text-foreground", card.valueClassName)}>
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
              </div>
              <div className={cn("rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-105", card.iconTone)}>
                <card.icon className="h-4.5 w-4.5" />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reporte?.porDia ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Sin datos.
                      </TableCell>
                    </TableRow>
                  )}
                  {(reporte?.porDia ?? []).map((fila) => (
                    <TableRow key={fila.fecha}>
                      <TableCell>{fila.fecha}</TableCell>
                      <TableCell className="text-center">{fila.cantidadVentas}</TableCell>
                      <TableCell className="text-right">{formatPrecio(toNumber(fila.totalVendido))}</TableCell>
                      <TableCell className={cn("text-right", classGanancia(toNumber(fila.totalGanancia)))}>
                        {formatPrecio(toNumber(fila.totalGanancia))}
                      </TableCell>
                      <TableCell className="text-right">{toNumber(fila.margenPorcentaje).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por medio de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medio</TableHead>
                    <TableHead className="text-center">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reporte?.porMedioPago ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Sin datos.
                      </TableCell>
                    </TableRow>
                  )}
                  {(reporte?.porMedioPago ?? []).map((fila) => (
                    <TableRow key={fila.medioPago}>
                      <TableCell className="capitalize">{fila.medioPago}</TableCell>
                      <TableCell className="text-center">{fila.cantidadVentas}</TableCell>
                      <TableCell className="text-right">{formatPrecio(toNumber(fila.totalVendido))}</TableCell>
                      <TableCell className={cn("text-right", classGanancia(toNumber(fila.totalGanancia)))}>
                        {formatPrecio(toNumber(fila.totalGanancia))}
                      </TableCell>
                      <TableCell className="text-right">{toNumber(fila.margenPorcentaje).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-center">Ventas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reporte?.porUsuario ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                )}
                {(reporte?.porUsuario ?? []).map((fila) => (
                  <TableRow key={`${fila.usuarioId ?? "na"}-${fila.usuarioNombre ?? "sin-nombre"}`}>
                    <TableCell>{fila.usuarioNombre || "-"}</TableCell>
                    <TableCell className="text-center">{fila.cantidadVentas}</TableCell>
                    <TableCell className="text-right">{formatPrecio(toNumber(fila.totalVendido))}</TableCell>
                    <TableCell className={cn("text-right", classGanancia(toNumber(fila.totalGanancia)))}>
                      {formatPrecio(toNumber(fila.totalGanancia))}
                    </TableCell>
                    <TableCell className="text-right">{toNumber(fila.margenPorcentaje).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-center">Ventas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reporte?.detalle ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                )}
                {(reporte?.detalle ?? []).map((fila, idx) => (
                  <TableRow key={`${fila.fecha}-${fila.usuarioId ?? "na"}-${fila.medioPago}-${idx}`}>
                    <TableCell>{fila.fecha}</TableCell>
                    <TableCell>{fila.usuarioNombre || "-"}</TableCell>
                    <TableCell className="capitalize">{fila.medioPago}</TableCell>
                    <TableCell className="text-center">{fila.cantidadVentas}</TableCell>
                    <TableCell className="text-right">{formatPrecio(toNumber(fila.totalVendido))}</TableCell>
                    <TableCell className={cn("text-right", classGanancia(toNumber(fila.totalGanancia)))}>
                      {formatPrecio(toNumber(fila.totalGanancia))}
                    </TableCell>
                    <TableCell className="text-right">{toNumber(fila.margenPorcentaje).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venta #</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No hay ventas para los filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
                {ventas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell className="font-medium">#{venta.id}</TableCell>
                    <TableCell>{formatFecha(venta.fecha)}</TableCell>
                    <TableCell className="capitalize">{venta.medioPago}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {venta.items.map((item) => (
                          <Badge key={item.id} variant="secondary" className="text-xs">
                            {item.nombre} x{item.cantidad}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatPrecio(toNumber(venta.total))}</TableCell>
                    <TableCell className={cn("text-right", classGanancia(toNumber(venta.ganancia)))}>
                      {formatPrecio(toNumber(venta.ganancia))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={venta.estado === "anulada" ? "destructive" : "secondary"} className="capitalize">
                        {venta.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {esAdmin ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => abrirDialogAnular(venta)}
                          disabled={venta.estado === "anulada" || anulandoVenta}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Anular
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogAnularAbierto}
        onOpenChange={(open) => {
          setDialogAnularAbierto(open)
          if (!open) {
            setVentaAAnular(null)
            setMotivoAnulacion("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              {ventaAAnular
                ? `Vas a anular la venta #${ventaAAnular.id} por ${formatPrecio(toNumber(ventaAAnular.total))}.`
                : "Selecciona una venta para anular."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="motivoAnulacion">Motivo *</Label>
            <Input
              id="motivoAnulacion"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ej: cliente devolvio el producto"
              disabled={anulandoVenta}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAnularAbierto(false)} disabled={anulandoVenta}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarAnulacion} disabled={anulandoVenta || !ventaAAnular}>
              {anulandoVenta ? "Anulando..." : "Confirmar anulacion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={restoreDialogAbierto}
        onOpenChange={(open) => {
          setRestoreDialogAbierto(open)
          if (!open) {
            setBackupFiles([])
            setBackupSeleccionado("")
            setMotivoRestore("")
            setCargandoBackups(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restaurar backup</DialogTitle>
            <DialogDescription>
              Selecciona un backup y especifica el motivo. Esta accion impacta la base completa.
            </DialogDescription>
          </DialogHeader>

          {cargandoBackups ? (
            <div className="py-6 text-sm text-muted-foreground">Cargando backups...</div>
          ) : backupFiles.length === 0 ? (
            <div className="py-2 text-sm text-muted-foreground">No hay backups disponibles.</div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label htmlFor="backupSeleccionado">Backup</Label>
                <select
                  id="backupSeleccionado"
                  value={backupSeleccionado}
                  onChange={(e) => setBackupSeleccionado(e.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {backupFiles.map((f) => (
                    <option key={f.fileName} value={f.fileName}>
                      {f.fileName} | {formatBytes(f.sizeBytes)} | {formatFecha(f.lastModifiedAt)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="motivoRestore">Motivo *</Label>
                <Input
                  id="motivoRestore"
                  value={motivoRestore}
                  onChange={(e) => setMotivoRestore(e.target.value)}
                  placeholder="Ej: restauracion por error de carga"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogAbierto(false)} disabled={guardandoBackup}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarRestore}
              disabled={guardandoBackup || cargandoBackups || backupFiles.length === 0}
            >
              {guardandoBackup ? "Restaurando..." : "Confirmar restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

