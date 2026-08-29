import { useEffect, useState } from "react";
import { ThemeContext } from "./themeContextValue";

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
