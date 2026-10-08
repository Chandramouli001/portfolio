// API base URL. Create React App: set REACT_APP_API_URL in frontend/.env (restart after changing).
let BASE = "http://localhost:5000";
try {
  BASE = process.env.REACT_APP_API_URL || BASE;
} catch {
  /* process not defined (e.g. Vite) -> keep default */
}
export const API_BASE = BASE;

const request = async (path, opts = {}) => {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch {
    throw Object.assign(
      new Error(`Cannot reach the API at ${BASE}. Is the server running (npm run dev inside /server)? Also check CORS / CLIENT_ORIGIN.`),
      { status: 0 }
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const health = () => request("/api/health");
export const getPortfolio = () => request("/api/portfolio");
export const getCollection = (col) => request(`/api/${col}`);
export const getProfile = () => request("/api/profile");

export const login = (password) =>
  request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

// list items (multipart so images can be attached)
export const saveItem = (token, col, data, id) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => v != null && fd.append(k, v));
  return request(`/api/${col}${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    headers: authHeader(token),
    body: fd,
  });
};

export const deleteItem = (token, col, id) =>
  request(`/api/${col}/${id}`, { method: "DELETE", headers: authHeader(token) });

// profile (single document)
export const saveProfile = (token, data) =>
  request("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(data),
  });

export const uploadPhoto = (token, file) => {
  const fd = new FormData();
  fd.append("image", file);
  return request("/api/profile/photo", { method: "POST", headers: authHeader(token), body: fd });
};