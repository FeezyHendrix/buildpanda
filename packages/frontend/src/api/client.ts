import axios from "axios";
import { toast } from "@/lib/toast";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/auth/sign-in";
    } else if (error.response?.status === 403) {
      const message =
        (error.response.data as { error?: string } | undefined)?.error ??
        "You do not have permission to perform this action.";
      toast(message, "error");
    }
    return Promise.reject(error);
  }
);

export default api;
