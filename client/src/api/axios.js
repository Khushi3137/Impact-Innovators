//this is to disable axios for the time being (until backend is ready)
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export default api;

// import axios from "axios";

// /*
//   Mock-safe axios instance.
//   Backend calls will fail silently.
// */
// const api = axios.create({
//   baseURL: "http://localhost:5000/api",
// });

// api.interceptors.response.use(
//   res => res,
//   err => {
//     console.warn("Backend not running (mock mode)");
//     return Promise.resolve({ data: {} });
//   }
// );

// export default api;

