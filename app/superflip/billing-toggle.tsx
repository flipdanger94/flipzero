"use client";

import { useState } from "react";
import styles from "./superflip.module.css";

export default function BillingToggle() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className={styles.billing} aria-label="Период оплаты">
      <div className={styles.billingToggle} role="group" aria-label="Выберите период">
        <button type="button" className={!annual ? styles.active : ""} onClick={() => setAnnual(false)}>Месяц</button>
        <button type="button" className={annual ? styles.active : ""} onClick={() => setAnnual(true)}>Год</button>
      </div>
      <div className={styles.price}>
        <strong>{annual ? "$49.99" : "$4.99"}</strong>
        <span>{annual ? "/ год" : "/ месяц"}</span>
      </div>
    </div>
  );
}
