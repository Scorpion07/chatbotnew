import axios from 'axios';
import { getApiUrl } from '../config';

// Centralized axios instance for API calls
const apiClient = axios.create({
	baseURL: getApiUrl(),
	withCredentials: true,
});

export default apiClient;
