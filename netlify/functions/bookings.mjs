import { getStore } from "@netlify/blobs";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const valid = (x) => x && typeof x.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
  /^\d{2}:\d{2}$/.test(x.start) && /^\d{2}:\d{2}$/.test(x.end) &&
  ["A", "B"].includes(x.studio) && typeof x.employee === "string" &&
  typeof x.department === "string" && typeof x.purpose === "string";

export default async (request) => {
  const store = getStore("agenda-estudios");
  const list = (await store.get("reservas", { type: "json" })) || [];

  if (request.method === "GET") return response(list);

  if (request.method === "POST") {
    const item = await request.json().catch(() => null);
    if (!valid(item) || item.end <= item.start || item.employee.trim().length < 2 ||
      item.department.trim().length < 2 || item.purpose.trim().length < 2)
      return response({ error: "Dados da reserva inválidos." }, 400);
    const conflict = list.some((b) => b.id !== item.id && b.date === item.date &&
      b.studio === item.studio && item.start < b.end && item.end > b.start);
    if (conflict) return response({ error: `O Estúdio ${item.studio} já está reservado nesse horário.` }, 409);
    const clean = {
      ...item,
      employee: item.employee.trim().slice(0, 100),
      department: item.department.trim().slice(0, 80),
      purpose: item.purpose.trim().slice(0, 120),
      project: String(item.project || "").trim().slice(0, 120),
      people: Math.max(1, Math.min(100, Number(item.people) || 1)),
      client: `${item.purpose.trim()} — ${item.employee.trim()}`.slice(0, 220),
      note: String(item.note || "").trim().slice(0, 500),
      createdBy: String(item.createdBy || item.employee).trim().slice(0, 100),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedBy: item.employee.trim().slice(0, 100),
      updatedAt: new Date().toISOString()
    };
    const updated = [...list.filter((b) => b.id !== clean.id), clean].sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start));
    await store.setJSON("reservas", updated);
    return response(updated);
  }

  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return response({ error: "Reserva não informada." }, 400);
    const updated = list.filter((b) => b.id !== id);
    await store.setJSON("reservas", updated);
    return response(updated);
  }
  return response({ error: "Método não permitido." }, 405);
};

export const config = { path: "/api/bookings" };
