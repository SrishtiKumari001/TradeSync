import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("minierp_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("minierp_token");
      localStorage.removeItem("minierp_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function getErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? "Something went wrong. Please try again.";
}

export default api;
