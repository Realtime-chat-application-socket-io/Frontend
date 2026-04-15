import axios from "axios";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:8000/api" : (import.meta.env.VITE_BACKEND_URL || "https://chatify-nesy.onrender.com/api");

console.log("BASE_URL:", BASE_URL);

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

