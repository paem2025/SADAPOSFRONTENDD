import { expect, test, type Page, type Route } from "@playwright/test"

const SESSION_COOKIE = "sadapos_token"
const APP_ORIGIN = "http://localhost:3000"

function fulfillJson(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

async function mockAuthAndDashboard(page: Page) {
  let loggedIn = false

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path === "/api/auth" && method === "GET") {
      if (!loggedIn) {
        return fulfillJson(route, 401, { message: "No autenticado" })
      }
      return fulfillJson(route, 200, { id: 1, nombre: "Admin", rol: "admin" })
    }

    if (path === "/api/auth" && method === "POST") {
      loggedIn = true
      await page.context().addCookies([
        {
          name: SESSION_COOKIE,
          value: "e2e-session",
          url: APP_ORIGIN,
          sameSite: "Lax",
        },
      ])
      return fulfillJson(route, 200, { id: 1, nombre: "Admin", rol: "admin" })
    }

    if (path === "/api/ventas/resumen") {
      return fulfillJson(route, 200, {
        cantidadVentas: 0,
        totalVendido: 0,
        totalGanancia: 0,
        ticketPromedio: 0,
      })
    }

    if (path === "/api/cajas/resumen") {
      return fulfillJson(route, 200, {
        cantidadCajas: 0,
        cajasAbiertas: 0,
        cajasCerradas: 0,
        totalMontoInicial: 0,
        totalVendido: 0,
        totalGanancia: 0,
        totalMontoCierre: 0,
        totalDiferencia: 0,
      })
    }

    if (path === "/api/productos/alertas") {
      return fulfillJson(route, 200, {
        diasVentana: 30,
        cantidadStockBajo: 0,
        cantidadVencimientosProximos: 0,
        cantidadVencidos: 0,
        requiereAccion: false,
        stockBajo: [],
        vencimientosProximos: [],
        vencidos: [],
      })
    }

    if (path === "/api/productos/patrimonio") {
      return fulfillJson(route, 200, {
        totalCostoStock: 0,
        cantidadProductosConStock: 0,
      })
    }

    if (path === "/api/productos/patrimonio/categorias") {
      return fulfillJson(route, 200, {
        categorias: [],
        totalCostoStockFiltrado: 0,
        cantidadProductosConStockFiltrado: 0,
      })
    }

    if (path === "/api/productos/paginado") {
      return fulfillJson(route, 200, {
        items: [],
        page: 0,
        size: 1,
        totalElements: 0,
        totalPages: 0,
      })
    }

    if (path === "/api/ventas/paginado") {
      return fulfillJson(route, 200, {
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      })
    }

    return fulfillJson(route, 200, {})
  })
}

test("inicia sesion y entra al dashboard", async ({ page }) => {
  await mockAuthAndDashboard(page)

  await page.goto("/login")

  await page.getByLabel("Usuario").fill("admin")
  await page.getByLabel("Contrasena").fill("123456")
  await page.getByRole("button", { name: "Ingresar" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Administracion" })).toBeVisible()
})
