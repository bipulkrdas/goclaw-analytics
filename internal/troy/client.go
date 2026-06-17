package troy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Config holds Troy API connection settings (loaded from env).
type Config struct {
	AuthURL      string // e.g. "https://auth.mydevices.com"
	APIURL       string // e.g. "https://api.mydevices.com"
	Realm        string // e.g. "spenergy"
	ClientID     string
	ClientSecret string
	CompanyName  string
}

// Company represents a company in the external API.
type Company struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	City     string `json:"city"`
	State    string `json:"state"`
	Zip      string `json:"zip"`
	Country  string `json:"country"`
	Timezone string `json:"timezone"`
}

// Location represents a location in the external API.
type Location struct {
	ID              int     `json:"id"`
	Name            string  `json:"name"`
	Industry        string  `json:"industry"`
	CompanyID       int     `json:"company_id"`
	Address         string  `json:"address"`
	City            string  `json:"city"`
	State           string  `json:"state"`
	Zip             string  `json:"zip"`
	Country         string  `json:"country"`
	Latitude        float64 `json:"latitude"`
	Longitude       float64 `json:"longitude"`
	Timezone        string  `json:"timezone"`
	Status          int     `json:"status"`
	SupportedDevice string  `json:"supported_device"`
	ParentID        *int    `json:"parent_id"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
}

// LocationsResponse wraps the paginated location API response.
type LocationsResponse struct {
	Count int        `json:"count"`
	Limit int        `json:"limit"`
	Page  int        `json:"page"`
	Rows  []Location `json:"rows"`
}

// Device represents a thing/device in the external API.
type Device struct {
	TinaID     int    `json:"tina_id"`
	ID         string `json:"id"`
	LocationID int    `json:"location_id"`
	CompanyID  int    `json:"company_id"`
	ThingName  string `json:"thing_name"`
	ThingType  int    `json:"thing_type"`
	SensorType string `json:"sensor_type"`
	SensorUse  string `json:"sensor_use"`
	HardwareID string `json:"hardware_id"`
	Status     int    `json:"status"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// DevicesResponse wraps the paginated device API response.
type DevicesResponse struct {
	Count int      `json:"count"`
	Limit int      `json:"limit"`
	Page  int      `json:"page"`
	Rows  []Device `json:"rows"`
}

// tokenData holds the current OAuth tokens.
type tokenData struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

// Client manages authentication and API calls to the Troy external service.
type Client struct {
	cfg    Config
	http   *http.Client
	mu     sync.RWMutex
	token  *tokenData
	company *Company
}

// NewClient creates a new Troy API client.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetToken sets pre-existing tokens (for dev mode to avoid re-auth on every restart).
func (c *Client) SetToken(accessToken, refreshToken string, expiresIn int64) {
	c.mu.Lock()
	c.token = &tokenData{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
	}
	c.mu.Unlock()
}

// Authenticate obtains an access token using client credentials.
func (c *Client) Authenticate(ctx context.Context) error {
	tokenURL := fmt.Sprintf("%s/auth/realms/%s/protocol/openid-connect/token", c.cfg.AuthURL, c.cfg.Realm)
	data := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret},
	}
	return c.fetchToken(ctx, tokenURL, data)
}

// RefreshAuth refreshes the access token using the refresh token.
func (c *Client) RefreshAuth(ctx context.Context) error {
	c.mu.RLock()
	rt := ""
	if c.token != nil {
		rt = c.token.RefreshToken
	}
	c.mu.RUnlock()
	if rt == "" {
		return c.Authenticate(ctx)
	}

	tokenURL := fmt.Sprintf("%s/auth/realms/%s/protocol/openid-connect/token", c.cfg.AuthURL, c.cfg.Realm)
	data := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret},
		"refresh_token": {rt},
	}
	return c.fetchToken(ctx, tokenURL, data)
}

func (c *Client) fetchToken(ctx context.Context, tokenURL string, data url.Values) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("troy auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("troy auth failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("troy auth decode: %w", err)
	}

	c.mu.Lock()
	c.token = &tokenData{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(result.ExpiresIn-60) * time.Second), // 60s buffer
	}
	c.mu.Unlock()
	return nil
}

// ensureToken checks if token is valid, refreshes if needed.
func (c *Client) ensureToken(ctx context.Context) (string, error) {
	c.mu.RLock()
	t := c.token
	c.mu.RUnlock()

	if t == nil {
		if err := c.Authenticate(ctx); err != nil {
			return "", err
		}
		c.mu.RLock()
		defer c.mu.RUnlock()
		return c.token.AccessToken, nil
	}
	if time.Now().After(t.ExpiresAt) {
		if err := c.RefreshAuth(ctx); err != nil {
			return "", err
		}
		c.mu.RLock()
		defer c.mu.RUnlock()
		return c.token.AccessToken, nil
	}
	return t.AccessToken, nil
}

// ResolveCompany finds the company by name (paginated search with best-match logic).
func (c *Client) ResolveCompany(ctx context.Context) (*Company, error) {
	c.mu.RLock()
	if c.company != nil {
		c.mu.RUnlock()
		return c.company, nil
	}
	c.mu.RUnlock()

	nameLower := strings.ToLower(c.cfg.CompanyName)
	const pageSize = 50
	page := 0
	var bestMatch *Company
	bestScore := -1

	for {
		params := url.Values{
			"limit": {fmt.Sprintf("%d", pageSize)},
			"page":  {fmt.Sprintf("%d", page)},
		}
		body, err := c.apiGet(ctx, "/v1.0/admin/companies", params)
		if err != nil {
			return nil, err
		}

		var wrapper struct {
			Count int       `json:"count"`
			Limit int       `json:"limit"`
			Page  int       `json:"page"`
			Rows  []Company `json:"rows"`
		}
		if err := json.Unmarshal(body, &wrapper); err != nil {
			return nil, fmt.Errorf("parse companies: %w", err)
		}
		companies := wrapper.Rows
		if len(companies) == 0 {
			break
		}

		for i := range companies {
			cNameLower := strings.ToLower(companies[i].Name)
			if cNameLower == nameLower {
				c.mu.Lock()
				c.company = &companies[i]
				c.mu.Unlock()
				return &companies[i], nil
			}
			score := 0
			if strings.Contains(cNameLower, nameLower) {
				score = 2
				if strings.HasPrefix(cNameLower, nameLower) {
					score = 3
				}
			} else if strings.Contains(nameLower, cNameLower) {
				score = 1
			}
			if score > bestScore {
				bestScore = score
				match := companies[i]
				bestMatch = &match
			}
		}

		if len(companies) < pageSize {
			break
		}
		page++
	}

	if bestMatch != nil && bestScore > 0 {
		c.mu.Lock()
		c.company = bestMatch
		c.mu.Unlock()
		return bestMatch, nil
	}
	return nil, fmt.Errorf("company %q not found", c.cfg.CompanyName)
}

// GetCompany returns the cached company (resolved during init).
func (c *Client) GetCompany() *Company {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.company
}

// GetLocations fetches locations for the resolved company.
func (c *Client) GetLocations(ctx context.Context, page, limit int) (*LocationsResponse, error) {
	company := c.GetCompany()
	if company == nil {
		return nil, fmt.Errorf("company not resolved")
	}
	params := url.Values{
		"company_id": {fmt.Sprintf("%d", company.ID)},
		"page":       {fmt.Sprintf("%d", page)},
		"limit":      {fmt.Sprintf("%d", limit)},
	}
	body, err := c.apiGet(ctx, "/v1.0/admin/locations", params)
	if err != nil {
		return nil, err
	}
	var result LocationsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse locations: %w", err)
	}
	return &result, nil
}

// GetDevices fetches devices for a location.
func (c *Client) GetDevices(ctx context.Context, locationID, page, limit int) (*DevicesResponse, error) {
	params := url.Values{
		"location_id": {fmt.Sprintf("%d", locationID)},
		"status":      {"0"},
		"thing_type":  {"devices"},
		"page":        {fmt.Sprintf("%d", page)},
		"limit":       {fmt.Sprintf("%d", limit)},
	}
	body, err := c.apiGet(ctx, "/v1.0/admin/things", params)
	if err != nil {
		return nil, err
	}
	var result DevicesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse devices: %w", err)
	}
	return &result, nil
}

// apiGet performs an authenticated GET request to the external API.
func (c *Client) apiGet(ctx context.Context, path string, params url.Values) ([]byte, error) {
	token, err := c.ensureToken(ctx)
	if err != nil {
		return nil, err
	}

	u := c.cfg.APIURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("troy api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		// Token expired mid-flight, retry once
		if err := c.Authenticate(ctx); err != nil {
			return nil, err
		}
		return c.apiGet(ctx, path, params)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("troy api error (%d): %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}
