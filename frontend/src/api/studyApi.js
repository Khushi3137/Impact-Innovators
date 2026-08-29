import api from "./axios";

export const getStudyStats = async (period = "week") => {
  const res = await api.get("/study/stats", { params: { period } });
  return res.data;
};

export const getStudySessions = async (params = {}) => {
  const res = await api.get("/study/sessions", { params });
  return res.data;
};

export const getTasks = async (params = {}) => {
  const res = await api.get("/study/tasks", { params });
  return res.data;
};

export const getStudyStreak = async () => {
  const res = await api.get("/study/streak");
  return res.data;
};

export const getTodayProgress = async () => {
  const res = await api.get("/study/today");
  return res.data;
};

export const startPomodoro = async (data) => {
  const res = await api.post("/study/pomodoro/start", data);
  return res.data;
};

export const endPomodoro = async (data) => {
  const res = await api.post("/study/pomodoro/end", data);
  return res.data;
};
