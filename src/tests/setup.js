import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const memoryStore = {};

const localStorageMock = {
  getItem: vi.fn((key) => (key in memoryStore ? memoryStore[key] : null)),
  setItem: vi.fn((key, value) => {
    memoryStore[key] = String(value);
  }),
  removeItem: vi.fn((key) => {
    delete memoryStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
  }),
  key: vi.fn((index) => Object.keys(memoryStore)[index] || null),
  get length() {
    return Object.keys(memoryStore).length;
  },
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
});

afterEach(() => {
  cleanup();
});
