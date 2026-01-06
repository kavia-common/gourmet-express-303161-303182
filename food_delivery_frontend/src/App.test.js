import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login screen entrypoint", () => {
  render(<App />);
  const heading = screen.getByText(/sign in/i);
  expect(heading).toBeInTheDocument();
});
