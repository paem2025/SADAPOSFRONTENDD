"use client"

import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Wallet,
  Landmark,
  CreditCard,
  RotateCcw,
  FileText,
  Printer,
  Download,
} from "lucide-react"

import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type MedioPago = "efectivo" | "debito" | "credito" | "transferencia"

type Producto = {
  id: number
  nombre: string
  codigoBarras: string | null
  precioVenta: number | string
  stock: number
  categoria?: string | null
  fechaVencimiento?: string | null
}

type ItemCarrito = {
  productoId: number
  nombre: string
  precioUnitario: number
  cantidad: number
  stock: number
  esCigarrillo: boolean
}

type CajaAbierta = {
  id: number
  montoInicial: number
  totalVendido: number
  totalGanancia: number
  cantidadVentas: number
  estado: "abierta" | "cerrada"
}

type VentaResponse = {
  id: number
  total: number | string
  vuelto: number | null
}

type VentaTicketItemResponse = {
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

type VentaTicketResponse = {
  ventaId: number
  fecha: string
  cajaId: number | null
  usuarioId: number | null
  usuarioNombre: string | null
  medioPago: MedioPago
  estado: "activa" | "anulada"
  subtotal: number
  recargo: number
  total: number
  montoRecibido: number | null
  vuelto: number | null
  numeroImpresion: number
  reimpresion: boolean
  ticketTexto: string
  ticketEscPosBase64: string
  items: VentaTicketItemResponse[]
}

const RECARGO_CIGARRILLOS_PORC = 0.1

const CIGARRILLO_KEYWORDS = [
  "cigarr",
  "cigarro",
  "marlboro",
  "camel",
  "chesterfield",
  "lucky",
  "philip",
  "parisiennes",
]

const fetcher = (url: string) => api.get(url).then((r) => r.data)

function getErrorStatus(err: unknown): number | undefined {
  const apiErr = err as { response?: { status?: number } }
  return apiErr.response?.status
}

const cajaFetcher = async (url: string) => {
  try {
    const res = await api.get(url)
    return res.data as CajaAbierta
  } catch (err: unknown) {
    if (getErrorStatus(err) === 404) return null
    throw err
  }
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
}

function formatFechaHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

function parseMoney(input: string): number | null {
  const normalized = input.replace(",", ".").trim()
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
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
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim()
  }

  return fallback
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

function getErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message || fallback
}

function esProductoCigarrillo(p: Producto) {
  const texto = `${p.nombre ?? ""} ${p.categoria ?? ""}`.toLowerCase()
  return CIGARRILLO_KEYWORDS.some((k) => texto.includes(k))
}

const MEDIOS: Array<{
  id: MedioPago
  label: string
  hotkey: "1" | "2" | "3" | "4"
  icon: ComponentType<{ className?: string }>
}> = [
  { id: "efectivo", label: "Efectivo", hotkey: "1", icon: Wallet },
  { id: "debito", label: "Debito", hotkey: "2", icon: CreditCard },
  { id: "credito", label: "Credito", hotkey: "3", icon: CreditCard },
  { id: "transferencia", label: "Transferencia", hotkey: "4", icon: Landmark },
]

export function PuntoDeVenta() {
  const { user } = useAuth()
  const esAdmin = user?.rol === "admin"

  const [entrada, setEntrada] = useState("")
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargando, setCargando] = useState(false)

  const [cobroAbierto, setCobroAbierto] = useState(false)
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo")
  const [montoRecibido, setMontoRecibido] = useState("")

  const [montoInicialCaja, setMontoInicialCaja] = useState("")
  const [montoCierreCaja, setMontoCierreCaja] = useState("")
  const [procesandoCaja, setProcesandoCaja] = useState(false)

  const [dialogNuevoAbierto, setDialogNuevoAbierto] = useState(false)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [codigoNuevo, setCodigoNuevo] = useState("")
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState("")
  const [nuevoPrecioCosto, setNuevoPrecioCosto] = useState("")
  const [nuevoStock, setNuevoStock] = useState("0")
  const [nuevoStockMinimo, setNuevoStockMinimo] = useState("5")
  const [nuevoCategoria, setNuevoCategoria] = useState("General")
  const [nuevoVencimiento, setNuevoVencimiento] = useState("")

  const [ultimaVenta, setUltimaVenta] = useState<{ id: number; total: number } | null>(null)
  const [dialogAnularAbierto, setDialogAnularAbierto] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState("")
  const [anulandoVenta, setAnulandoVenta] = useState(false)

  const [ticketActual, setTicketActual] = useState<VentaTicketResponse | null>(null)
  const [dialogTicketAbierto, setDialogTicketAbierto] = useState(false)
  const [dialogReimpresionAbierto, setDialogReimpresionAbierto] = useState(false)
  const [motivoReimpresion, setMotivoReimpresion] = useState("")
  const [ventaIdReimpresion, setVentaIdReimpresion] = useState<number | null>(null)
  const [ticketAccion, setTicketAccion] = useState<"ver" | "imprimir" | "reimprimir" | "escpos" | null>(null)

  const { data: productos = [], mutate: mutateProductos } = useSWR<Producto[]>("/api/productos", fetcher)
  const { data: cajaAbierta, mutate: mutateCaja, isLoading: cargandoCaja } = useSWR<CajaAbierta | null>(
    "/api/cajas/abierta",
    cajaFetcher
  )

  const query = entrada.trim().toLowerCase()

  const productosFiltrados = useMemo(() => {
    if (!query) return productos
    return productos.filter((p) => {
      const nombre = (p.nombre || "").toLowerCase()
      const codigo = (p.codigoBarras || "").toLowerCase()
      return nombre.includes(query) || codigo.includes(query)
    })
  }, [productos, query])

  const productosRapidos = useMemo(() => productosFiltrados.slice(0, 9), [productosFiltrados])

  const subtotal = useMemo(
    () => carrito.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0),
    [carrito]
  )

  const totalItems = useMemo(
    () => carrito.reduce((acc, it) => acc + it.cantidad, 0),
    [carrito]
  )

  const subtotalCigarrillos = useMemo(
    () =>
      carrito
        .filter((it) => it.esCigarrillo)
        .reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0),
    [carrito]
  )

  const aplicaRecargoTarjeta = medioPago === "debito" || medioPago === "credito"

  const recargoNum = useMemo(() => {
    if (!aplicaRecargoTarjeta) return 0
    return Number((subtotalCigarrillos * RECARGO_CIGARRILLOS_PORC).toFixed(2))
  }, [subtotalCigarrillos, aplicaRecargoTarjeta])

  const total = useMemo(() => subtotal + recargoNum, [subtotal, recargoNum])

  const vueltoEstimado = useMemo(() => {
    if (medioPago !== "efectivo") return null
    const mr = parseMoney(montoRecibido)
    if (mr == null) return null
    return mr - total
  }, [medioPago, montoRecibido, total])

  useEffect(() => {
    if (!cobroAbierto) return

    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const tag = target?.tagName
      const editable =
        !!target &&
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable)

      if (editable) return

      if (ev.key === "1") setMedioPago("efectivo")
      if (ev.key === "2") setMedioPago("debito")
      if (ev.key === "3") setMedioPago("credito")
      if (ev.key === "4") setMedioPago("transferencia")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cobroAbierto])

  function resetNuevoProducto() {
    setNuevoNombre("")
    setNuevoPrecioVenta("")
    setNuevoPrecioCosto("")
    setNuevoStock("0")
    setNuevoStockMinimo("5")
    setNuevoCategoria("General")
    setNuevoVencimiento("")
  }

  function abrirDialogNuevoProducto(codigoEscaneado: string) {
    setCodigoNuevo(codigoEscaneado)
    resetNuevoProducto()
    setDialogNuevoAbierto(true)
  }

  function agregarAlCarrito(p: Producto) {
    setCarrito((prev) => {
      const idx = prev.findIndex((x) => x.productoId === p.id)
      const precio = toNumber(p.precioVenta)
      const esCigarrillo = esProductoCigarrillo(p)

      if (idx === -1) {
        if (p.stock <= 0) {
          toast.error("Sin stock")
          return prev
        }
        return [
          ...prev,
          {
            productoId: p.id,
            nombre: p.nombre,
            precioUnitario: precio,
            cantidad: 1,
            stock: p.stock,
            esCigarrillo,
          },
        ]
      }

      const copy = [...prev]
      const item = copy[idx]
      if (item.cantidad + 1 > item.stock) {
        toast.error("Stock insuficiente")
        return prev
      }
      copy[idx] = { ...item, cantidad: item.cantidad + 1 }
      return copy
    })
  }

  function sumar(productoId: number) {
    setCarrito((prev) =>
      prev.map((it) => {
        if (it.productoId !== productoId) return it
        if (it.cantidad + 1 > it.stock) return it
        return { ...it, cantidad: it.cantidad + 1 }
      })
    )
  }

  function restar(productoId: number) {
    setCarrito((prev) =>
      prev
        .map((it) => {
          if (it.productoId !== productoId) return it
          return { ...it, cantidad: it.cantidad - 1 }
        })
        .filter((it) => it.cantidad > 0)
    )
  }

  function quitar(productoId: number) {
    setCarrito((prev) => prev.filter((it) => it.productoId !== productoId))
  }

  function vaciarCarrito() {
    setCarrito([])
  }

  async function buscarPorCodigo(e: FormEvent) {
    e.preventDefault()
    const c = entrada.trim()
    if (!c) return

    setCargando(true)
    try {
      const p = await api.get(`/api/productos/codigo/${encodeURIComponent(c)}`).then((r) => r.data as Producto)
      agregarAlCarrito(p)
      setEntrada("")
    } catch (err: unknown) {
      if (getErrorStatus(err) === 404) {
        abrirDialogNuevoProducto(c)
      } else {
        toast.error(getErrorMessage(err, "No encontrado"))
      }
    } finally {
      setCargando(false)
    }
  }

  async function crearProductoDesdeCodigo() {
    if (!esAdmin) {
      toast.error("Solo admin puede crear productos nuevos")
      return
    }

    const codigo = codigoNuevo.trim()
    const nombre = nuevoNombre.trim()
    const precioVenta = parseMoney(nuevoPrecioVenta)
    const precioCosto = parseMoney(nuevoPrecioCosto) ?? 0
    const stockInicial = Number(nuevoStock)
    const stockMinimo = Number(nuevoStockMinimo)
    const fechaVencimiento = nuevoVencimiento.trim() ? nuevoVencimiento : null

    if (!codigo) {
      toast.error("Ingresa codigo de barras")
      return
    }
    if (!nombre) {
      toast.error("Ingresa el nombre del producto")
      return
    }
    if (precioVenta == null || precioVenta <= 0) {
      toast.error("Ingresa un precio de venta valido")
      return
    }
    if (!Number.isInteger(stockInicial) || stockInicial < 0) {
      toast.error("Ingresa un stock inicial valido")
      return
    }
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      toast.error("Ingresa un stock minimo valido")
      return
    }

    setGuardandoNuevo(true)
    try {
      const creado = await api
        .post("/api/productos", {
          nombre,
          codigoBarras: codigo,
          precioCosto,
          precioVenta,
          stock: stockInicial,
          stockMinimo,
          categoria: nuevoCategoria.trim() || "General",
          fechaVencimiento,
        })
        .then((r) => r.data as Producto)

      await mutateProductos()
      agregarAlCarrito(creado)
      setDialogNuevoAbierto(false)
      setEntrada("")
      toast.success("Producto creado y agregado al carrito")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo crear el producto"))
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function abrirCaja() {
    const monto = parseMoney(montoInicialCaja) ?? 0
    if (monto < 0) {
      toast.error("El monto inicial no puede ser negativo")
      return
    }

    setProcesandoCaja(true)
    try {
      await api.post("/api/cajas/abrir", { montoInicial: monto })
      setMontoInicialCaja("")
      await mutateCaja()
      toast.success("Caja abierta")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo abrir la caja"))
    } finally {
      setProcesandoCaja(false)
    }
  }

  async function cerrarCaja() {
    const monto = parseMoney(montoCierreCaja)
    if (monto == null) {
      toast.error("Ingresa el monto de cierre")
      return
    }
    if (monto < 0) {
      toast.error("El monto de cierre no puede ser negativo")
      return
    }

    setProcesandoCaja(true)
    try {
      await api.post("/api/cajas/cerrar", { montoCierre: monto })
      setMontoCierreCaja("")
      setCarrito([])
      setUltimaVenta(null)
      await mutateCaja()
      toast.success("Caja cerrada")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo cerrar la caja"))
    } finally {
      setProcesandoCaja(false)
    }
  }

  async function confirmarVenta() {
    if (carrito.length === 0) {
      toast.error("Carrito vacio")
      return
    }
    if (!cajaAbierta) {
      toast.error("No hay caja abierta")
      return
    }

    let montoRecibidoNum: number | undefined
    if (medioPago === "efectivo") {
      const mr = parseMoney(montoRecibido)
      if (mr != null) {
        if (mr < total) {
          toast.error("El monto recibido no alcanza")
          return
        }
        montoRecibidoNum = mr
      }
    }

    setCargando(true)
    try {
      const payload: {
        items: Array<{ productoId: number; cantidad: number }>
        recargo: number
        medioPago: MedioPago
        montoRecibido?: number
      } = {
        items: carrito.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
        recargo: recargoNum,
        medioPago,
      }

      if (montoRecibidoNum != null) payload.montoRecibido = montoRecibidoNum

      const venta = await api.post("/api/ventas", payload).then((r) => r.data as VentaResponse)

      toast.success(`Venta #${venta.id} registrada`)
      toast.message("FEFO aplicado: se desconto primero el lote con vencimiento mas proximo")

      if (medioPago === "efectivo" && venta.vuelto != null) {
        toast.message(`Vuelto: ${formatPrecio(toNumber(venta.vuelto))}`)
      }

      setUltimaVenta({ id: venta.id, total: toNumber(venta.total) })
      setTicketActual(null)
      setVentaIdReimpresion(null)

      setCarrito([])
      setEntrada("")
      setMontoRecibido("")
      setMedioPago("efectivo")
      setCobroAbierto(false)

      await Promise.all([mutateProductos(), mutateCaja()])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al confirmar venta"))
    } finally {
      setCargando(false)
    }
  }

  async function anularUltimaVenta() {
    if (!esAdmin) {
      toast.error("Solo admin puede anular ventas")
      return
    }
    if (!ultimaVenta) {
      toast.error("No hay una venta para anular")
      return
    }

    const motivo = motivoAnulacion.trim()
    if (!motivo) {
      toast.error("Ingresa un motivo de anulacion")
      return
    }

    setAnulandoVenta(true)
    try {
      await api.post(`/api/ventas/${ultimaVenta.id}/anular`, { motivo })
      toast.success(`Venta #${ultimaVenta.id} anulada`)
      setDialogAnularAbierto(false)
      setMotivoAnulacion("")
      setUltimaVenta(null)
      await Promise.all([mutateProductos(), mutateCaja()])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo anular la venta"))
    } finally {
      setAnulandoVenta(false)
    }
  }

  async function verTicketVenta(ventaId: number) {
    setTicketAccion("ver")
    try {
      const ticket = await api.get(`/api/ventas/${ventaId}/ticket`).then((r) => r.data as VentaTicketResponse)
      setTicketActual(ticket)
      setDialogTicketAbierto(true)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo obtener el ticket"))
    } finally {
      setTicketAccion(null)
    }
  }

  async function imprimirTicketVenta(ventaId: number) {
    setTicketAccion("imprimir")
    try {
      const ticket = await api.post(`/api/ventas/${ventaId}/ticket/imprimir`, {}).then((r) => r.data as VentaTicketResponse)
      setTicketActual(ticket)
      setDialogTicketAbierto(true)
      toast.success(`Ticket impreso (#${ticket.numeroImpresion})`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo imprimir el ticket"))
    } finally {
      setTicketAccion(null)
    }
  }

  function abrirReimpresion(ventaId: number) {
    setVentaIdReimpresion(ventaId)
    setMotivoReimpresion("")
    setDialogReimpresionAbierto(true)
  }

  async function confirmarReimpresionTicket() {
    if (!ventaIdReimpresion) {
      toast.error("No hay venta seleccionada para reimpresion")
      return
    }

    const payload = motivoReimpresion.trim() ? { motivo: motivoReimpresion.trim() } : {}

    setTicketAccion("reimprimir")
    try {
      const ticket = await api
        .post(`/api/ventas/${ventaIdReimpresion}/ticket/reimprimir`, payload)
        .then((r) => r.data as VentaTicketResponse)
      setTicketActual(ticket)
      setDialogReimpresionAbierto(false)
      setDialogTicketAbierto(true)
      setMotivoReimpresion("")
      toast.success(`Ticket reimpreso (#${ticket.numeroImpresion})`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo reimprimir el ticket"))
    } finally {
      setTicketAccion(null)
    }
  }

  async function descargarEscPos(ventaId: number) {
    setTicketAccion("escpos")
    try {
      const res = await api.get(`/api/ventas/${ventaId}/ticket/escpos`, { responseType: "blob" })
      const contentDisposition = (res.headers?.["content-disposition"] as string | undefined) ?? null
      const fileName = extraerNombreArchivo(contentDisposition, `ticket_venta_${ventaId}.bin`)
      descargarArchivo(res.data as Blob, fileName)
      toast.success(`Archivo descargado: ${fileName}`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo descargar el archivo ESC/POS"))
    } finally {
      setTicketAccion(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Punto de Venta</h1>
          <p className="text-sm text-muted-foreground">Escanea o busca productos para vender</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cargandoCaja ? (
            <Badge variant="secondary">Verificando caja...</Badge>
          ) : cajaAbierta ? (
            <>
              <Badge>Caja abierta #{cajaAbierta.id}</Badge>
              <Input
                value={montoCierreCaja}
                onChange={(e) => setMontoCierreCaja(e.target.value)}
                placeholder="Monto cierre"
                inputMode="decimal"
                className="w-36"
              />
              <Button variant="destructive" size="sm" onClick={cerrarCaja} disabled={procesandoCaja}>
                Cerrar caja
              </Button>
            </>
          ) : (
            <>
              <Input
                value={montoInicialCaja}
                onChange={(e) => setMontoInicialCaja(e.target.value)}
                placeholder="Monto inicial"
                inputMode="decimal"
                className="w-36"
              />
              <Button size="sm" onClick={abrirCaja} disabled={procesandoCaja}>
                Abrir caja
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buscar o Escanear Producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={buscarPorCodigo} className="relative">
                <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  placeholder="Escanea el codigo de barras o escribe el nombre del producto..."
                  className="pl-9"
                  disabled={cargando || !cajaAbierta}
                />
              </form>
              <p className="text-xs text-muted-foreground">Usa la pistola lectora o escribi el nombre/codigo manualmente</p>
            </CardContent>
          </Card>

          <Card className="min-h-[420px]">
            <CardHeader>
              <CardTitle className="text-base">Productos Rapidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {productosRapidos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={p.stock <= 0 || !cajaAbierta}
                    className="rounded-lg border p-3 text-left transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="truncate text-sm font-medium">{p.nombre}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">{formatPrecio(toNumber(p.precioVenta))}</span>
                      <span className="text-xs text-muted-foreground">x{p.stock}</span>
                    </div>
                  </button>
                ))}
              </div>

              {productosRapidos.length === 0 && (
                <p className="pt-2 text-sm text-muted-foreground">Sin resultados.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[580px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Carrito</CardTitle>
            <Badge variant="secondary">{totalItems} items</Badge>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-64px)] flex-col">
            {carrito.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Escanea un producto para comenzar
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-auto pr-1">
                  {carrito.map((it) => (
                    <div key={it.productoId} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{it.nombre}</p>
                          <p className="text-xs text-muted-foreground">{formatPrecio(it.precioUnitario)} c/u</p>
                        </div>
                        <p className="text-sm font-bold">{formatPrecio(it.precioUnitario * it.cantidad)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => restar(it.productoId)}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center text-sm">{it.cantidad}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => sumar(it.productoId)}
                            disabled={it.cantidad >= it.stock}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => quitar(it.productoId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">{formatPrecio(total)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={vaciarCarrito} disabled={cargando}>
                      Vaciar
                    </Button>
                    <Button onClick={() => setCobroAbierto(true)} disabled={cargando || !cajaAbierta}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Cobrar {formatPrecio(total)}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {ultimaVenta && (
              <div className="mt-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium">Ultima venta #{ultimaVenta.id}</p>
                    <p className="text-xs text-muted-foreground">Total: {formatPrecio(ultimaVenta.total)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setDialogAnularAbierto(true)}
                    disabled={!esAdmin || anulandoVenta}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Anular
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => verTicketVenta(ultimaVenta.id)}
                    disabled={ticketAccion !== null}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Ticket
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => imprimirTicketVenta(ultimaVenta.id)}
                    disabled={ticketAccion !== null}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => abrirReimpresion(ultimaVenta.id)}
                    disabled={ticketAccion !== null}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reimprimir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => descargarEscPos(ultimaVenta.id)}
                    disabled={ticketAccion !== null}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    ESC/POS
                  </Button>
                </div>

                {ticketAccion !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">Procesando ticket...</p>
                )}
                {!esAdmin && (
                  <p className="mt-2 text-xs text-muted-foreground">Solo admin puede anular ventas.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={cobroAbierto} onOpenChange={setCobroAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cobrar venta</DialogTitle>
            <DialogDescription>{totalItems} productos en el carrito</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="max-h-36 space-y-1 overflow-auto pr-1 text-sm">
                {carrito.map((it) => (
                  <div key={it.productoId} className="flex items-center justify-between">
                    <span>
                      {it.nombre} x{it.cantidad}
                    </span>
                    <span>{formatPrecio(it.precioUnitario * it.cantidad)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Medio de pago</Label>
              <div className="grid grid-cols-2 gap-2">
                {MEDIOS.map((m) => {
                  const Icon = m.icon
                  const activo = medioPago === m.id
                  return (
                    <Button
                      key={m.id}
                      type="button"
                      variant={activo ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setMedioPago(m.id)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {m.label}
                      <span className="ml-auto text-xs opacity-70">[{m.hotkey}]</span>
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">Atajos: 1 Efectivo, 2 Debito, 3 Credito, 4 Transferencia</p>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recargo cigarrillos (10% solo debito/credito)</span>
                <span>{aplicaRecargoTarjeta ? formatPrecio(recargoNum) : "Sin recargo"}</span>
              </div>
            </div>

            {medioPago === "efectivo" && (
              <div className="grid gap-2">
                <Label htmlFor="montoRecibido">Con cuanto abona el cliente (opcional)</Label>
                <Input
                  id="montoRecibido"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  inputMode="decimal"
                  placeholder="Dejar vacio si no queres calcular vuelto"
                />
                {vueltoEstimado != null && (
                  <p className="text-xs text-muted-foreground">
                    Vuelto estimado:{" "}
                    <span className={vueltoEstimado < 0 ? "text-destructive" : ""}>{formatPrecio(vueltoEstimado)}</span>
                  </p>
                )}
              </div>
            )}

            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrecio(subtotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recargo</span>
                <span>{formatPrecio(recargoNum)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Total a cobrar</span>
                <span className="text-2xl font-bold">{formatPrecio(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCobroAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarVenta} disabled={cargando || !cajaAbierta || carrito.length === 0}>
              Cobrar {formatPrecio(total)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogAnularAbierto}
        onOpenChange={(open) => {
          setDialogAnularAbierto(open)
          if (!open) setMotivoAnulacion("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              {ultimaVenta
                ? `Se va a anular la venta #${ultimaVenta.id} por ${formatPrecio(ultimaVenta.total)}.`
                : "No hay venta seleccionada para anular."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="motivoAnulacion">Motivo *</Label>
            <Input
              id="motivoAnulacion"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ej: cliente devolvio la compra"
              disabled={anulandoVenta}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAnularAbierto(false)} disabled={anulandoVenta}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={anularUltimaVenta} disabled={anulandoVenta || !ultimaVenta}>
              {anulandoVenta ? "Anulando..." : "Confirmar anulacion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogTicketAbierto} onOpenChange={setDialogTicketAbierto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ticketActual ? `Ticket venta #${ticketActual.ventaId}` : "Ticket de venta"}</DialogTitle>
            <DialogDescription>
              {ticketActual
                ? `Impresion #${ticketActual.numeroImpresion} | Estado: ${ticketActual.estado}`
                : "No hay ticket cargado."}
            </DialogDescription>
          </DialogHeader>

          {ticketActual ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Fecha:</span> {formatFechaHora(ticketActual.fecha)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Usuario:</span> {ticketActual.usuarioNombre || "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Caja:</span> {ticketActual.cajaId ?? "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Pago:</span> {ticketActual.medioPago}
                  </p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Subtotal:</span> {formatPrecio(toNumber(ticketActual.subtotal))}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Recargo:</span> {formatPrecio(toNumber(ticketActual.recargo))}
                  </p>
                  <p className="font-semibold">
                    <span className="text-muted-foreground font-normal">Total:</span> {formatPrecio(toNumber(ticketActual.total))}
                  </p>
                  {ticketActual.vuelto != null && (
                    <p>
                      <span className="text-muted-foreground">Vuelto:</span> {formatPrecio(toNumber(ticketActual.vuelto))}
                    </p>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs">{ticketActual.ticketTexto}</pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay ticket para mostrar.</p>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => ticketActual && descargarEscPos(ticketActual.ventaId)}
              disabled={!ticketActual || ticketAccion !== null}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar ESC/POS
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => ticketActual && verTicketVenta(ticketActual.ventaId)}
                disabled={!ticketActual || ticketAccion !== null}
              >
                Actualizar
              </Button>
              <Button
                onClick={() => ticketActual && imprimirTicketVenta(ticketActual.ventaId)}
                disabled={!ticketActual || ticketAccion !== null}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                onClick={() => ticketActual && abrirReimpresion(ticketActual.ventaId)}
                disabled={!ticketActual || ticketAccion !== null}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reimprimir
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogReimpresionAbierto}
        onOpenChange={(open) => {
          setDialogReimpresionAbierto(open)
          if (!open) {
            setMotivoReimpresion("")
            setVentaIdReimpresion(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reimprimir ticket</DialogTitle>
            <DialogDescription>
              {ventaIdReimpresion ? `Venta #${ventaIdReimpresion}` : "No hay venta seleccionada."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="motivoReimpresion">Motivo (opcional)</Label>
            <Input
              id="motivoReimpresion"
              value={motivoReimpresion}
              onChange={(e) => setMotivoReimpresion(e.target.value)}
              placeholder="Ej: cliente solicita copia"
              disabled={ticketAccion === "reimprimir"}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReimpresionAbierto(false)} disabled={ticketAccion === "reimprimir"}>
              Cancelar
            </Button>
            <Button onClick={confirmarReimpresionTicket} disabled={ticketAccion === "reimprimir" || !ventaIdReimpresion}>
              {ticketAccion === "reimprimir" ? "Reimprimiendo..." : "Confirmar reimpresion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogNuevoAbierto}
        onOpenChange={(open) => {
          setDialogNuevoAbierto(open)
          if (!open) {
            setCodigoNuevo("")
            resetNuevoProducto()
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Producto No Encontrado</DialogTitle>
            <DialogDescription>
              El codigo <span className="font-semibold">{codigoNuevo}</span> no existe en tu sistema. Completa los
              datos para crearlo y se agrega al carrito automaticamente.
            </DialogDescription>
          </DialogHeader>

          {!esAdmin ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              Solo admin puede crear productos nuevos. Avisa a un administrador.
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="codigoNuevo">Codigo de Barras *</Label>
                <Input
                  id="codigoNuevo"
                  value={codigoNuevo}
                  onChange={(e) => setCodigoNuevo(e.target.value)}
                  placeholder="Escanea o escribe el codigo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nuevoNombre">Nombre del Producto *</Label>
                <Input
                  id="nuevoNombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Coca Cola 500ml"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="nuevoPrecioCosto">Precio de Costo</Label>
                  <Input
                    id="nuevoPrecioCosto"
                    value={nuevoPrecioCosto}
                    onChange={(e) => setNuevoPrecioCosto(e.target.value)}
                    inputMode="decimal"
                    placeholder="Lo que pagas vos"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nuevoPrecioVenta">Precio de Venta *</Label>
                  <Input
                    id="nuevoPrecioVenta"
                    value={nuevoPrecioVenta}
                    onChange={(e) => setNuevoPrecioVenta(e.target.value)}
                    inputMode="decimal"
                    placeholder="Lo que cobras"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="nuevoCategoria">Categoria</Label>
                  <Input
                    id="nuevoCategoria"
                    value={nuevoCategoria}
                    onChange={(e) => setNuevoCategoria(e.target.value)}
                    placeholder="Ej: Bebidas"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nuevoVencimiento">Fecha de Vencimiento</Label>
                  <Input
                    id="nuevoVencimiento"
                    type="date"
                    value={nuevoVencimiento}
                    onChange={(e) => setNuevoVencimiento(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="nuevoStock">Stock Inicial</Label>
                  <Input
                    id="nuevoStock"
                    value={nuevoStock}
                    onChange={(e) => setNuevoStock(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nuevoStockMinimo">Stock Minimo (alerta)</Label>
                  <Input
                    id="nuevoStockMinimo"
                    value={nuevoStockMinimo}
                    onChange={(e) => setNuevoStockMinimo(e.target.value)}
                    inputMode="numeric"
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNuevoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crearProductoDesdeCodigo} disabled={!esAdmin || guardandoNuevo}>
              {guardandoNuevo ? "Guardando..." : "Crear y Agregar al Carrito"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

