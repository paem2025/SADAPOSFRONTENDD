import { expect, test, type Page, type Route } from "@playwright/test"

const SESSION_COOKIE = "sadapos_token"
const APP_ORIGIN = "http://localhost:3000"

const PRODUCTO = {
  id: 101,
  nombre: "Gaseosa 500ml",
  codigoBarras: "7791234567890",
  precioVenta: 1200,
  stock: 30,
  categoria: "Bebidas",
  atajoPos: null,
  fechaVencimiento: null,
  esPesable: false,
  unidadMedida: "unidad",
  modoPrecioDefault: null,
}

function fulfillJson(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

async function mockVentaFlowApi(page: Page) {
  let cajaAbierta = false

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path === "/api/auth" && method === "GET") {
      return fulfillJson(route, 200, { id: 1, nombre: "Admin", rol: "admin" })
    }

    if (path === "/api/cajas/abierta" && method === "GET") {
      if (!cajaAbierta) {
        return fulfillJson(route, 404, { message: "No hay caja abierta" })
      }
      return fulfillJson(route, 200, {
        id: 1,
        montoInicial: 5000,
        totalVendido: 1200,
        totalGanancia: 0,
        cantidadVentas: 1,
        estado: "abierta",
      })
    }

    if (path === "/api/cajas/abrir" && method === "POST") {
      cajaAbierta = true
      return fulfillJson(route, 200, {
        id: 1,
        montoInicial: 5000,
        totalVendido: 0,
        totalGanancia: 0,
        cantidadVentas: 0,
        estado: "abierta",
      })
    }

    if (path === "/api/cajas/cerrar" && method === "POST") {
      cajaAbierta = false
      return fulfillJson(route, 200, { ok: true })
    }

    if (path === "/api/productos" && method === "GET") {
      return fulfillJson(route, 200, [PRODUCTO])
    }

    if (path.startsWith("/api/productos/codigo/") && method === "GET") {
      return fulfillJson(route, 200, PRODUCTO)
    }

    if (path.startsWith("/api/productos/atajo/") && method === "GET") {
      return fulfillJson(route, 404, { message: "Atajo no configurado" })
    }

    if (path === "/api/ofertas" && method === "GET") {
      return fulfillJson(route, 200, [])
    }

    if (path === "/api/ventas" && method === "POST") {
      return fulfillJson(route, 201, {
        id: 321,
        total: 1200,
        vuelto: null,
      })
    }

    if (path === "/api/ventas/321/ticket" && method === "GET") {
      return fulfillJson(route, 200, {
        ventaId: 321,
        fecha: "2026-03-12T14:00:00Z",
        cajaId: 1,
        usuarioId: 1,
        usuarioNombre: "Admin",
        medioPago: "efectivo",
        estado: "activa",
        subtotal: 1200,
        recargo: 0,
        total: 1200,
        montoRecibido: null,
        vuelto: null,
        numeroImpresion: 1,
        reimpresion: false,
        ticketTexto: "TICKET SADAPOS",
        ticketEscPosBase64: "VEVTVA==",
        items: [
          {
            nombre: "Gaseosa 500ml",
            cantidad: 1,
            tipo: "unidad",
            gramos: null,
            modoPrecio: null,
            precioBase: null,
            precioUnitario: 1200,
            subtotal: 1200,
          },
        ],
      })
    }

    return fulfillJson(route, 200, {})
  })
}

async function seedSessionCookie(page: Page) {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: "e2e-session",
      url: APP_ORIGIN,
      sameSite: "Lax",
    },
  ])
}

test("flujo critico: abrir caja, vender y consultar ticket", async ({ page }) => {
  await mockVentaFlowApi(page)
  await seedSessionCookie(page)

  await page.goto("/ventas")
  await expect(page.getByRole("heading", { name: "Punto de Venta" })).toBeVisible()

  await page.getByPlaceholder("Monto inicial").fill("5000")
  await page.getByRole("button", { name: "Abrir caja" }).click()
  await expect(page.getByText("Caja abierta #1")).toBeVisible()

  const inputBusqueda = page.locator("#pos-busqueda-producto")
  await inputBusqueda.fill("7791234567890")
  await inputBusqueda.press("Enter")
  await expect(page.getByText("Gaseosa 500ml").first()).toBeVisible()

  await page.getByRole("button", { name: /^Cobrar / }).first().click()
  const dialogCobro = page.getByRole("dialog")
  await expect(dialogCobro.getByText("Total a cobrar")).toBeVisible()
  await dialogCobro.getByRole("button", { name: /^Cobrar / }).click()

  await expect(page.getByText("Ultima venta #321")).toBeVisible()
  await page.getByRole("button", { name: "Ticket" }).click()
  await expect(page.getByRole("heading", { name: "Ticket venta #321" })).toBeVisible()
})
