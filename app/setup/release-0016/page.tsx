"use client";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, Database, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import styles from "../release-0010/setup.module.css";

export default function Release0016Page(){
  const [status,setStatus]=useState<"idle"|"loading"|"success"|"error">("idle");
  const [message,setMessage]=useState("");
  async function apply(){
    setStatus("loading");
    const response=await fetch("/api/setup/release-0016",{method:"POST"});
    const result=await response.json();
    setMessage(result.message);
    setStatus(response.ok?"success":"error");
  }
  const success=status==="success";
  return <main className={styles.page}><div className={styles.glow}/><section className={styles.card}><div className={styles.brand}><span>FZ</span><strong>FlipZero</strong></div><div className={styles.icon}>{success?<CheckCircle2 size={31}/>:<Bell size={31}/>}</div><span className={styles.badge}><LockKeyhole size={14}/> Защищённая установка</span><p className={styles.release}>RELEASE 0016</p><h1>Пакет обновлений 0014–0016</h1><p className={styles.description}>Одним запуском устанавливает заявки на вступление, журнал действий сервера и постоянные настройки уведомлений.</p>{message?<div className={`${styles.notice} ${success?styles.success:styles.error}`}>{message}</div>:null}<button className={styles.action} onClick={()=>void apply()} disabled={status==="loading"||success}>{status==="loading"?<LoaderCircle className={styles.spinner}/>:<Database/>}{success?"Пакет установлен":"Установить обновления"}</button><Link className={styles.back} href="/app"><ArrowLeft size={15}/> Вернуться в FlipZero</Link></section></main>;
}
