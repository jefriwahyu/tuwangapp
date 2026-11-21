package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"tuwangapp/backend/internal/handler"
	"tuwangapp/backend/internal/middleware"
)

// supabaseAPIKeyTransport menyisipkan header "apikey" ke setiap request
// yang lewat client ini—diperlukan karena gateway Supabase mewajibkan
// header itu bahkan untuk endpoint publik seperti JWKS.
type supabaseAPIKeyTransport struct {
	apiKey string
}

func (t *supabaseAPIKeyTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("apikey", t.apiKey)
	return http.DefaultTransport.RoundTrip(req)
}

func main() {
	// Muat .env untuk pengembangan lokal. Di production, konfigurasi
	// datang dari environment variables platform (RunxBuild).
	for _, path := range []string{".env", "cmd/api/.env"} {
		if err := godotenv.Load(path); err == nil {
			break
		}
	}

	jwksURL := os.Getenv("SUPABASE_URL") + "/auth/v1/.well-known/jwks.json"
	httpClient := &http.Client{
		Transport: &supabaseAPIKeyTransport{apiKey: os.Getenv("SUPABASE_SERVICE_KEY")},
	}

	jwks, err := keyfunc.NewDefaultOverrideCtx(context.Background(), []string{jwksURL}, keyfunc.Override{
		Client: httpClient,
	})
	if err != nil {
		log.Fatalf("Gagal ambil JWKS dari Supabase: %s", err)
	}

	// PORT wajib dibaca dari environment variable saat deploy (RunxBuild,
	// Kubernetes, dsb). Default 8080 hanya untuk pengembangan lokal.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// CORS_ORIGINS dipisah koma, misal:
	//   http://localhost:5173,https://tuwangapp.runxbuild.app
	// Default hanya untuk pengembangan lokal.
	corsOrigins := []string{"http://localhost:5173"}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		corsOrigins = nil
		for _, origin := range strings.Split(raw, ",") {
			if origin = strings.TrimSpace(origin); origin != "" {
				corsOrigins = append(corsOrigins, origin)
			}
		}
	}

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins: corsOrigins,
		AllowMethods: []string{"GET", "POST", "DELETE"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	protected := router.Group("/api/v1")
	protected.Use(middleware.RequireAuth(jwks))
	{
		protected.POST("/chat", handler.ChatHandler)
		protected.GET("/summary", handler.GetSummaryHandler)
		protected.GET("/trend", handler.GetTrendHandler)
		protected.GET("/transactions", handler.GetTransactionsHandler)
		protected.DELETE("/transactions/:id", handler.DeleteTransactionHandler)
	}

	log.Printf("Server berjalan di port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Gagal menjalankan server: %s", err)
	}
}
