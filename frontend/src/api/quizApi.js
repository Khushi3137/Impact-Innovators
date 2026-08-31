import api from "./axios";

export const getSavedQuizzes = async () => {
  const res = await api.get("/quizzes");
  return res.data;
};

export const recordQuizAttempt = async (id, attempt) => {
  const res = await api.post(`/quizzes/${id}/attempts`, attempt);
  return res.data;
};

export const deleteSavedQuiz = async (id) => {
  const res = await api.delete(`/quizzes/${id}`);
  return res.data;
};
