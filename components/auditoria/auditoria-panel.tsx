"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Eye, ShieldCheck } from "lucide-react"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Usuario = {
  id: number
  nombre: string
  usuario: string
}

type AuditLog = {
  id: number
  createdAt: string
  usuarioId: number | null
  usuarioNombre: string | null
  accion: string
  entidad: string
  entidadId: string | null
  detalleJson: string | null
}

type PageResponse<T> = {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

const PAGE_SIZE = 20
const fetcher = <T,>(url: string) => api.get<T>(url).then((r) => r.data)

function formatFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

function getErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message || fallback
}

function formatAccion(accion: string) {
  if (accion === "USUARIO_DELETE_SOFT") return "Usuario desactivado"
  if (accion === "USUARIO_DELETE_HARD") return "Usuario eliminado"
  return accion
}

function parseDetalle(detalleJson: string | null | undefined): Record<string, unknown> | null {
  if (!detalleJson) return null
  try {
    const parsed = JSON.parse(detalleJson)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function asText(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  return null
}

function formatDetalleHumano(log: AuditLog | null, detalle: Record<string, unknown> | null) {
  if (!log || !detalle) return null
  if (log.accion !== "USUARIO_DELETE_SOFT" && log.accion !== "USUARIO_DELETE_HARD") return null

  const objetivoId = asText(detalle.id) ?? log.entidadId ?? "-"
  const objetivoNombre = asText(detalle.nombre) ?? "-"
  const objetivoUsuario = asText(detalle.usuario) ?? "-"
  const objetivoRol = asText(detalle.rol) ?? "-"

  const ejecutadoPorNombre = asText(detalle.requestByUsuarioNombre) ?? log.usuarioNombre ?? "Sistema"
  const ejecutadoPorId = asText(detalle.requestByUsuarioId) ?? (log.usuarioId != null ? String(log.usuarioId) : null)

  const tipoEliminacion =
    asText(detalle.tipoEliminacion) === "hard" ? "Eliminacion fisica" : "Baja logica (desactivado)"

  const motivoRaw = asText(detalle.motivo)
  const motivo = motivoRaw === "referencias" ? "Tiene movimientos o referencias historicas" : motivoRaw

  const lines = [
    `Resultado: ${tipoEliminacion}`,
    `Usuario afectado: ${objetivoNombre} (${objetivoUsuario})`,
    `ID: ${objetivoId}`,
    `Rol: ${objetivoRol}`,
    `Ejecutado por: ${ejecutadoPorNombre}${ejecutadoPorId ? ` (ID ${ejecutadoPorId})` : ""}`,
  ]

  if (motivo) {
    lines.push(`Motivo: ${motivo}`)
  }

  return lines.join("\n")
}

function labelFromPath(path: string) {
  const labels: Record<string, string> = {
    id: "ID objetivo",
    nombre: "Nombre objetivo",
    usuario: "Usuario objetivo",
    rol: "Rol objetivo",
    activo: "Activo (antes)",
    requestByUsuarioId: "ID ejecutado por",
    requestByUsuarioNombre: "Ejecutado por",
    tipoEliminacion: "Tipo de eliminacion",
    motivo: "Motivo",
    "despues.id": "ID despues",
    "despues.nombre": "Nombre despues",
    "despues.usuario": "Usuario despues",
    "despues.rol": "Rol despues",
    "despues.activo": "Activo (despues)",
  }
  return labels[path] ?? path
}

function valueToText(path: string, value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Si" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    if (path === "tipoEliminacion") {
      if (value === "hard") return "Eliminacion fisica"
      if (value === "soft") return "Baja logica (desactivado)"
    }
    if (path === "motivo" && value === "referencias") {
      return "Tiene movimientos o referencias historicas"
    }
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "-"
    const allPrimitive = value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v))
    if (allPrimitive) {
      return value.map((v) => valueToText(path, v)).join(", ")
    }
    return `${value.length} item(s)`
  }
  return "[objeto]"
}

function formatDetalleExtendido(detalle: Record<string, unknown> | null) {
  if (!detalle) return "-"

  const lines: string[] = []

  const visit = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, rawValue] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        visit(rawValue as Record<string, unknown>, path)
        continue
      }
      lines.push(`${labelFromPath(path)}: ${valueToText(path, rawValue)}`)
    }
  }

  visit(detalle)
  return lines.length > 0 ? lines.join("\n") : "-"
}

export function AuditoriaPanel() {
  const { user } = useAuth()
  const esAdmin = user?.rol === "admin"

  const [filtroAccion, setFiltroAccion] = useState("")
  const [filtroEntidad, setFiltroEntidad] = useState("")
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("")
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("")
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("")
  const [page, setPage] = useState(0)

  const [dialogDetalleAbierto, setDialogDetalleAbierto] = useState(false)
  const [logSeleccionado, setLogSeleccionado] = useState<AuditLog | null>(null)

  const fechasInvalidas =
    Boolean(filtroFechaDesde) && Boolean(filtroFechaHasta) && filtroFechaDesde > filtroFechaHasta

  const auditoriaUrl = useMemo(() => {
    if (!esAdmin || fechasInvalidas) return null
    const params = new URLSearchParams()
    const accion = filtroAccion.trim()
    const entidad = filtroEntidad.trim()
    const usuarioId = filtroUsuarioId.trim()

    if (accion) params.set("accion", accion)
    if (entidad) params.set("entidad", entidad)
    if (usuarioId) params.set("usuarioId", usuarioId)
    if (filtroFechaDesde) params.set("fechaDesde", filtroFechaDesde)
    if (filtroFechaHasta) params.set("fechaHasta", filtroFechaHasta)

    params.set("page", String(page))
    params.set("size", String(PAGE_SIZE))
    params.set("sortBy", "createdAt")
    params.set("sortDir", "desc")

    return `/api/admin/auditoria?${params.toString()}`
  }, [esAdmin, fechasInvalidas, filtroAccion, filtroEntidad, filtroUsuarioId, filtroFechaDesde, filtroFechaHasta, page])

  const {
    data: usuarios = [],
    isLoading: loadingUsuarios,
  } = useSWR<Usuario[]>(esAdmin ? "/api/usuarios" : null, fetcher)

  const {
    data: pageData,
    error,
    isLoading,
    mutate,
  } = useSWR<PageResponse<AuditLog>>(auditoriaUrl, fetcher, { keepPreviousData: true })

  const logs = pageData?.items ?? []
  const totalElements = pageData?.totalElements ?? 0
  const totalPagesRaw = pageData?.totalPages ?? 0
  const totalPagesVisibles = Math.max(totalPagesRaw, 1)
  const loading = isLoading || loadingUsuarios

  const detalleParseado = useMemo(() => parseDetalle(logSeleccionado?.detalleJson), [logSeleccionado?.detalleJson])
  const detalleHumano = useMemo(
    () => formatDetalleHumano(logSeleccionado, detalleParseado),
    [logSeleccionado, detalleParseado],
  )
  const detalleExtendido = useMemo(() => formatDetalleExtendido(detalleParseado), [detalleParseado])

  function limpiarFiltros() {
    setFiltroAccion("")
    setFiltroEntidad("")
    setFiltroUsuarioId("")
    setFiltroFechaDesde("")
    setFiltroFechaHasta("")
    setPage(0)
  }

  function abrirDetalle(log: AuditLog) {
    setLogSeleccionado(log)
    setDialogDetalleAbierto(true)
  }

  if (!esAdmin) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Solo administradores pueden ver auditoria.
          </CardContent>
        </Card>
      </div>
    )
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

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="page-tone flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Trazabilidad de acciones administrativas y operativas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Eventos: {totalElements}
          </Badge>
          <Button variant="outline" onClick={() => mutate()} disabled={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="filtroAccion">Accion</Label>
              <Input
                id="filtroAccion"
                value={filtroAccion}
                onChange={(e) => {
                  setFiltroAccion(e.target.value)
                  setPage(0)
                }}
                placeholder="Ej: VENTA_ANULAR"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroEntidad">Entidad</Label>
              <Input
                id="filtroEntidad"
                value={filtroEntidad}
                onChange={(e) => {
                  setFiltroEntidad(e.target.value)
                  setPage(0)
                }}
                placeholder="Ej: venta"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroUsuarioId">Usuario</Label>
              <select
                id="filtroUsuarioId"
                value={filtroUsuarioId}
                onChange={(e) => {
                  setFiltroUsuarioId(e.target.value)
                  setPage(0)
                }}
                className="control-tone h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.usuario})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroFechaDesde">Fecha desde</Label>
              <Input
                id="filtroFechaDesde"
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => {
                  setFiltroFechaDesde(e.target.value)
                  setPage(0)
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filtroFechaHasta">Fecha hasta</Label>
              <Input
                id="filtroFechaHasta"
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => {
                  setFiltroFechaHasta(e.target.value)
                  setPage(0)
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Accion</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Entidad ID</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Cargando eventos...
                    </TableCell>
                  </TableRow>
                )}

                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-destructive">
                      {getErrorMessage(error, "No se pudo cargar la auditoria")}
                    </TableCell>
                  </TableRow>
                )}

                {!loading && !error && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No hay eventos para los filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  !error &&
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatFecha(log.createdAt)}</TableCell>
                      <TableCell>{log.usuarioNombre || "Sistema"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatAccion(log.accion)}</Badge>
                      </TableCell>
                      <TableCell>{log.entidad}</TableCell>
                      <TableCell>{log.entidadId || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => abrirDetalle(log)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {logs.length} de {totalElements} eventos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || loading}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Pagina {page + 1} de {totalPagesVisibles}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={loading || page + 1 >= totalPagesRaw}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogDetalleAbierto}
        onOpenChange={(open) => {
          setDialogDetalleAbierto(open)
          if (!open) {
            setLogSeleccionado(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de auditoria</DialogTitle>
            <DialogDescription>
              {logSeleccionado
                ? `${formatAccion(logSeleccionado.accion)} | ${logSeleccionado.entidad} #${logSeleccionado.entidadId || "-"}`
                : "Detalle del evento"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {detalleHumano && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-medium">Resumen</p>
                <pre className="text-xs leading-5 whitespace-pre-wrap break-words">{detalleHumano}</pre>
              </div>
            )}

            <div className="max-h-[320px] overflow-auto rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-sm font-medium">Detalle extendido</p>
              <pre className="text-xs leading-5 whitespace-pre-wrap break-words">{detalleExtendido}</pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDetalleAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
