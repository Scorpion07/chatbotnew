import axios from "axios";
import { config } from "../config.js";

const apiClient = axios.create({
  baseURL: config.api.baseUrl,  // NO getApiUrl() here
  withCredentials: true,
});

export default apiClient;
