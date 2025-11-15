import axios from 'axios';
import config, { getApiUrl } from '../config';

// Create axios instance using clean base URL
const apiClient = axios.create({
  baseURL: config.api.baseUrl,
  withCredentials: true,
});

export default apiClient;
