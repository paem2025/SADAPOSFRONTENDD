import api from "./api"

export async function login(usuario: string, password: string) {
  const res = await api.post("/api/auth", { usuario, password })
  return res.data // UserResponse
}

export async function getMe() {
  const res = await api.get("/api/auth")
  return res.data
}

export async function logout() {
  await api.delete("/api/auth")
}