CREATE TABLE IF NOT EXISTS ai_settings (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  base_url VARCHAR(512) NOT NULL,
  model VARCHAR(255) NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_iv CHAR(24) NOT NULL,
  api_key_auth_tag CHAR(24) NOT NULL,
  api_key_version INT NOT NULL DEFAULT 1,
  health_status ENUM('unknown', 'healthy', 'unhealthy') NOT NULL DEFAULT 'unknown',
  health_message VARCHAR(500) NULL,
  last_health_checked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_ai_settings_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_old_ai_settings_tables := (
  SELECT COUNT(*) = 2
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('ai_providers', 'ai_provider_models')
);

SET @migrate_ai_settings_sql := IF(
  @has_old_ai_settings_tables,
  'INSERT INTO ai_settings (
     id, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
     health_status, health_message, last_health_checked_at, created_at, updated_at
   )
   SELECT
     ''default'', providers.base_url, models.model_id,
     providers.api_key_ciphertext, providers.api_key_iv, providers.api_key_auth_tag, providers.api_key_version,
     providers.health_status, providers.health_message, providers.last_health_checked_at,
     providers.created_at, providers.updated_at
   FROM ai_providers providers
   INNER JOIN ai_provider_models models ON models.provider_id = providers.id
   WHERE providers.status = ''enabled''
     AND providers.is_default = 1
     AND models.enabled = 1
     AND models.is_default = 1
   ORDER BY providers.updated_at DESC, models.updated_at DESC
   LIMIT 1
   ON DUPLICATE KEY UPDATE
     base_url = VALUES(base_url),
     model = VALUES(model),
     api_key_ciphertext = VALUES(api_key_ciphertext),
     api_key_iv = VALUES(api_key_iv),
     api_key_auth_tag = VALUES(api_key_auth_tag),
     api_key_version = VALUES(api_key_version),
     health_status = VALUES(health_status),
     health_message = VALUES(health_message),
     last_health_checked_at = VALUES(last_health_checked_at),
     updated_at = VALUES(updated_at)',
  'SELECT 1'
);

PREPARE migrate_ai_settings_stmt FROM @migrate_ai_settings_sql;
EXECUTE migrate_ai_settings_stmt;
DEALLOCATE PREPARE migrate_ai_settings_stmt;
