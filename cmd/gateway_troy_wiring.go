package cmd

import (
	"context"
	"log/slog"
	"os"

	httpapi "github.com/nextlevelbuilder/goclaw/internal/http"
	"github.com/nextlevelbuilder/goclaw/internal/troy"
)

// wireTroyHandler initializes the Troy external API client and registers the HTTP handler.
// Configuration comes from environment variables:
//   - TROY_AUTH_URL (default: https://auth.mydevices.com)
//   - TROY_API_URL (default: https://api.mydevices.com)
//   - TROY_REALM (default: spenergy)
//   - TROY_CLIENT_ID
//   - TROY_CLIENT_SECRET
//   - TROY_COMPANY_NAME
func wireTroyHandler(d *gatewayDeps) {
	clientID := os.Getenv("TROY_CLIENT_ID")
	clientSecret := os.Getenv("TROY_CLIENT_SECRET")
	companyName := os.Getenv("TROY_COMPANY_NAME")

	if clientID == "" || clientSecret == "" || companyName == "" {
		slog.Debug("troy: disabled (TROY_CLIENT_ID, TROY_CLIENT_SECRET, TROY_COMPANY_NAME required)")
		return
	}

	authURL := os.Getenv("TROY_AUTH_URL")
	if authURL == "" {
		authURL = "https://auth.mydevices.com"
	}
	apiURL := os.Getenv("TROY_API_URL")
	if apiURL == "" {
		apiURL = "https://api.mydevices.com"
	}
	realm := os.Getenv("TROY_REALM")
	if realm == "" {
		realm = "spenergy"
	}

	cfg := troy.Config{
		AuthURL:      authURL,
		APIURL:       apiURL,
		Realm:        realm,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		CompanyName:  companyName,
	}

	client := troy.NewClient(cfg)

	ctx := context.Background()

	// Dev mode: reuse existing tokens from env to avoid re-authenticating on every restart.
	if at := os.Getenv("TROY_ACCESS_TOKEN"); at != "" {
		client.SetToken(at, os.Getenv("TROY_REFRESH_TOKEN"), 86400)
		slog.Info("troy: using access token from env (dev mode)")
	} else {
		if err := client.Authenticate(ctx); err != nil {
			slog.Error("troy: authentication failed", "error", err)
			return
		}
	}
	if _, err := client.ResolveCompany(ctx); err != nil {
		slog.Error("troy: company resolution failed", "error", err)
		return
	}
	slog.Info("troy: initialized", "company", client.GetCompany().Name)

	if d.pgStores != nil && d.pgStores.AssetSessions != nil {
		d.server.SetTroyHandler(httpapi.NewTroyHandler(client, d.pgStores.AssetSessions, d.pgStores.Sessions))
	}
}
