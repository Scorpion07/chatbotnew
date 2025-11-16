import axios from "axios";
import { config } from "../config.js";


const apiClient = axios.create({
  baseURL: config.api.baseUrl,  // NO getApiUrl() here
  withCredentials: true,
});

// Attach token to all requests if present
apiClient.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers = req.headers || {};
    req.headers["Authorization"] = `Bearer ${token}`;
  }
  return req;
});

export default apiClient;
