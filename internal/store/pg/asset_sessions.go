package pg

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/store"
)

type PGAssetSessionStore struct{ db *sql.DB }

func NewPGAssetSessionStore(db *sql.DB) *PGAssetSessionStore {
	return &PGAssetSessionStore{db: db}
}

func (s *PGAssetSessionStore) Create(ctx context.Context, assetID, assetType, sessionKey string) (*store.AssetSession, error) {
	tenantID := store.TenantIDFromContext(ctx)

	// Check if association already exists to avoid duplicates
	var exists bool
	_ = s.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM asset_sessions WHERE tenant_id = $1 AND asset_id = $2 AND asset_type = $3 AND session_key = $4)`,
		tenantID, assetID, assetType, sessionKey,
	).Scan(&exists)
	if exists {
		return nil, nil
	}

	row := &store.AssetSession{}
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO asset_sessions (tenant_id, asset_id, asset_type, session_key)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, tenant_id, asset_id, asset_type, session_key, created_at`,
		tenantID, assetID, assetType, sessionKey,
	).Scan(&row.ID, &row.TenantID, &row.AssetID, &row.AssetType, &row.SessionKey, &row.CreatedAt)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (s *PGAssetSessionStore) ListByAsset(ctx context.Context, assetID, assetType string) ([]store.AssetSession, error) {
	tenantID := store.TenantIDFromContext(ctx)
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, tenant_id, asset_id, asset_type, session_key, created_at
		 FROM asset_sessions
		 WHERE tenant_id = $1 AND asset_id = $2 AND asset_type = $3
		 ORDER BY created_at DESC`,
		tenantID, assetID, assetType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []store.AssetSession
	for rows.Next() {
		var r store.AssetSession
		if err := rows.Scan(&r.ID, &r.TenantID, &r.AssetID, &r.AssetType, &r.SessionKey, &r.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *PGAssetSessionStore) Delete(ctx context.Context, id uuid.UUID) error {
	tenantID := store.TenantIDFromContext(ctx)
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM asset_sessions WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}
