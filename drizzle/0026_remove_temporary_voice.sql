DELETE FROM notifications
WHERE type = 'temporary_voice_invite'
   OR entity_type = 'temporary_voice';

DROP TABLE IF EXISTS temporary_voice_invites;
DROP TABLE IF EXISTS temporary_voice_rooms;
