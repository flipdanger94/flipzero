export function normalizeVoiceUserLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw new RangeError("USER_LIMIT_OUT_OF_RANGE");
  }
  return number;
}

export function canJoinVoiceChannel({
  userLimit,
  participantCount,
  alreadyConnected,
  canManage,
}: {
  userLimit: number | null;
  participantCount: number;
  alreadyConnected: boolean;
  canManage: boolean;
}) {
  if (alreadyConnected || canManage || userLimit === null) return true;
  return participantCount < userLimit;
}
