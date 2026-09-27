"use client";
export function ProfileMenu({
  isOwnProfile,
  isFriend,
  ignored,
  busy,
  onFull,
  onIgnore,
  onFriend,
  onBlock,
  onReport,
  onCopy,
}: {
  isOwnProfile: boolean;
  isFriend: boolean;
  ignored: boolean;
  busy: boolean;
  onFull: () => void;
  onIgnore: () => void;
  onFriend: () => void;
  onBlock: () => void;
  onReport: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="fz-profile-menu" aria-label="Действия с профилем">
      <button onClick={onFull}>Полный профиль</button>
      {!isOwnProfile ? (
        <>
          <button onClick={onIgnore}>
            {ignored ? "Не игнорировать" : "Игнорировать"}
          </button>
          {isFriend ? (
            <button disabled={busy} onClick={onFriend}>
              Удалить из друзей
            </button>
          ) : null}
          <i />
          <button disabled={busy} className="danger" onClick={onBlock}>
            Заблокировать
          </button>
          <button className="danger" onClick={onReport}>
            Пожаловаться
          </button>
          <i />
        </>
      ) : null}
      <button onClick={onCopy}>Копировать ID</button>
    </div>
  );
}
