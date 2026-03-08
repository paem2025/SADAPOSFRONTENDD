"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Plus, Pencil, Loader2, Building2, Trash2 } from "lucide-react"

import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Proveedor = {
  id: number
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  activo: boolean
  createdAt: string | null
}

const fetcher = (url: string) => api.get(url).then((r) => r.data)

function getErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message || fallback
}

export function ProveedoresPanel() {
  const { user } = useAuth()
  const esAdmin = user?.rol === "admin"

  const [q, setQ] = useState("")
  const [soloActivos, setSoloActivos] = useState(true)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Proveedor | null>(null)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)

  const [nombre, setNombre] = useState("")
  const [contacto, setContacto] = useState("")
  const [telefono, setTelefono] = useState("")
  const [email, setEmail] = useState("")
  const [activo, setActivo] = useState(true)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set("soloActivos", String(soloActivos))
    if (q.trim()) params.set("q", q.trim())
    return `/api/proveedores?${params.toString()}`
  }, [q, soloActivos])

  const { data: proveedores = [], isLoading, mutate } = useSWR<Proveedor[]>(query, fetcher)

  function resetForm() {
    setNombre("")
    setContacto("")
    setTelefono("")
    setEmail("")
    setActivo(true)
    setEditando(null)
  }

  function abrirCrear() {
    resetForm()
    setDialogAbierto(true)
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setNombre(p.nombre ?? "")
    setContacto(p.contacto ?? "")
    setTelefono(p.telefono ?? "")
    setEmail(p.email ?? "")
    setActivo(!!p.activo)
    setDialogAbierto(true)
  }

  async function guardarProveedor() {
    if (!esAdmin) {
      toast.error("Solo admin puede gestionar proveedores")
      return
    }

    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }

    const payload = {
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      activo,
    }

    setGuardando(true)
    try {
      if (editando) {
        await api.put(`/api/proveedores/${editando.id}`, payload)
        toast.success("Proveedor actualizado")
      } else {
        await api.post("/api/proveedores", payload)
        toast.success("Proveedor creado")
      }

      await mutate()
      setDialogAbierto(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo guardar el proveedor"))
    } finally {
      setGuardando(false)
    }
  }

  async function desactivarProveedor(proveedor: Proveedor) {
    if (!esAdmin) {
      toast.error("Solo admin puede gestionar proveedores")
      return
    }

    setEliminandoId(proveedor.id)
    try {
      await api.delete(`/api/proveedores/${proveedor.id}`)
      toast.success("Proveedor desactivado")
      await mutate()
      setConfirmDelete(null)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo desactivar el proveedor"))
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Proveedores</h1>
          <p className="text-sm text-muted-foreground">Gestion de proveedores para compras e ingreso de mercaderia</p>
        </div>

        {esAdmin && (
          <Button onClick={abrirCrear}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo proveedor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center">
          <Input
            autoFocus
            placeholder="Buscar por nombre, contacto o email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Lista de proveedores ({proveedores.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Telefono</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead>Estado</TableHead>
                  {esAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={esAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      Cargando proveedores...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && proveedores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={esAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      Sin resultados para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  proveedores.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.contacto || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.telefono || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{p.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={p.activo ? "secondary" : "destructive"}>{p.activo ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      {esAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => abrirEditar(p)} title="Editar proveedor">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => p.activo && setConfirmDelete(p)}
                            title={p.activo ? "Desactivar proveedor" : "Proveedor inactivo"}
                            disabled={eliminandoId === p.id || !p.activo}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogAbierto}
        onOpenChange={(open) => {
          setDialogAbierto(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
            <DialogDescription>
              {editando ? "Actualiza los datos del proveedor." : "Completa la informacion del nuevo proveedor."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prov-nombre">Nombre *</Label>
              <Input id="prov-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prov-contacto">Contacto</Label>
              <Input id="prov-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prov-telefono">Telefono</Label>
              <Input id="prov-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prov-email">Email</Label>
              <Input id="prov-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              Proveedor activo
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarProveedor} disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : editando ? (
                "Guardar cambios"
              ) : (
                "Crear proveedor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar proveedor</DialogTitle>
            <DialogDescription>
              Esta accion desactiva el proveedor
              {confirmDelete ? ` ${confirmDelete.nombre}` : ""}. Puedes verlo en Solo activos desmarcado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={eliminandoId !== null}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && desactivarProveedor(confirmDelete)}
              disabled={confirmDelete === null || eliminandoId !== null}
            >
              {eliminandoId !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desactivando...
                </>
              ) : (
                "Si, desactivar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

