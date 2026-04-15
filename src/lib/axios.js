import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:8000/api"
    : "https://chatify-nesy.onrender.com/api";

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
});

// 🔥 SAFE INTERCEPTOR (THIS FIXES YOUR BUG)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("chatify_token");

    if (!config.headers) {
      config.headers = {}; // 🔥 prevents crash
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);