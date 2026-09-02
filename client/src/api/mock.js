import MockAdapter from "axios-mock-adapter";
import api from "./axios";

// This sets the mock adapter on the default instance
const mock = new MockAdapter(api, { delayResponse: 500 });

// Mock login
mock.onPost("/auth/login").reply(config => {
  const { email, password } = JSON.parse(config.data);
  if (email === "test@test.com" && password === "123456") {
    return [200, { user: { name: "Test User", email } }];
  }
  return [401, { message: "Invalid credentials" }];
});

// Mock profile fetch
mock.onGet("/auth/profile").reply(200, {
  user: { name: "Test User", email: "test@test.com" },
});

// Mock flashcards
mock.onGet("/flashcards").reply(200, {
  cards: [
    { question: "What is React?", answer: "A JavaScript library for building UIs" },
    { question: "What is Vite?", answer: "A fast frontend build tool" },
  ],
});

// Mock summarizer
mock.onPost("/gemini/summarize").reply(200, {
  summary: "This is a mocked AI-generated summary for testing.",
});

// Mock study progress
mock.onGet("/study/progress").reply(200, [
  { date: "2025-12-28", hours: 2 },
  { date: "2025-12-29", hours: 3 },
  { date: "2025-12-30", hours: 1 },
]);

// Mock groups
mock.onGet("/groups").reply(200, {
  groups: [
    { _id: "1", name: "Math Study Group" },
    { _id: "2", name: "Physics Study Group" },
  ],
});

export default mock;
