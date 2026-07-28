"use client";

import { useEffect, useState } from "react";
import {
  ComponentLibraryProof,
  componentProofInventory,
} from "@/components/generated";
import styles from "./page.module.css";

type Theme = "light" | "dark";

export default function ComponentLibraryPage() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    return () => {
      root.dataset.theme = "light";
    };
  }, [theme]);

  const scenarios = componentProofInventory.reduce(
    (sum, component) => sum + component.scenarios.length,
    0,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Converter component release</p>
          <h1>Component library proof</h1>
          <p>
            {componentProofInventory.length} artifacts · {scenarios} authored scenarios
          </p>
        </div>
        <div className={styles.themes} aria-label="Theme">
          <button
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
            type="button"
          >
            Light
          </button>
          <button
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
            type="button"
          >
            Dark
          </button>
        </div>
      </header>
      <div className={styles.library}>
        <ComponentLibraryProof />
      </div>
    </div>
  );
}
