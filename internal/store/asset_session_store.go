package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// AssetSession links an external asset (location or device) to a chat session.
type AssetSession struct {
	ID        uuid.UUID `json:"id" db:"id"`
	TenantID  uuid.UUID `json:"tenantId" db:"tenant_id"`
	AssetID   string    `json:"assetId" db:"asset_id"`
	AssetType string    `json:"assetType" db:"asset_type"` // "location" or "device"
	SessionKey string   `json:"sessionKey" db:"session_key"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// AssetSessionStore manages asset-to-session associations.
type AssetSessionStore interface {
	Create(ctx context.Context, assetID, assetType, sessionKey string) (*AssetSession, error)
	ListByAsset(ctx context.Context, assetID, assetType string) ([]AssetSession, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
