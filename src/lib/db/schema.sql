CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  source_text MEDIUMTEXT NOT NULL,
  status ENUM('draft', 'generated', 'failed') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_projects_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS script_versions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  yaml MEDIUMTEXT NOT NULL,
  report_json JSON NOT NULL,
  validation_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_script_versions_project_created (project_id, created_at),
  CONSTRAINT fk_script_versions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generation_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  model VARCHAR(255) NOT NULL,
  status ENUM('running', 'succeeded', 'failed') NOT NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_generation_runs_project_created (project_id, created_at),
  CONSTRAINT fk_generation_runs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
