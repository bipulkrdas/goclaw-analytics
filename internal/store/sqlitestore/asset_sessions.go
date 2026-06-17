//go:build sqlite || sqliteonly

package sqlitestore

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/store"
)

type SQLiteAssetSessionStore struct{ db *sql.DB }

func NewSQLiteAssetSessionStore(db *sql.DB) *SQLiteAssetSessionStore {
	return &SQLiteAssetSessionStore{db: db}
}

func (s *SQLiteAssetSessionStore) Create(ctx context.Context, assetID, assetType, sessionKey string) (*store.AssetSession, error) {
	tenantID := store.TenantIDFromContext(ctx)
	id := uuid.New()
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO asset_sessions (id, tenant_id, asset_id, asset_type, session_key, created_at)
		 VALUES (?, ?, ?, ?, ?, datetime('now'))`,
		id.String(), tenantID.String(), assetID, assetType, sessionKey,
	)
	if err != nil {
		return nil, err
	}
	row := &store.AssetSession{
		ID: id, TenantID: tenantID, AssetID: assetID, AssetType: assetType, SessionKey: sessionKey,
	}
	return row, nil
}

func (s *SQLiteAssetSessionStore) ListByAsset(ctx context.Context, assetID, assetType string) ([]store.AssetSession, error) {
	tenantID := store.TenantIDFromContext(ctx)
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, tenant_id, asset_id, asset_type, session_key, created_at
		 FROM asset_sessions
		 WHERE tenant_id = ? AND asset_id = ? AND asset_type = ?
		 ORDER BY created_at DESC`,
		tenantID.String(), assetID, assetType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []store.AssetSession
	for rows.Next() {
		var r store.AssetSession
		var idStr, tenantStr string
		if err := rows.Scan(&idStr, &tenantStr, &r.AssetID, &r.AssetType, &r.SessionKey, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.ID, _ = uuid.Parse(idStr)
		r.TenantID, _ = uuid.Parse(tenantStr)
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *SQLiteAssetSessionStore) Delete(ctx context.Context, id uuid.UUID) error {
	tenantID := store.TenantIDFromContext(ctx)
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM asset_sessions WHERE id = ? AND tenant_id = ?`,
		id.String(), tenantID.String(),
	)
	return err
}
