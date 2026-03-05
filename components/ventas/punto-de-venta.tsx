"use client"

import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Barcode,
  ShoppingCart,
  Scale,
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
  Smartphone,
  Tv,
  Percent,
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
type ModoPrecioPeso = "gramo" | "cien_gramos"
type AtajoPos = "carga_virtual" | "direct_tv"
type TipoServicioRapido = "carga_virtual" | "direct_tv"

type OfertaItem = {
  productoId: number
  cantidad: number
  precioUnitario: number | string
  productoNombre?: string | null
}

type OfertaGuardada = {
  id: number
  nombre: string
  items: OfertaItem[]
}

type Producto = {
  id: number
  nombre: string
  codigoBarras: string | null
  precioVenta: number | string
  stock: number
  categoria?: string | null
  atajoPos?: AtajoPos | null
  fechaVencimiento?: string | null
  esPesable?: boolean
  unidadMedida?: "unidad" | "gramo"
  modoPrecioDefault?: ModoPrecioPeso | null
}

type ItemUnidad = {
  lineaId: string
  tipo: "unidad"
  productoId: number
  nombre: string
  precioUnitario: number
  precioPersonalizado?: boolean
  cantidad: number
  stock: number
  esCigarrillo: boolean
  atajoPos?: AtajoPos | null
}

type ItemPeso = {
  lineaId: string
  tipo: "peso"
  productoId: number
  nombre: string
  gramos: number
  precioBase: number
  modoPrecio: ModoPrecioPeso
  stock: number
  esCigarrillo: false
}

type ItemCarrito = ItemUnidad | ItemPeso

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
  tipo?: "unidad" | "peso"
  gramos?: number | null
  modoPrecio?: ModoPrecioPeso | null
  precioBase?: number | null
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

const productoAtajoFetcher = async (url: string) => {
  try {
    const res = await api.get(url)
    return res.data as Producto
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

function parseEnteroPositivo(input: string): number | null {
  const normalized = input.replace(",", ".").trim()
  if (!normalized) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

function crearLineaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function consumoStockItem(it: ItemCarrito) {
  return it.tipo === "unidad" ? it.cantidad : it.gramos
}

function calcularSubtotalItem(it: ItemCarrito) {
  if (it.tipo === "unidad") {
    return it.precioUnitario * it.cantidad
  }

  const subtotal =
    it.modoPrecio === "gramo"
      ? it.precioBase * it.gramos
      : it.precioBase * (it.gramos / 100)

  return Number(subtotal.toFixed(2))
}

function descripcionItem(it: ItemCarrito) {
  if (it.tipo === "unidad") {
    if (it.atajoPos) {
      return `Monto cargado: ${formatPrecio(it.cantidad)}`
    }
    return `${formatPrecio(it.precioUnitario)} c/u${it.precioPersonalizado ? " (promo)" : ""}`
  }

  return `Ref: ${formatPrecio(it.precioBase)} / ${it.modoPrecio === "gramo" ? "g" : "100g"}`
}

function tituloItem(it: ItemCarrito) {
  if (it.tipo === "unidad") return it.nombre
  return `${it.nombre} - ${it.gramos}g`
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

function esProductoRecargaValido(p: Producto | null | undefined) {
  if (!p) return false
  if (p.esPesable) return false
  return toNumber(p.precioVenta) === 1
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

  const [dialogPesoAbierto, setDialogPesoAbierto] = useState(false)
  const [productoPesoId, setProductoPesoId] = useState("")
  const [modoPrecioPeso, setModoPrecioPeso] = useState<ModoPrecioPeso>("cien_gramos")
  const [precioVentaPeso, setPrecioVentaPeso] = useState("")
  const [gramosVentaPeso, setGramosVentaPeso] = useState("")

  const [dialogRecargaAbierto, setDialogRecargaAbierto] = useState(false)
  const [tipoRecarga, setTipoRecarga] = useState<TipoServicioRapido | null>(null)
  const [montoRecarga, setMontoRecarga] = useState("")

  const [dialogOfertasAbierto, setDialogOfertasAbierto] = useState(false)
  const [ofertaNombre, setOfertaNombre] = useState("")
  const [ofertaBusqueda, setOfertaBusqueda] = useState("")
  const [ofertaProductoId, setOfertaProductoId] = useState("")
  const [ofertaCantidad, setOfertaCantidad] = useState("1")
  const [ofertaPrecio, setOfertaPrecio] = useState("")
  const [ofertaDraftItems, setOfertaDraftItems] = useState<OfertaItem[]>([])
  const [guardandoOferta, setGuardandoOferta] = useState(false)
  const [ofertaEnProcesoId, setOfertaEnProcesoId] = useState<number | null>(null)

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
  const [nuevoEsPesable, setNuevoEsPesable] = useState(false)
  const [nuevoModoPrecioDefault, setNuevoModoPrecioDefault] = useState<ModoPrecioPeso>("cien_gramos")

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
  const { data: productoCargaVirtual, mutate: mutateCargaVirtual } = useSWR<Producto | null>(
    "/api/productos/atajo/carga_virtual",
    productoAtajoFetcher
  )
  const { data: productoDirectTv, mutate: mutateDirectTv } = useSWR<Producto | null>(
    "/api/productos/atajo/direct_tv",
    productoAtajoFetcher
  )
  const { data: cajaAbierta, mutate: mutateCaja, isLoading: cargandoCaja } = useSWR<CajaAbierta | null>(
    "/api/cajas/abierta",
    cajaFetcher
  )
  const {
    data: ofertasGuardadas = [],
    mutate: mutateOfertas,
    isLoading: cargandoOfertas,
  } = useSWR<OfertaGuardada[]>("/api/ofertas", fetcher)
  const cajaAbiertaId = cajaAbierta?.id ?? null

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

  const productosPesables = useMemo(() => productos.filter((p) => p.esPesable), [productos])
  const productosOfertables = useMemo(
    () => productos.filter((p) => !p.esPesable && !p.atajoPos),
    [productos]
  )
  const productosOfertablesFiltrados = useMemo(() => {
    const q = ofertaBusqueda.trim().toLowerCase()
    if (!q) return productosOfertables

    return productosOfertables.filter((p) => {
      const nombre = (p.nombre ?? "").toLowerCase()
      const codigo = (p.codigoBarras ?? "").toLowerCase()
      const categoria = (p.categoria ?? "").toLowerCase()
      return nombre.includes(q) || codigo.includes(q) || categoria.includes(q)
    })
  }, [productosOfertables, ofertaBusqueda])

  const productoPesoSeleccionado = useMemo(
    () => productosPesables.find((p) => String(p.id) === productoPesoId) ?? null,
    [productosPesables, productoPesoId]
  )
  const ofertaProductoSeleccionado = useMemo(
    () => productosOfertables.find((p) => String(p.id) === ofertaProductoId) ?? null,
    [productosOfertables, ofertaProductoId]
  )

  const productoRecargaSeleccionado = useMemo(() => {
    if (!tipoRecarga) return null
    if (tipoRecarga === "carga_virtual") {
      return productoCargaVirtual ?? productos.find((p) => p.atajoPos === "carga_virtual") ?? null
    }
    return productoDirectTv ?? productos.find((p) => p.atajoPos === "direct_tv") ?? null
  }, [tipoRecarga, productoCargaVirtual, productoDirectTv, productos])

  const saldoCargaVirtual = useMemo(
    () => (productoCargaVirtual ?? productos.find((p) => p.atajoPos === "carga_virtual"))?.stock ?? 0,
    [productoCargaVirtual, productos]
  )

  const saldoDirectTv = useMemo(
    () => (productoDirectTv ?? productos.find((p) => p.atajoPos === "direct_tv"))?.stock ?? 0,
    [productoDirectTv, productos]
  )

  const stockDisponiblePeso = useMemo(() => {
    if (!productoPesoSeleccionado) return 0

    const reservado = carrito
      .filter((it) => it.productoId === productoPesoSeleccionado.id)
      .reduce((acc, it) => acc + consumoStockItem(it), 0)

    return Math.max(productoPesoSeleccionado.stock - reservado, 0)
  }, [carrito, productoPesoSeleccionado])

  const stockDisponibleRecarga = useMemo(() => {
    if (!productoRecargaSeleccionado) return 0

    const reservado = carrito
      .filter((it) => it.productoId === productoRecargaSeleccionado.id)
      .reduce((acc, it) => acc + consumoStockItem(it), 0)

    return Math.max(productoRecargaSeleccionado.stock - reservado, 0)
  }, [carrito, productoRecargaSeleccionado])

  useEffect(() => {
    if (!cajaAbiertaId || cargando || dialogNuevoAbierto) return

    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById("pos-busqueda-producto") as HTMLInputElement | null
      if (!input || input.disabled) return
      input.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [cajaAbiertaId, cargando, dialogNuevoAbierto])

  useEffect(() => {
    if (!dialogPesoAbierto) return

    const frame = window.requestAnimationFrame(() => {
      const targetId = productoPesoSeleccionado ? "peso-precio" : "peso-producto"
      const el = document.getElementById(targetId) as HTMLInputElement | HTMLSelectElement | null
      if (!el) return

      el.focus()

      if (el instanceof HTMLInputElement) {
        el.select()
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [dialogPesoAbierto, productoPesoSeleccionado])

  useEffect(() => {
    if (!dialogRecargaAbierto) return
    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById("monto-recarga") as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dialogRecargaAbierto])

  useEffect(() => {
    if (!dialogOfertasAbierto) return
    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById("oferta-nombre") as HTMLInputElement | null
      input?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dialogOfertasAbierto])

  const subtotal = useMemo(
    () => carrito.reduce((acc, it) => acc + calcularSubtotalItem(it), 0),
    [carrito]
  )

  const totalItems = useMemo(
    () =>
      carrito.reduce((acc, it) => {
        if (it.tipo === "unidad") return acc + (it.atajoPos ? 1 : it.cantidad)
        return acc + 1
      }, 0),
    [carrito]
  )

  const subtotalCigarrillos = useMemo(
    () =>
      carrito
        .filter((it): it is ItemUnidad => it.tipo === "unidad" && it.esCigarrillo)
        .reduce((acc, it) => acc + calcularSubtotalItem(it), 0),
    [carrito]
  )

  const aplicaRecargoTarjeta =
    medioPago === "debito" || medioPago === "credito" || medioPago === "transferencia"

  const recargoNum = useMemo(() => {
    if (!aplicaRecargoTarjeta) return 0
    return Number((subtotalCigarrillos * RECARGO_CIGARRILLOS_PORC).toFixed(2))
  }, [subtotalCigarrillos, aplicaRecargoTarjeta])

  const total = useMemo(() => subtotal + recargoNum, [subtotal, recargoNum])

  const totalVentaPeso = useMemo(() => {
    const precio = parseMoney(precioVentaPeso)
    const gramos = parseEnteroPositivo(gramosVentaPeso)
    if (precio == null || gramos == null || precio <= 0) return null

    const totalCalculado = modoPrecioPeso === "gramo" ? precio * gramos : precio * (gramos / 100)
    return Number(totalCalculado.toFixed(2))
  }, [precioVentaPeso, gramosVentaPeso, modoPrecioPeso])

  const referenciaVentaPeso = useMemo(() => {
    const precio = parseMoney(precioVentaPeso)
    if (precio == null || precio <= 0) return null
    return modoPrecioPeso === "gramo" ? Number((precio * 100).toFixed(2)) : precio
  }, [precioVentaPeso, modoPrecioPeso])

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
    setNuevoEsPesable(false)
    setNuevoModoPrecioDefault("cien_gramos")
  }

  function resetDialogPeso() {
    setProductoPesoId("")
    setModoPrecioPeso("cien_gramos")
    setPrecioVentaPeso("")
    setGramosVentaPeso("")
  }

  function resetDialogRecarga() {
    setTipoRecarga(null)
    setMontoRecarga("")
  }

  function resetDialogOfertasDraft() {
    setOfertaNombre("")
    setOfertaBusqueda("")
    setOfertaProductoId("")
    setOfertaCantidad("1")
    setOfertaPrecio("")
    setOfertaDraftItems([])
  }

  function seleccionarProductoOferta(value: string) {
    setOfertaProductoId(value)

    const producto = productosOfertables.find((p) => String(p.id) === value)
    if (!producto) {
      setOfertaPrecio("")
      return
    }

    setOfertaPrecio(String(toNumber(producto.precioVenta)))
  }

  function seleccionarProductoOfertaPorBusqueda() {
    const busqueda = ofertaBusqueda.trim().toLowerCase()
    if (!busqueda) return

    const exactoPorCodigo = productosOfertables.find(
      (p) => (p.codigoBarras ?? "").toLowerCase() === busqueda
    )
    const exactoPorNombre = productosOfertables.find(
      (p) => (p.nombre ?? "").toLowerCase() === busqueda
    )
    const elegido = exactoPorCodigo ?? exactoPorNombre ?? productosOfertablesFiltrados[0]

    if (!elegido) {
      toast.error("No se encontro producto para esa busqueda")
      return
    }

    seleccionarProductoOferta(String(elegido.id))
    setOfertaCantidad("1")

    const cantidadInput = document.getElementById("oferta-cantidad") as HTMLInputElement | null
    cantidadInput?.focus()
    cantidadInput?.select()
  }

  function agregarItemOfertaDraft() {
    const producto = ofertaProductoSeleccionado
    if (!producto) {
      toast.error("Selecciona un producto para la oferta")
      return
    }

    const cantidad = parseEnteroPositivo(ofertaCantidad)
    if (cantidad == null) {
      toast.error("Ingresa una cantidad valida para la oferta")
      return
    }
    const precioTotal = parseMoney(ofertaPrecio)
    if (precioTotal == null || precioTotal <= 0) {
      toast.error("Ingresa un precio promocional valido")
      return
    }

    setOfertaDraftItems((prev) => {
      const idx = prev.findIndex((it) => it.productoId === producto.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            productoId: producto.id,
            cantidad,
            precioUnitario: precioTotal,
            productoNombre: producto.nombre,
          },
        ]
      }

      const copy = [...prev]
      copy[idx] = {
        ...copy[idx],
        cantidad: copy[idx].cantidad + cantidad,
        precioUnitario: toNumber(copy[idx].precioUnitario) + precioTotal,
        productoNombre: producto.nombre,
      }
      return copy
    })

    setOfertaCantidad("1")
    setOfertaProductoId("")
    setOfertaBusqueda("")
    setOfertaPrecio("")

    const busquedaInput = document.getElementById("oferta-busqueda") as HTMLInputElement | null
    busquedaInput?.focus()
    busquedaInput?.select()
  }

  function quitarItemOfertaDraft(productoId: number) {
    setOfertaDraftItems((prev) => prev.filter((it) => it.productoId !== productoId))
  }

  function nombreProductoOferta(item: OfertaItem) {
    return item.productoNombre ?? productos.find((p) => p.id === item.productoId)?.nombre ?? `Producto #${item.productoId}`
  }

  function precioTotalOferta(item: OfertaItem) {
    return toNumber(item.precioUnitario)
  }

  function precioUnitarioOferta(cantidad: number, precioTotal: number) {
    if (cantidad <= 0) return 0
    return Number((precioTotal / cantidad).toFixed(2))
  }

  async function guardarOferta() {
    if (!esAdmin) {
      toast.error("Solo admin puede guardar ofertas")
      return
    }

    const nombre = ofertaNombre.trim()
    if (!nombre) {
      toast.error("Ingresa un nombre para la oferta")
      return
    }
    if (ofertaDraftItems.length === 0) {
      toast.error("Agrega al menos un producto a la oferta")
      return
    }

    setGuardandoOferta(true)
    try {
      await api.post("/api/ofertas", {
        nombre,
        items: ofertaDraftItems.map((it) => ({
          productoId: it.productoId,
          cantidad: it.cantidad,
          precioUnitario: toNumber(it.precioUnitario),
        })),
      })
      await mutateOfertas()
      resetDialogOfertasDraft()
      toast.success("Oferta guardada")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo guardar la oferta"))
    } finally {
      setGuardandoOferta(false)
    }
  }

  async function eliminarOferta(ofertaId: number) {
    if (!esAdmin) {
      toast.error("Solo admin puede eliminar ofertas")
      return
    }

    setOfertaEnProcesoId(ofertaId)
    try {
      await api.delete(`/api/ofertas/${ofertaId}`)
      await mutateOfertas()
      toast.success("Oferta eliminada")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo eliminar la oferta"))
    } finally {
      setOfertaEnProcesoId(null)
    }
  }

  function agregarOfertaAlCarrito(oferta: OfertaGuardada) {
    if (!cajaAbierta) {
      toast.error("No hay caja abierta")
      return
    }

    const requeridoPorProducto = new Map<number, { cantidad: number; precioTotal: number }>()
    for (const item of oferta.items) {
      const precioTotal = precioTotalOferta(item)
      if (precioTotal <= 0) {
        toast.error(`La oferta tiene precio invalido para ${nombreProductoOferta(item)}`)
        return
      }

      const previo = requeridoPorProducto.get(item.productoId)
      if (!previo) {
        requeridoPorProducto.set(item.productoId, { cantidad: item.cantidad, precioTotal })
      } else {
        requeridoPorProducto.set(item.productoId, {
          cantidad: previo.cantidad + item.cantidad,
          precioTotal: previo.precioTotal + precioTotal,
        })
      }
    }

    for (const [productoId, data] of requeridoPorProducto) {
      const producto = productos.find((p) => p.id === productoId)
      if (!producto) {
        toast.error(`La oferta contiene un producto que ya no existe (id ${productoId})`)
        return
      }
      if (producto.esPesable || producto.atajoPos) {
        toast.error(`La oferta contiene un producto no compatible: ${producto.nombre}`)
        return
      }

      const reservado = carrito
        .filter((it) => it.productoId === producto.id)
        .reduce((acc, it) => acc + consumoStockItem(it), 0)

      if (reservado + data.cantidad > producto.stock) {
        toast.error(`Stock insuficiente para ${producto.nombre}`)
        return
      }
    }

    setCarrito((prev) => {
      const next = [...prev]

      for (const [productoId, data] of requeridoPorProducto) {
        const producto = productos.find((p) => p.id === productoId)
        if (!producto) continue
        const precioUnitario = precioUnitarioOferta(data.cantidad, data.precioTotal)
        if (precioUnitario <= 0) continue

        const idx = next.findIndex(
          (it) =>
            it.tipo === "unidad" &&
            it.productoId === productoId &&
            !it.atajoPos &&
            Math.abs(it.precioUnitario - precioUnitario) < 0.001
        )

        if (idx === -1) {
          next.push({
            lineaId: crearLineaId(),
            tipo: "unidad",
            productoId,
            nombre: producto.nombre,
            precioUnitario,
            precioPersonalizado: true,
            cantidad: data.cantidad,
            stock: producto.stock,
            esCigarrillo: esProductoCigarrillo(producto),
            atajoPos: null,
          })
        } else {
          const actual = next[idx]
          if (actual.tipo !== "unidad") continue
          next[idx] = {
            ...actual,
            precioUnitario,
            precioPersonalizado: true,
            cantidad: actual.cantidad + data.cantidad,
          }
        }
      }

      return next
    })

    setDialogOfertasAbierto(false)
    toast.success(`Oferta agregada: ${oferta.nombre}`)
  }

  function cambiarModoPrecioPeso(nuevoModo: ModoPrecioPeso) {
    if (nuevoModo === modoPrecioPeso) return

    const precioActual = parseMoney(precioVentaPeso)

    if (precioActual != null && precioActual > 0) {
      const convertido =
        modoPrecioPeso === "cien_gramos" && nuevoModo === "gramo"
          ? precioActual / 100
          : modoPrecioPeso === "gramo" && nuevoModo === "cien_gramos"
            ? precioActual * 100
            : precioActual

      setPrecioVentaPeso(String(Number(convertido.toFixed(2))))
    }

    setModoPrecioPeso(nuevoModo)
  }

  function abrirDialogNuevoProducto(codigoEscaneado: string) {
    setCodigoNuevo(codigoEscaneado)
    resetNuevoProducto()
    setDialogNuevoAbierto(true)
  }

  function abrirDialogPesoManual() {
    resetDialogPeso()

    if (productosPesables.length === 1) {
      const unico = productosPesables[0]
      setProductoPesoId(String(unico.id))
      setModoPrecioPeso(unico.modoPrecioDefault ?? "cien_gramos")
      setPrecioVentaPeso(String(toNumber(unico.precioVenta)))
    }

    setDialogPesoAbierto(true)
  }

  function abrirDialogPesoParaProducto(p: Producto) {
    setProductoPesoId(String(p.id))
    setModoPrecioPeso(p.modoPrecioDefault ?? "cien_gramos")
    setPrecioVentaPeso(String(toNumber(p.precioVenta)))
    setGramosVentaPeso("")
    setDialogPesoAbierto(true)
  }

  function seleccionarProductoPeso(value: string) {
    setProductoPesoId(value)
    setGramosVentaPeso("")

    const producto = productosPesables.find((p) => String(p.id) === value)
    if (!producto) {
      setModoPrecioPeso("cien_gramos")
      setPrecioVentaPeso("")
      return
    }

    setModoPrecioPeso(producto.modoPrecioDefault ?? "cien_gramos")
    setPrecioVentaPeso(String(toNumber(producto.precioVenta)))
  }

  function getProductoServicio(tipo: TipoServicioRapido) {
    if (tipo === "carga_virtual") {
      return productoCargaVirtual ?? productos.find((p) => p.atajoPos === "carga_virtual") ?? null
    }
    return productoDirectTv ?? productos.find((p) => p.atajoPos === "direct_tv") ?? null
  }

  function abrirDialogRecarga(tipo: TipoServicioRapido) {
    if (!cajaAbierta) {
      toast.error("No hay caja abierta")
      return
    }

    const producto = getProductoServicio(tipo)
    if (!producto) {
      toast.error(`No hay producto configurado para ${tipo === "carga_virtual" ? "Carga virtual" : "Direct TV"}`)
      return
    }

    if (!esProductoRecargaValido(producto)) {
      toast.error(`Configura ${producto.nombre} como no pesable y precio venta = 1.`)
      return
    }

    if (producto.stock <= 0) {
      toast.error("Sin saldo disponible")
      return
    }

    setTipoRecarga(tipo)
    setMontoRecarga("")
    setDialogRecargaAbierto(true)
  }

  function confirmarRecargaServicio() {
    if (!tipoRecarga) return

    const producto = getProductoServicio(tipoRecarga)
    if (!producto) {
      toast.error("Producto de recarga no configurado")
      return
    }

    if (!esProductoRecargaValido(producto)) {
      toast.error(`Configura ${producto.nombre} como no pesable y precio venta = 1.`)
      return
    }

    const monto = parseEnteroPositivo(montoRecarga)
    if (monto == null) {
      toast.error("Ingresa un monto entero mayor a 0")
      return
    }

    if (monto > stockDisponibleRecarga) {
      toast.error(`Saldo insuficiente (${stockDisponibleRecarga} disponibles)`)
      return
    }

    const precio = 1

    setCarrito((prev) => {
      const idx = prev.findIndex(
        (x) => x.tipo === "unidad" && x.productoId === producto.id && x.atajoPos === (producto.atajoPos ?? null)
      )

      if (idx === -1) {
        return [
          ...prev,
          {
            lineaId: crearLineaId(),
            tipo: "unidad",
            productoId: producto.id,
            nombre: producto.nombre,
            precioUnitario: precio,
            precioPersonalizado: false,
            cantidad: monto,
            stock: producto.stock,
            esCigarrillo: false,
            atajoPos: producto.atajoPos ?? null,
          },
        ]
      }

      const copy = [...prev]
      const item = copy[idx]
      if (item.tipo !== "unidad") return prev

      copy[idx] = { ...item, cantidad: item.cantidad + monto }
      return copy
    })

    setDialogRecargaAbierto(false)
    resetDialogRecarga()
    toast.success("Recarga agregada al carrito")
  }

  function agregarAlCarrito(p: Producto) {
    if (p.stock <= 0) {
      toast.error("Sin stock")
      return
    }

    if (p.atajoPos === "carga_virtual") {
      abrirDialogRecarga("carga_virtual")
      return
    }

    if (p.atajoPos === "direct_tv") {
      abrirDialogRecarga("direct_tv")
      return
    }

    if (p.esPesable) {
      abrirDialogPesoParaProducto(p)
      return
    }

    const precio = toNumber(p.precioVenta)
    const esCigarrillo = esProductoCigarrillo(p)

    setCarrito((prev) => {
      const idx = prev.findIndex(
        (x) =>
          x.tipo === "unidad" &&
          x.productoId === p.id &&
          !x.atajoPos &&
          Math.abs(x.precioUnitario - precio) < 0.001
      )
      const reservado = prev
        .filter((x) => x.productoId === p.id)
        .reduce((acc, x) => acc + consumoStockItem(x), 0)

      if (idx === -1) {
        if (reservado >= p.stock) {
          toast.error("Stock insuficiente")
          return prev
        }

        return [
          ...prev,
          {
            lineaId: crearLineaId(),
            tipo: "unidad",
            productoId: p.id,
            nombre: p.nombre,
            precioUnitario: precio,
            precioPersonalizado: false,
            cantidad: 1,
            stock: p.stock,
            esCigarrillo,
            atajoPos: p.atajoPos ?? null,
          },
        ]
      }

      const copy = [...prev]
      const item = copy[idx]
      if (item.tipo !== "unidad") return prev

      if (reservado + 1 > item.stock) {
        toast.error("Stock insuficiente")
        return prev
      }

      copy[idx] = { ...item, cantidad: item.cantidad + 1, precioPersonalizado: item.precioPersonalizado ?? false }
      return copy
    })
  }

  function agregarVentaPesoAlCarrito() {
    if (!cajaAbierta) {
      toast.error("No hay caja abierta")
      return
    }

    if (!productoPesoSeleccionado) {
      toast.error("Selecciona un producto pesable")
      return
    }

    const precioBase = parseMoney(precioVentaPeso)
    const gramosNum = parseEnteroPositivo(gramosVentaPeso)

    if (precioBase == null || precioBase <= 0) {
      toast.error("Ingresa un precio valido")
      return
    }

    if (gramosNum == null) {
      toast.error("Por ahora los gramos deben ser enteros y mayores a 0")
      return
    }

    if (gramosNum > stockDisponiblePeso) {
      toast.error(`Stock insuficiente (${stockDisponiblePeso}g disponibles)`)
      return
    }

    setCarrito((prev) => [
      ...prev,
      {
        lineaId: crearLineaId(),
        tipo: "peso",
        productoId: productoPesoSeleccionado.id,
        nombre: productoPesoSeleccionado.nombre,
        gramos: gramosNum,
        precioBase,
        modoPrecio: modoPrecioPeso,
        stock: productoPesoSeleccionado.stock,
        esCigarrillo: false,
      },
    ])

    setDialogPesoAbierto(false)
    resetDialogPeso()
    toast.success("Producto por peso agregado al carrito")
  }

  function sumar(lineaId: string) {
    setCarrito((prev) =>
      prev.map((it) => {
        if (it.lineaId !== lineaId || it.tipo !== "unidad") return it

        const reservado = prev
          .filter((x) => x.productoId === it.productoId)
          .reduce((acc, x) => acc + consumoStockItem(x), 0)

        if (reservado + 1 > it.stock) {
          toast.error("Stock insuficiente")
          return it
        }

        return { ...it, cantidad: it.cantidad + 1 }
      })
    )
  }

  function restar(lineaId: string) {
    setCarrito((prev) =>
      prev
        .map((it) => {
          if (it.lineaId !== lineaId || it.tipo !== "unidad") return it
          return { ...it, cantidad: it.cantidad - 1 }
        })
        .filter((it) => (it.tipo === "unidad" ? it.cantidad > 0 : true))
    )
  }

  function quitar(lineaId: string) {
    setCarrito((prev) => prev.filter((it) => it.lineaId !== lineaId))
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
      toast.error(
        nuevoEsPesable
          ? "Ingresa un stock inicial valido en gramos"
          : "Ingresa un stock inicial valido"
      )
      return
    }
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      toast.error(
        nuevoEsPesable
          ? "Ingresa un stock minimo valido en gramos"
          : "Ingresa un stock minimo valido"
      )
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
          esPesable: nuevoEsPesable,
          unidadMedida: nuevoEsPesable ? "gramo" : "unidad",
          modoPrecioDefault: nuevoEsPesable ? nuevoModoPrecioDefault : null,
          atajoPos: null,
        })
        .then((r) => r.data as Producto)

      await Promise.all([mutateProductos(), mutateCargaVirtual(), mutateDirectTv()])
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
        items: Array<
          | { productoId: number; tipo: "unidad"; cantidad: number; precioUnitario?: number }
          | {
              productoId: number
              tipo: "peso"
              gramos: number
              modoPrecio: ModoPrecioPeso
              precioBase: number
            }
        >
        recargo: number
        medioPago: MedioPago
        montoRecibido?: number
      } = {
        items: carrito.map((it) =>
          it.tipo === "unidad"
            ? (() => {
                const unidad: { productoId: number; tipo: "unidad"; cantidad: number; precioUnitario?: number } = {
                  productoId: it.productoId,
                  tipo: "unidad",
                  cantidad: it.cantidad,
                }
                if (!it.atajoPos && it.precioPersonalizado) {
                  unidad.precioUnitario = it.precioUnitario
                }
                return unidad
              })()
            : {
                productoId: it.productoId,
                tipo: "peso",
                gramos: it.gramos,
                modoPrecio: it.modoPrecio,
                precioBase: it.precioBase,
              }
        ),
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

      await Promise.all([mutateProductos(), mutateCaja(), mutateCargaVirtual(), mutateDirectTv()])
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
      await Promise.all([mutateProductos(), mutateCaja(), mutateCargaVirtual(), mutateDirectTv()])
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
                  id="pos-busqueda-producto"
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  placeholder="Escanea el codigo de barras o escribe el nombre del producto..."
                  className="pl-9"
                  disabled={cargando || !cajaAbierta}
                />
              </form>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={abrirDialogPesoManual}
                  disabled={!cajaAbierta}
                  className="w-full sm:w-auto"
                >
                  <Scale className="mr-2 h-4 w-4" />
                  Venta por gramos
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => abrirDialogRecarga("carga_virtual")}
                  disabled={!cajaAbierta}
                  className="w-full sm:w-auto"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Carga virtual (saldo: {saldoCargaVirtual})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => abrirDialogRecarga("direct_tv")}
                  disabled={!cajaAbierta}
                  className="w-full sm:w-auto"
                >
                  <Tv className="mr-2 h-4 w-4" />
                  Direct TV (saldo: {saldoDirectTv})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOfertasAbierto(true)}
                  className="w-full sm:w-auto"
                >
                  <Percent className="mr-2 h-4 w-4" />
                  Ofertas kiosco
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Usa la pistola lectora o escribi el nombre/codigo manualmente.
                {productoCargaVirtual === null && ' Falta crear/configurar el atajo "carga_virtual".'}
                {productoDirectTv === null && ' Falta crear/configurar el atajo "direct_tv".'}
              </p>
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
                    <div className="truncate text-sm font-medium">
                      {p.nombre}
                      {p.esPesable && <span className="ml-2 text-xs text-muted-foreground">(granel)</span>}
                      {!p.esPesable && p.atajoPos && <span className="ml-2 text-xs text-muted-foreground">(recarga)</span>}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">
                        {p.atajoPos ? "Venta por saldo" : formatPrecio(toNumber(p.precioVenta))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.esPesable ? `${p.stock}g` : p.atajoPos ? `saldo ${p.stock}` : `x${p.stock}`}
                      </span>
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
                    <div key={it.lineaId} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{tituloItem(it)}</p>
                          <p className="text-xs text-muted-foreground">{descripcionItem(it)}</p>
                        </div>
                        <p className="text-sm font-bold">{formatPrecio(calcularSubtotalItem(it))}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        {it.tipo === "unidad" ? (
                          it.atajoPos ? (
                            <span className="text-sm text-muted-foreground">Saldo consumido: {it.cantidad}</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => restar(it.lineaId)}>
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-6 text-center text-sm">{it.cantidad}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => sumar(it.lineaId)}
                                disabled={it.cantidad >= it.stock}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{it.gramos} g</span>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => quitar(it.lineaId)}
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
                  <div key={it.lineaId} className="flex items-center justify-between">
                    <span>{tituloItem(it)}</span>
                    <span>{formatPrecio(calcularSubtotalItem(it))}</span>
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
                <span className="text-muted-foreground">Recargo cigarrillos (10% debito/credito/transferencia)</span>
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
        open={dialogPesoAbierto}
        onOpenChange={(open) => {
          setDialogPesoAbierto(open)
          if (!open) resetDialogPeso()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Venta por gramos</DialogTitle>
            <DialogDescription>Carga un producto pesable y agregalo al carrito.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="peso-producto">Producto pesable</Label>
              <select
                id="peso-producto"
                value={productoPesoId}
                onChange={(e) => seleccionarProductoPeso(e.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Selecciona un producto</option>
                {productosPesables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (stock: {p.stock}g)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Modo de precio</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={modoPrecioPeso === "cien_gramos" ? "default" : "outline"}
                  onClick={() => cambiarModoPrecioPeso("cien_gramos")}
                  disabled={!productoPesoSeleccionado}
                >
                  Precio por 100g
                </Button>
                <Button
                  type="button"
                  variant={modoPrecioPeso === "gramo" ? "default" : "outline"}
                  onClick={() => cambiarModoPrecioPeso("gramo")}
                  disabled={!productoPesoSeleccionado}
                >
                  Precio por gramo
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="peso-precio">{modoPrecioPeso === "gramo" ? "Precio por gramo" : "Precio cada 100g"}</Label>
                <Input
                  id="peso-precio"
                  value={precioVentaPeso}
                  onChange={(e) => setPrecioVentaPeso(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && productoPesoSeleccionado) {
                      e.preventDefault()
                      const input = document.getElementById("peso-gramos") as HTMLInputElement | null
                      input?.focus()
                      input?.select()
                    }
                  }}
                  inputMode="decimal"
                  placeholder={modoPrecioPeso === "gramo" ? "Ej: 12.5" : "Ej: 1250"}
                  disabled={!productoPesoSeleccionado}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="peso-gramos">Peso en gramos</Label>
                <Input
                  id="peso-gramos"
                  value={gramosVentaPeso}
                  onChange={(e) => setGramosVentaPeso(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && productoPesoSeleccionado) {
                      e.preventDefault()
                      agregarVentaPesoAlCarrito()
                    }
                  }}
                  inputMode="numeric"
                  placeholder="Ej: 85"
                  disabled={!productoPesoSeleccionado}
                />
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Producto</span>
                <span className="font-medium">{productoPesoSeleccionado?.nombre || "Sin producto"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stock disponible</span>
                <span>{productoPesoSeleccionado ? `${stockDisponiblePeso} g` : "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Referencia</span>
                <span>{referenciaVentaPeso == null ? "-" : `${formatPrecio(referenciaVentaPeso)} / 100g`}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Peso cargado</span>
                <span>{gramosVentaPeso.trim() ? `${gramosVentaPeso.trim()} g` : "-"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-semibold">Total a cobrar</span>
                <span className="text-2xl font-bold">{formatPrecio(totalVentaPeso ?? 0)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Por ahora se validan gramos enteros para coincidir con el backend actual.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPesoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={agregarVentaPesoAlCarrito} disabled={!cajaAbierta || !productoPesoSeleccionado}>
              Agregar al carrito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogRecargaAbierto}
        onOpenChange={(open) => {
          setDialogRecargaAbierto(open)
          if (!open) resetDialogRecarga()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tipoRecarga === "carga_virtual" ? "Carga virtual" : "Direct TV"}</DialogTitle>
            <DialogDescription>Ingresa el monto a cargar. Se descuenta del saldo disponible.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="monto-recarga">Monto a cargar *</Label>
              <Input
                id="monto-recarga"
                value={montoRecarga}
                onChange={(e) => setMontoRecarga(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    confirmarRecargaServicio()
                  }
                }}
                inputMode="numeric"
                placeholder="Ej: 1500"
              />
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Producto</span>
                <span className="font-medium">{productoRecargaSeleccionado?.nombre ?? "-"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Saldo disponible</span>
                <span>{stockDisponibleRecarga}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Precio unidad (fijo)</span>
                <span>{formatPrecio(1)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRecargaAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarRecargaServicio} disabled={!productoRecargaSeleccionado || !cajaAbierta}>
              Agregar al carrito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOfertasAbierto}
        onOpenChange={(open) => {
          setDialogOfertasAbierto(open)
          if (!open) resetDialogOfertasDraft()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ofertas de kiosco</DialogTitle>
            <DialogDescription>
              Crea combos por producto y cantidad para agregarlos rapido al carrito.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid gap-2">
                <Label htmlFor="oferta-nombre">Nombre de la oferta *</Label>
                <Input
                  id="oferta-nombre"
                  value={ofertaNombre}
                  onChange={(e) => setOfertaNombre(e.target.value)}
                  placeholder="Ej: Combo merienda"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="oferta-busqueda">Buscar producto (nombre o codigo)</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="oferta-busqueda"
                    value={ofertaBusqueda}
                    onChange={(e) => setOfertaBusqueda(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        seleccionarProductoOfertaPorBusqueda()
                      }
                    }}
                    placeholder="Escanea codigo de barras o escribe para filtrar"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter selecciona el mejor resultado de la busqueda.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_110px_140px_auto]">
                <select
                  id="oferta-producto"
                  value={ofertaProductoId}
                  onChange={(e) => seleccionarProductoOferta(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Selecciona un producto</option>
                  {productosOfertablesFiltrados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (stock: {p.stock})
                    </option>
                  ))}
                </select>
                <Input
                  id="oferta-cantidad"
                  value={ofertaCantidad}
                  onChange={(e) => setOfertaCantidad(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      agregarItemOfertaDraft()
                    }
                  }}
                  inputMode="numeric"
                  placeholder="Cantidad"
                />
                <Input
                  id="oferta-precio"
                  value={ofertaPrecio}
                  onChange={(e) => setOfertaPrecio(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      agregarItemOfertaDraft()
                    }
                  }}
                  inputMode="decimal"
                  placeholder="Total promo"
                />
                <Button
                  type="button"
                  onClick={agregarItemOfertaDraft}
                  disabled={!ofertaProductoSeleccionado || (parseMoney(ofertaPrecio) ?? 0) <= 0}
                  className="w-full md:w-auto"
                >
                  Agregar item
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El precio promo es el total de la cantidad cargada (ej: 3x2 = 4500).
              </p>

              {ofertaDraftItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Agrega productos para armar la oferta.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ofertaDraftItems.map((item) => (
                    <Badge
                      key={item.productoId}
                      variant="secondary"
                      className="max-w-full gap-2 whitespace-normal break-words px-2 py-1 text-left"
                    >
                      {nombreProductoOferta(item)} x{item.cantidad} ={" "}
                      {formatPrecio(precioTotalOferta(item))}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => quitarItemOfertaDraft(item.productoId)}
                        aria-label={`Quitar ${nombreProductoOferta(item)}`}
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={guardarOferta}
                  disabled={ofertaDraftItems.length === 0 || guardandoOferta || !esAdmin}
                >
                  {guardandoOferta ? "Guardando..." : "Guardar oferta"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Ofertas guardadas</h3>
              {cargandoOfertas ? (
                <p className="text-sm text-muted-foreground">Cargando ofertas...</p>
              ) : ofertasGuardadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavia no hay ofertas guardadas.</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {ofertasGuardadas.map((oferta) => (
                    <div key={oferta.id} className="rounded-md border p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{oferta.nombre}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {oferta.items.map((item) => (
                              <Badge
                                key={`${oferta.id}-${item.productoId}`}
                                variant="outline"
                                className="max-w-full whitespace-normal break-words text-left"
                              >
                                {nombreProductoOferta(item)} x{item.cantidad} ={" "}
                                {formatPrecio(precioTotalOferta(item))}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => agregarOfertaAlCarrito(oferta)}
                            disabled={!cajaAbierta || guardandoOferta || ofertaEnProcesoId === oferta.id}
                          >
                            Agregar
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => eliminarOferta(oferta.id)}
                            disabled={!esAdmin || guardandoOferta || ofertaEnProcesoId === oferta.id}
                            aria-label={`Eliminar oferta ${oferta.nombre}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Las ofertas se guardan en backend con precio promocional propio y no modifican el precio real del producto.
              </p>
              {!esAdmin && (
                <p className="text-xs text-muted-foreground">Solo admin puede crear o eliminar ofertas.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOfertasAbierto(false)}>
              Cerrar
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
                <p className="text-xs text-muted-foreground">
                  Para productos a granel podes usar un codigo interno, por ejemplo: GRANEL-CARAMELOS
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nuevoNombre">Nombre del Producto *</Label>
                <Input
                  id="nuevoNombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Coca Cola 500ml o Caramelos a granel"
                />
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <input
                    id="nuevoEsPesable"
                    type="checkbox"
                    checked={nuevoEsPesable}
                    onChange={(e) => setNuevoEsPesable(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="nuevoEsPesable" className="cursor-pointer">
                    Producto pesable (venta por gramos)
                  </Label>
                </div>

                {nuevoEsPesable && (
                  <>
                    <div className="grid gap-2">
                      <Label>Modo de precio por defecto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={nuevoModoPrecioDefault === "cien_gramos" ? "default" : "outline"}
                          onClick={() => setNuevoModoPrecioDefault("cien_gramos")}
                        >
                          Precio por 100g
                        </Button>
                        <Button
                          type="button"
                          variant={nuevoModoPrecioDefault === "gramo" ? "default" : "outline"}
                          onClick={() => setNuevoModoPrecioDefault("gramo")}
                        >
                          Precio por gramo
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Si es pesable, el stock se guarda en gramos. Ejemplo: 5000 = 5 kg.
                    </p>
                  </>
                )}
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
                  <Label htmlFor="nuevoPrecioVenta">
                    {nuevoEsPesable
                      ? nuevoModoPrecioDefault === "gramo"
                        ? "Precio Base por gramo *"
                        : "Precio Base cada 100g *"
                      : "Precio de Venta *"}
                  </Label>
                  <Input
                    id="nuevoPrecioVenta"
                    value={nuevoPrecioVenta}
                    onChange={(e) => setNuevoPrecioVenta(e.target.value)}
                    inputMode="decimal"
                    placeholder={
                      nuevoEsPesable
                        ? nuevoModoPrecioDefault === "gramo"
                          ? "Ej: 12.5"
                          : "Ej: 1250"
                        : "Lo que cobras"
                    }
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
                    placeholder="Ej: Bebidas o Golosinas"
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
                  <Label htmlFor="nuevoStock">
                    {nuevoEsPesable ? "Stock Inicial (gramos)" : "Stock Inicial"}
                  </Label>
                  <Input
                    id="nuevoStock"
                    value={nuevoStock}
                    onChange={(e) => setNuevoStock(e.target.value)}
                    inputMode="numeric"
                    placeholder={nuevoEsPesable ? "Ej: 5000" : "0"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nuevoStockMinimo">
                    {nuevoEsPesable ? "Stock Minimo (gramos)" : "Stock Minimo (alerta)"}
                  </Label>
                  <Input
                    id="nuevoStockMinimo"
                    value={nuevoStockMinimo}
                    onChange={(e) => setNuevoStockMinimo(e.target.value)}
                    inputMode="numeric"
                    placeholder={nuevoEsPesable ? "Ej: 500" : "5"}
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
