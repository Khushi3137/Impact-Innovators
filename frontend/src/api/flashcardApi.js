import api from "./axios";

export const getFlashcards = async (params = {}) => {
  const res = await api.get("/flashcards", { params });
  return res.data;
};

export const createFlashcard = async (data) => {
  const res = await api.post("/flashcards", data);
  return res.data;
};

export const reviewFlashcard = async (id, performance) => {
  const res = await api.post(`/flashcards/${id}/review`, { performance });
  return res.data;
};

export const deleteFlashcard = async (id) => {
  const res = await api.delete(`/flashcards/${id}`);
  return res.data;
};

export const getFlashcardStats = async () => {
  const res = await api.get("/flashcards/stats");
  return res.data;
};
