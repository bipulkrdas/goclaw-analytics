we need to develop a new end to end feature. we will be adding new code to the existing code base, so keep the code modular design by adding new file than changing existing files as less as possible. use the existing ui and backend flow in the code base, because we want to leverage existing code as much as possible while adding our modular and backward compatible logic.

 here is the requirement and system details.

# in ui, add a new item to the side bar called "Troy", and a new router and page in "ui/web/src/pages" directory add the new folder called "troy" which is very similar to the "ui/web/src/pages/chat" with some difference:
1. in chat screen page we see 3 columns: sidebar column, then column with chat threads list, and last is the chat messages.
2. In "Troy", there will be 5 ccolumns with two columns between sidebar and cchat thread lists. so basically First, Sidebar, Second, Locations, Third, Assets, Fourth, Chat Threads (asociated to the Asset), Fifth, the Chat messages.

# When user clicks on "Troy" on the sidebar, it will make an api call to fetch list of location for a company name, using the following api endpoint and response json structure:

## First, when the system starts up or at some point in the server side, we need to call the api here.

curl --request POST  --url https://auth.mydevices.com/auth/realms/spenergy/protocol/openid-connect/token --header 'content-type: application/x-www-form-urlencoded'  --data 'grant_type=client_credentials&client_id=spenergy&client_secret=14066772-5614-411d-ae00-8bdcc2d4096b'

client-id and client_secret and realm will be coming from .env. in the url realm value is /realms/spenergy/protocol/openid-connect/token,  where realm = spenergy

The response json will be of this shape:

###{"access_token":"eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ0T0hEblNReWVJLWZ3S2ZSd3JDWWliOWp4Y1BpdnlnQ1ZlbkpZNVE2X2kwIn0.eyJleHAiOjE3ODEzNTkwMDAsImlhdCI6MTc4MTI3MjYwMCwianRpIjoiYjRiNDQ0MzMtYjc2Ny00YWEyLTkwY2UtNzZkZTRjNzliYThhIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLm15ZGV2aWNlcy5jb20vYXV0aC9yZWFsbXMvc3BlbmVyZ3kiLCJhdWQiOiJyZWFsbS1tYW5hZ2VtZW50Iiwic3ViIjoiZmM5ODI3MjEtZjIzMC00MDliLTg2ZjAtYTI5YjA5YmNmNWY0IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic3BlbmVyZ3kiLCJzZXNzaW9uX3N0YXRlIjoiZjM5NTc1ZWEtMzJmYS00NmZjLWE2MzktNjE4NWM4MDZmYWQ4IiwiYWNyIjoiMSIsInJlc291cmNlX2FjY2VzcyI6eyJyZWFsbS1tYW5hZ2VtZW50Ijp7InJvbGVzIjpbInZpZXctZXZlbnRzIiwicXVlcnktcmVhbG1zIiwicXVlcnktdXNlcnMiXX0sInNwZW5lcmd5Ijp7InJvbGVzIjpbIm5vdGlmaWNhdGlvbnM6dmlldyIsImhpZXJhcmNoaWVzOm1hbmFnZSIsInVzZXJzOnZpZXciLCJsb2NhdGlvbnM6dmlldyIsImFkbWluOmFwcHMiLCJpbnRlZ3JhdGlvbnM6bWFuYWdlIiwiYXBwczpxdWVyeSIsInVzZXJzOmF1dGhvcml6YXRpb24iLCJyZXBvcnRzOnZpZXciLCJoaWVyYXJjaGllczp2aWV3Iiwibm90aWZpY2F0aW9uczptYW5hZ2UiLCJyZXBvcnRzOm1hbmFnZSIsInRoaW5nczp2aWV3IiwidXNlcnM6bWFuYWdlIiwiaW50ZWdyYXRpb25zOnZpZXciLCJydWxlczptYW5hZ2UiLCJ0aGluZ3M6bWFuYWdlIiwidGhpbmdzOmhpc3RvcnkiLCJjb21wYW5pZXM6bWFuYWdlIiwiYXBwczptYW5hZ2","expires_in":86399,"refresh_expires_in":1173829,"refresh_token":"eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI2MzVhNDVkYi02OWI3LTQ4NzAtOGI1OC1kYjMyZmJmM2I0Y2YifQ.VlYS0zMmZhLTQ2ZmMtYTYzOS02MTg1YzgwNmZhZDgiLCJzY29wZSI6IiJ9.YebgC4XvLrgJWp9LMnyrCqUMjzbIojJX6oaEnHx2JAs","token_type":"bearer","not-before-policy":0,"session_state":"f39575ea-32fa-46fc-a639-6185c806fad8","scope":""

collect the access_token and refresh_token, expires_in, refresh_expires in and keep them saved for next use. To refresh token when access token expires, use the following url. use the same client_id, client_secret and realm value from .env.local file.


curl --request POST --url https://auth.mydevices.com/auth/realms/spenergy/protocol/openid-connect/token --header 'content-type: application/x-www-form-urlencoded' --data 'grant_type=refresh_token&client_id=spenergy&client_secret=14066772-5614-411d-ae00-8bdcc2d4096b&refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI2MzVhNDVkYi02OWI3LTQ4NzAtOGI1OC1kYjMyZmJmM2I0Y2YifQ.eyJleHAiOjE3ODI0NDY0MzAsImlhdCI6MTc4MTE1MDQzMCwianRpIjoiZjMxMTAyMzMtYjFjNi00ZmM2LTg1MTItOWIxZTQ1OTNhZWMwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLm15ZGV2aWNlcy5jb20vYXV0aC9yZWFsbXMvc3BlbmVyZ3kiLCJhdWQiOiJodHRwczovL2F1dGgubXlkZXZpY2VzLmNvbS9hdXRoL3JlYWxtcy9zcGVuZXJneSIsInN1YiI6ImZjOTgyNzIxLWYyMzAtNDA5Yi04NmYwLWEyOWIwOWJjZjVmNCIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJzcGVuZXJneSIsInNlc3Npb25fc3RhdGUiOiJmMzk1NzVlYS0zMmZhLTQ2ZmMtYTYzOS02MTg1YzgwNmZhZDgiLCJzY29wZSI6IiJ9.lZYmg0-NkO-O10tHl706Ebi0SFL1M2nRxA47cxkdBJE'

## with access token, now call teh api for company by company name, company name will come from .env.local with variable name
EXPORT COMPANY_NAME=Example Inc (Demo Site)

call the api and get the company information by applying the following logic in the code. Perform this once, may be at the start up (see how the codebase loads these initial configs)

searches for a company by name.
// It paginates through the companies list (50 per page) and returns the best match
// using case-insensitive substring matching. This is typically the first tool called
// to resolve a company name into an ID for subsequent operations.

func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		start := time.Now()

		

		Company struct will be of shape using this json object from the api call use the key json field to make our local Company struct. Fields include -id, name, address, city, state, zip, country, timezone'

{"id":32728,"name":"Dependable Anodizing Ltd","industry":"[]","address":"288 Don Park Rd","city":"Markham","state":"ON","zip":"L3R 1C3","country":"Canada","latitude":43.8260004,"longitude":-79.34294729999999,"timezone":"America/Toronto","user_id":"ac14286b-c9a1-4f64-a98d-b570eacb2c64","application_id":"spenergy","status":0,"created_at":"2023-08-14T14:39:41.000Z","updated_at":"2023-08-14T14:39:41.000Z","deleted_at":null,"external_id":null,"createdAt":"2023-08-14T14:39:41.000Z","updatedAt":"2023-08-14T14:39:41.000Z"}

		var bestMatch *json.RawMessage
		bestScore := -1

		for {
			params := url.Values{}
			params.Set("limit", strconv.Itoa(pageSize))
			params.Set("offset", strconv.Itoa(offset))

			data, err := apiClient.Get(ctx, "/v1.0/admin/companies", params)
			if err != nil {
				logger.Error(logging.LogEntry{
					Tool:     "get_company_by_name",
					Duration: time.Since(start).Milliseconds(),
					Error:    err.Error(),
				})
				return client.McpErrorResult(err)
			}

			// Try parsing as array of companies
			var companies []json.RawMessage
			if err := json.Unmarshal(data, &companies); err != nil {
				// If not an array, return raw data with error context
				logger.Error(logging.LogEntry{
					Tool:     "get_company_by_name",
					Duration: time.Since(start).Milliseconds(),
					Error:    "unexpected response format",
				})
				
			}

			// No more results
			if len(companies) == 0 {
				break
			}

			for i := range companies {
				var c company
				if err := json.Unmarshal(companies[i], &c); err != nil {
					continue
				}

				cNameLower := strings.ToLower(c.Name)

				// Exact match - return immediately
				if cNameLower == nameLower {
					logger.Info(logging.LogEntry{
						Tool:     "get_company_by_name",
						Duration: time.Since(start).Milliseconds(),
					})
					return &mcp.CallToolResult{
						Content: []mcp.Content{mcp.NewTextContent(string(companies[i]))},
					}, nil
				}

				// Score substring matches: prefer shorter names that contain the search term
				// (closer match), and names that start with the search term
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

			// If we got fewer results than page size, we've reached the end
			if len(companies) < pageSize {
				break
			}

			offset += pageSize
		}

	

		if bestMatch != nil && bestScore > 0 {
			return &Company{
				ID:
                Name:,
			}, nil
		}

	}

The above query at start up should be called at user login, if not present. if a user log in and the company information is not present. Eventually we will make it multi tenant because user from different companies will use our system. But for now let us keep it simple by reading from .env.local file and load company information at user log in.


Now for locations use the following api call (note that company_id is the id of the Company struct we obtained in the previous step). use pagination so ui can send the pagination from api end point from UI.

curl --request GET  --url 'https://api.mydevices.com/v1.0/admin/locations?company_id=40024&page=0&limit=50' --header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ0T0hEblNReWVJLWZ3S2ZSd3JDWWliOWp4Y1BpdnlnQ1ZlbkpZNVE2X2kwIn0.DYqEtlsp4vZmRk4NU-QrKFskdwkoQnLvShFfG-kGb4TKKIY_v2HLxypuoG0yGs3yot0GqabHHDCUE6D4hCp7gs3QRa2GYGpvKyWHKQUc0_dQ'  --header 'Content-Type: application/json'


response json for locations is a list fo Location objectsÖ
{"count":1,"limit":50,"page":0,"rows":[{"id":53033,"name":"Spenergy Certified Solutions","industry":"[]","company_id":40024,"user_id":"ac14286b-c9a1-4f64-a98d-b570eacb2c64","application_id":"spenergy","address":"87 Campbell Rd","city":"guelph","state":"ontario","zip":"N1H 1B9","country":"Canada","latitude":43.5504418,"longitude":-80.2911007,"timezone":"America/Toronto","status":0,"supported_device":"Default","deleted_at":null,"external_id":null,"parent_id":null,"createdAt":"2024-01-08T16:32:05.000Z","updatedAt":"2026-05-31T23:00:43.000Z"}]}% 

define the local Location struct using all teh fields. keep the pagination information and send that back to UI query from reactjs UI frontend app, so that user can cick next and get the next page of locations on the UI.


## when user clicks a location, call the following api to get all the devices for that location using the fllowing api. Notice location_id in the query param is the location-id of the clicked location on the TI location column.

curl --request GET  --url 'https://api.mydevices.com/v1.0/admin/things?location_id=53033&status=0&thing_type=devices&page=0&limit=50' --header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ0T0hEblNReWVJLWZ3S2ZSd3JDW'  --header 'Content-Type: application/json'
 

response object with array of devices (of things). Use pagination to sync with UI pagination when user clicks "next" page on teh UI, send the page and limit of default 50 to the api.

{"limit":50,"page":0,"count":1,"rows":[{"tina_id":4205892,"id":"d60c5cc0-5931-11f1-94d3-297a7f671e3c","location_id":53033,"company_id":40024,"parent_id":null,"cayenne_id":"d60c5cc0-5931-11f1-94d3-297a7f671e3c","hardware_id":"d463520000001d3e","sensor_use_id":null,"sensor_use":"Industrial","sensor_type":"Electric Meter","thing_name":"Air conditioning unit","thing_type":1,"marker_alert":"animate","properties":"{\"codec\":\"33704015-ec79-4e3b-a13b-a888c60abcaf\",\"deveui\":\"d463520000001d3e\",\"network\":\"iotinabox.chirpstackio\",\"activation\":\"activated\",\"device_registry_id\":\"09f5f3b0-164a-11f0-9383-0de16395cbea\",\"public\":false,\"use_url\":false,\"codec.vol_unit\":\"m3\",\"codec.prox_unit\":\"m\",\"codec.voltage\":120,\"codec.power_factor\":1,\"child.127.unit\":\"kw\",\"codec.timezone\":\"America/New_York\",\"codec.reset\":24,\"codec.threshold\":1,\"codec.interval\":15,\"codec.wires\":1,\"unit\":\"c\",\"command.interval\":\"1200\",\"url\":\"https://spenergy.mydevices.com/v2/h/BNOB\",\"selected_chart_sensor_id\":\"d6406510-5931-11f1-8146-4fb8013ab711\"}","device_type_id":"503e9680-9cfe-11ef-ab39-af8ef6cf829f","enabled":1,"user_id":"ac14286b-c9a1-4f64-a98d-b570eacb2c64","application_id":"spenergy","status":0,"created_at":"2026-05-26T18:36:40.000Z","updated_at":"2026-06-12T20:50:07.000Z","external_id":null,"createdAt":"2026-05-26T18:36:40.000Z","updatedAt":"2026-06-12T20:50:07.000Z"}]}%

on the UI "Assets" column the name of the device list will be displayed (from the above api call). At the top of the device list, show the name of the clicked location as a clickable item (similar to the list of devices), keep the location id available when user clicks the location from the "Assets" column. So basically display teh Location name as the first item/ or at the top, followed by the list of devices from the above api call.s

# Next section
## each device as well as location item will have a drop down menu, called analysis, chart, and Chat. when user clicks on the device, it opens the Chat threads (this column is similar to Chat Threads list from the "Chat" page when user clicks on "Chat" on the sidebar.)

on the database, there will be a new table called "asset_sessions" which will be an association between asset id (location_id or thing_id) and session?id, this is required to populate the chat threds (sessions) when user clicks a device or the location item. at the chat threads column (Fourth column) there will be a list of chat threads associated to the asset ids from teh asset_sessions table. when user clicks on + or 'New Chat' at the top of the fourth Chat Threads column, it will behave same as when user clicks on 'New Chat' thread today to allow selection of the agent. and when the new session is created at the backend, we also want to make sure an association is made by making an entry at the 'asset_sessions' table. add this capability at the service code layer or may be database layer by making a separate function that create sessions for a device assets so we handle without touching the existing session crete function.

For other menu items, like analysis, chart keep them as they are now, we will add new components for them in future. 