package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/nextlevelbuilder/goclaw/internal/store"
	"github.com/nextlevelbuilder/goclaw/internal/troy"
)

// TroyHandler exposes Troy asset management endpoints.
type TroyHandler struct {
	client        *troy.Client
	assetSessions store.AssetSessionStore
	sessions      store.SessionStore
}

func NewTroyHandler(client *troy.Client, assetSessions store.AssetSessionStore, sessions store.SessionStore) *TroyHandler {
	return &TroyHandler{client: client, assetSessions: assetSessions, sessions: sessions}
}

func (h *TroyHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/troy/locations", requireAuth("", h.handleLocations))
	mux.HandleFunc("GET /v1/troy/devices", requireAuth("", h.handleDevices))
	mux.HandleFunc("GET /v1/troy/asset-sessions", requireAuth("", h.handleListAssetSessions))
	mux.HandleFunc("POST /v1/troy/asset-sessions", requireAuth("", h.handleCreateAssetSession))
	mux.HandleFunc("DELETE /v1/troy/asset-sessions/{id}", requireAuth("", h.handleDeleteAssetSession))
}

func (h *TroyHandler) handleLocations(w http.ResponseWriter, r *http.Request) {
	page := parseNonNegativeInt(r.URL.Query().Get("page"), 0)
	limit := parsePositiveInt(r.URL.Query().Get("limit"), 50)

	result, err := h.client.GetLocations(r.Context(), page, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, "TROY_API_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *TroyHandler) handleDevices(w http.ResponseWriter, r *http.Request) {
	locationIDStr := r.URL.Query().Get("location_id")
	if locationIDStr == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "location_id required")
		return
	}
	locationID, err := strconv.Atoi(locationIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid location_id")
		return
	}
	page := parseNonNegativeInt(r.URL.Query().Get("page"), 0)
	limit := parsePositiveInt(r.URL.Query().Get("limit"), 50)

	result, err := h.client.GetDevices(r.Context(), locationID, page, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, "TROY_API_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *TroyHandler) handleListAssetSessions(w http.ResponseWriter, r *http.Request) {
	assetID := r.URL.Query().Get("asset_id")
	assetType := r.URL.Query().Get("asset_type")
	if assetID == "" || assetType == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "asset_id and asset_type required")
		return
	}

	sessions, err := h.assetSessions.ListByAsset(r.Context(), assetID, assetType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "STORE_ERROR", err.Error())
		return
	}

	// Enrich with session labels from the session store
	type enriched struct {
		store.AssetSession
		Label        string `json:"label,omitempty"`
		MessageCount int    `json:"messageCount"`
	}
	result := make([]enriched, 0, len(sessions))
	for _, s := range sessions {
		e := enriched{AssetSession: s}
		if h.sessions != nil {
			if sd := h.sessions.Get(r.Context(), s.SessionKey); sd != nil {
				e.Label = sd.Label
				e.MessageCount = len(sd.Messages)
			}
		}
		result = append(result, e)
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": result})
}

func (h *TroyHandler) handleCreateAssetSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AssetID    string `json:"assetId"`
		AssetType  string `json:"assetType"`
		SessionKey string `json:"sessionKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid body")
		return
	}
	if body.AssetID == "" || body.AssetType == "" || body.SessionKey == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "assetId, assetType, sessionKey required")
		return
	}

	session, err := h.assetSessions.Create(r.Context(), body.AssetID, body.AssetType, body.SessionKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "STORE_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, session)

	// Seed session metadata with device context for the IoT data pipeline.
	// Done after response to avoid blocking the client.
	if body.AssetType == "device" && h.sessions != nil {
		h.sessions.SetSessionMetadata(r.Context(), body.SessionKey, map[string]string{
			"iot_device_id": body.AssetID,
		})
	}
}

func (h *TroyHandler) handleDeleteAssetSession(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid id")
		return
	}

	if err := h.assetSessions.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "STORE_ERROR", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
