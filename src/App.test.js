import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

let originalFetch;
let warnSpy;
let errorSpy;

beforeAll(() => {
  originalFetch = global.fetch;
});

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.reject(new Error("Network disabled in tests")));
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  warnSpy?.mockRestore();
  errorSpy?.mockRestore();
});

function renderWithRouter(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>
  );
}

test("shows login page by default when not authed", () => {
  renderWithRouter();
  expect(screen.getByText(/enter password/i)).toBeInTheDocument();
});

test("navigates to calculator page (requires login)", async () => {
  // Go directly to /calculator to trigger redirect to login
  renderWithRouter(["/calculator"]);
  expect(await screen.findByText(/enter password/i)).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/password/i), "password12");
  await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(await screen.findByRole("button", { name: /add expression/i })).toBeInTheDocument();
});

test("navigates to weather page (requires login)", async () => {
  renderWithRouter(["/weather"]);
  expect(await screen.findByText(/enter password/i)).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/password/i), "password12");
  await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(await screen.findByText(/weather explorer/i)).toBeInTheDocument();
});
