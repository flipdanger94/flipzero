export type SafetyCategory = "threat" | "fraud" | "personal_data" | "harassment" | "spam";

export type SafetyAssessment = {
  flagged: boolean;
  category: SafetyCategory | null;
  severity: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  signals: string[];
  autoHide: boolean;
};

const categoryLabels: Record<SafetyCategory, string> = {
  threat: "Возможная угроза или призыв к насилию",
  fraud: "Признаки мошеннического предложения",
  personal_data: "Публикация контактных или платёжных данных",
  harassment: "Оскорбление или травля участника",
  spam: "Массовый спам или навязчивая реклама",
};

export function assessMessageSafety(rawContent: string): SafetyAssessment {
  const content = rawContent.normalize("NFKC").trim();
  if (!content) return { flagged: false, category: null, severity: "low", confidence: 0, summary: "", signals: [], autoHide: false };

  const lower = content.toLocaleLowerCase("ru");
  const scores = new Map<SafetyCategory, number>();
  const signals: string[] = [];
  const add = (category: SafetyCategory, points: number, signal: string) => {
    scores.set(category, (scores.get(category) ?? 0) + points);
    if (!signals.includes(signal)) signals.push(signal);
  };

  const urls = content.match(/https?:\/\/\S+|(?:www\.)\S+/gi) ?? [];
  const mentions = content.match(/@[\p{L}\p{N}_-]+/gu) ?? [];
  if (/(?:я\s+тебя\s+убью|убью\s+тебя|найду\s+и\s+убью|сдохни|i\s+will\s+kill\s+you|kill\s+you)/iu.test(lower)) add("threat", 100, "Выражение прямой угрозы");
  if (/(?:туп(?:ой|ая)|идиот|дебил|заткнись|ненавижу\s+тебя|moron|idiot|shut\s+up)/iu.test(lower)) add("harassment", 52, "Агрессивное обращение к участнику");
  if (urls.length && /(?:крипт|инвест|гарантир|доход|выиграл|приз|розыгрыш|удвой|кошел[её]к|crypto|giveaway|guaranteed\s+profit)/iu.test(lower)) add("fraud", 72, "Ссылка сочетается с обещанием выгоды");
  if (/(?:\b\d[ -]*?){13,19}\b/u.test(content)) add("personal_data", 64, "Обнаружена последовательность, похожая на платёжные данные");
  if (/(?:\+?\d[\d ()-]{8,}\d)|(?:[\w.+-]+@[\w.-]+\.[a-z]{2,})/iu.test(content)) add("personal_data", 48, "Обнаружены контактные данные");
  if (urls.length >= 3) add("spam", 68, "Несколько внешних ссылок в одном сообщении");
  if (mentions.length >= 5) add("spam", 55, "Массовое упоминание участников");
  if (/(.)\1{7,}/iu.test(content)) add("spam", 48, "Чрезмерно повторяющиеся символы");
  const letters = content.match(/[\p{L}]/gu) ?? [];
  const uppercase = content.match(/[\p{Lu}]/gu) ?? [];
  if (letters.length >= 30 && uppercase.length / letters.length > 0.78) add("spam", 34, "Большая часть сообщения написана заглавными буквами");

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [category, score = 0] = ranked[0] ?? [];
  if (!category || score < 45) return { flagged: false, category: null, severity: "low", confidence: 0, summary: "", signals: [], autoHide: false };
  const severity = score >= 85 ? "high" : "medium";
  return {
    flagged: true,
    category,
    severity,
    confidence: Math.min(99, Math.round(48 + score / 2)),
    summary: categoryLabels[category],
    signals,
    autoHide: severity === "high",
  };
}
