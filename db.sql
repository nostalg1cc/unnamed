-- P2P Web Chat Database Schema (MySQL Compatible)
-- Version 1.0

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for Users
-- ----------------------------
DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary Key, internal DB ID',
  `user_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Human-readable, server-generated 16-20 char alphanumeric, unique public ID',
  `username` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'User chosen display name, unique',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Nullable if Passkeys are primary auth',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'User email, unique, nullable',
  `profile_picture_url` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'URL of current live profile picture (e.g., path on server or CDN)',
  `search_visibility` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = hidden from search, 1 = visible in search',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_id` (`user_id`),
  UNIQUE KEY `uq_username` (`username`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores user account information';

-- ----------------------------
-- Table structure for UsernameHistory
-- ----------------------------
DROP TABLE IF EXISTS `UsernameHistory`;
CREATE TABLE `UsernameHistory` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id_fk` bigint unsigned NOT NULL COMMENT 'FK to Users.id',
  `old_username` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usernamehistory_user_id` (`user_id_fk`),
  CONSTRAINT `fk_usernamehistory_user` FOREIGN KEY (`user_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores history of username changes for moderation';

-- ----------------------------
-- Table structure for ProfilePictureHistory
-- ----------------------------
DROP TABLE IF EXISTS `ProfilePictureHistory`;
CREATE TABLE `ProfilePictureHistory` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id_fk` bigint unsigned NOT NULL COMMENT 'FK to Users.id',
  `storage_path` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Path to compressed old picture on server',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when this historical record can be purged (e.g., 1 year from changed_at)',
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_profilepicturehistory_user_id` (`user_id_fk`),
  CONSTRAINT `fk_profilepicturehistory_user` FOREIGN KEY (`user_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores history of profile pictures for moderation';

-- ----------------------------
-- Table structure for Passkeys
-- ----------------------------
DROP TABLE IF EXISTS `Passkeys`;
CREATE TABLE `Passkeys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id_fk` bigint unsigned NOT NULL COMMENT 'FK to Users.id',
  `credential_id_base64` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Base64URL encoded raw ID from authenticator',
  `public_key_cose` blob NOT NULL COMMENT 'COSE-encoded public key',
  `transports` json NULL COMMENT 'JSON array of transports, e.g., ["internal", "usb", "nfc", "ble"]',
  `backup_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `backup_state` tinyint(1) NOT NULL DEFAULT 0,
  `sign_count` bigint unsigned NOT NULL DEFAULT 0,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_credential_id` (`credential_id_base64`),
  KEY `idx_passkeys_user_id` (`user_id_fk`),
  CONSTRAINT `fk_passkeys_user` FOREIGN KEY (`user_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores user passkey credentials';

-- ----------------------------
-- Table structure for Friendships
-- ----------------------------
DROP TABLE IF EXISTS `Friendships`;
CREATE TABLE `Friendships` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user1_id_fk` bigint unsigned NOT NULL COMMENT 'ID of the user who initiated or is user1 in the pair',
  `user2_id_fk` bigint unsigned NOT NULL COMMENT 'ID of the user who received or is user2 in the pair',
  `status` enum('pending_user1_to_user2','pending_user2_to_user1','accepted','blocked_by_user1','blocked_by_user2','declined') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_friendship_pair` (`user1_id_fk`,`user2_id_fk`),
  KEY `idx_friendships_user2` (`user2_id_fk`),
  CONSTRAINT `fk_friendships_user1` FOREIGN KEY (`user1_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_friendships_user2` FOREIGN KEY (`user2_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_friendship_users_different` CHECK ((`user1_id_fk` <> `user2_id_fk`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores friendship relationships and requests';

-- ----------------------------
-- Table structure for DirectMessageRooms
-- ----------------------------
DROP TABLE IF EXISTS `DirectMessageRooms`;
CREATE TABLE `DirectMessageRooms` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Represents a direct message chat room between users';

-- ----------------------------
-- Table structure for DirectMessageRoomParticipants
-- ----------------------------
DROP TABLE IF EXISTS `DirectMessageRoomParticipants`;
CREATE TABLE `DirectMessageRoomParticipants` (
  `room_id_fk` bigint unsigned NOT NULL,
  `user_id_fk` bigint unsigned NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`room_id_fk`,`user_id_fk`),
  KEY `idx_dmparticipants_user` (`user_id_fk`),
  CONSTRAINT `fk_dmparticipants_room` FOREIGN KEY (`room_id_fk`) REFERENCES `DirectMessageRooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dmparticipants_user` FOREIGN KEY (`user_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Associates users with direct message rooms';

-- ----------------------------
-- Table structure for Messages
-- ----------------------------
DROP TABLE IF EXISTS `Messages`;
CREATE TABLE `Messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `room_id_fk` bigint unsigned NOT NULL COMMENT 'FK to DirectMessageRooms.id (or later, Channel.id)',
  `sender_id_fk` bigint unsigned NOT NULL COMMENT 'FK to Users.id',
  `content_type` enum('text','image','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `text_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `media_storage_path` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Internal server path to the media file',
  `media_filename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `media_mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `media_size_bytes` bigint NULL DEFAULT NULL,
  `media_expires_at` timestamp NULL DEFAULT NULL COMMENT 'For large files with temporary storage (e.g., 30 days)',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_room_id` (`room_id_fk`),
  KEY `idx_messages_sender_id` (`sender_id_fk`),
  CONSTRAINT `fk_messages_room` FOREIGN KEY (`room_id_fk`) REFERENCES `DirectMessageRooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores messages for DMs and group channels';

-- ----------------------------
-- Table structure for Groups (Future Phase Stub)
-- ----------------------------
DROP TABLE IF EXISTS `Groups`;
CREATE TABLE `Groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique public ID for the group',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id_fk` bigint unsigned NOT NULL COMMENT 'FK to Users.id',
  `icon_url` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_id` (`group_id`),
  KEY `idx_groups_owner_id` (`owner_id_fk`),
  CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_id_fk`) REFERENCES `Users` (`id`) ON DELETE RESTRICT -- Or SET NULL if owner can delete account but group remains
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores information about user-created groups';

-- ----------------------------
-- Table structure for GroupMembers (Future Phase Stub)
-- ----------------------------
DROP TABLE IF EXISTS `GroupMembers`;
CREATE TABLE `GroupMembers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id_fk` bigint unsigned NOT NULL,
  `user_id_fk` bigint unsigned NOT NULL,
  `role_id_fk` bigint unsigned NULL DEFAULT NULL COMMENT 'FK to GroupRoles.id, NULL for default group role',
  `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_group_member` (`group_id_fk`,`user_id_fk`),
  KEY `idx_groupmembers_user` (`user_id_fk`),
  KEY `idx_groupmembers_role` (`role_id_fk`),
  CONSTRAINT `fk_groupmembers_group` FOREIGN KEY (`group_id_fk`) REFERENCES `Groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_groupmembers_user` FOREIGN KEY (`user_id_fk`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_groupmembers_role` FOREIGN KEY (`role_id_fk`) REFERENCES `GroupRoles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Associates users with groups and their roles';

-- ----------------------------
-- Table structure for GroupRoles (Future Phase Stub)
-- ----------------------------
DROP TABLE IF EXISTS `GroupRoles`;
CREATE TABLE `GroupRoles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id_fk` bigint unsigned NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissions` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Bitmask for granular permissions',
  `is_default_role` tinyint(1) NOT NULL DEFAULT 0 COMMENT '@everyone role for the group',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_grouproles_group` (`group_id_fk`),
  CONSTRAINT `fk_grouproles_group` FOREIGN KEY (`group_id_fk`) REFERENCES `Groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Defines roles within a group and their permissions';

-- Example Group Permissions (Conceptual - for backend logic, store as bits in 'permissions' field)
-- VIEW_CHANNELS_AND_GROUP_INFO (0x1)
-- SEND_MESSAGES_IN_TEXT_CHANNELS (0x2)
-- SEND_TTS_MESSAGES (0x4)
-- MANAGE_MESSAGES (delete others messages, pin) (0x8)
-- EMBED_LINKS (0x10)
-- ATTACH_FILES (0x20)
-- READ_MESSAGE_HISTORY (0x40)
-- MENTION_EVERYONE_HERE_ALL_ROLES (0x80)
-- USE_EXTERNAL_EMOJIS (0x100)
-- ADD_REACTIONS (0x200)
-- --- Voice Channel Permissions ---
-- CONNECT_TO_VOICE (0x400)
-- SPEAK_IN_VOICE (0x800)
-- VIDEO_IN_VOICE (screen share, camera) (0x1000)
-- MUTE_MEMBERS_VOICE (0x2000)
-- DEAFEN_MEMBERS_VOICE (0x4000)
-- MOVE_MEMBERS_VOICE (0x8000)
-- USE_VOICE_ACTIVITY (vs. Push-to-Talk) (0x10000)
-- PRIORITY_SPEAKER (0x20000)
-- --- Moderation/Management Permissions ---
-- CREATE_INSTANT_INVITE (0x40000)
-- KICK_MEMBERS (0x80000)
-- BAN_MEMBERS (0x100000)
-- MANAGE_CHANNELS (create, delete, edit channels & categories) (0x200000)
-- MANAGE_ROLES (create, delete, edit roles below this one) (0x400000)
-- MANAGE_NICKNAMES (change own/others nicknames) (0x800000)
-- MANAGE_WEBHOOKS (0x1000000)
-- MANAGE_GROUP_SETTINGS (name, icon, region) (0x2000000)
-- ADMINISTRATOR (all permissions) (0x800000000) -- Use with extreme caution

-- ----------------------------
-- Table structure for Channels (Future Phase Stub)
-- ----------------------------
DROP TABLE IF EXISTS `Channels`;
CREATE TABLE `Channels` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id_fk` bigint unsigned NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','voice') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `topic` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Channel topic for text channels',
  `position` int unsigned NOT NULL DEFAULT 0 COMMENT 'For ordering channels in a list',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_channels_group` (`group_id_fk`),
  CONSTRAINT `fk_channels_group` FOREIGN KEY (`group_id_fk`) REFERENCES `Groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores channels within groups';

-- ----------------------------
-- Table structure for ChannelPermissionOverrides (Future Phase Stub)
-- ----------------------------
DROP TABLE IF EXISTS `ChannelPermissionOverrides`;
CREATE TABLE `ChannelPermissionOverrides` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `channel_id_fk` bigint unsigned NOT NULL,
  `target_type` enum('role','user') NOT NULL,
  `target_id_fk` bigint unsigned NOT NULL COMMENT 'FK to GroupRoles.id or Users.id based on target_type',
  `allow_bits` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Bitmask of allowed permissions',
  `deny_bits` bigint unsigned NOT NULL DEFAULT 0 COMMENT 'Bitmask of denied permissions',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_channel_override` (`channel_id_fk`, `target_type`, `target_id_fk`),
  CONSTRAINT `fk_channelpermissionoverrides_channel` FOREIGN KEY (`channel_id_fk`) REFERENCES `Channels` (`id`) ON DELETE CASCADE
  -- Note: FK for target_id_fk would need to be conditional or handled by application logic,
  -- or use separate tables for role_overrides and user_overrides.
  -- For simplicity here, it's a single field; backend must validate target_id_fk based on target_type.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Permission overrides for roles/users on specific channels';


SET FOREIGN_KEY_CHECKS = 1;
