import axios from "axios";

export const getHealth = async () => {
  const apiUrl = import.meta.env.VITE_API_URL || "/api";
  const baseUrl = apiUrl.replace(/\/api\/?$/, "");
  const res = await axios.get(`${baseUrl}/health`);
  return res.data;
};
