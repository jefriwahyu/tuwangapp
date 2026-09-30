package main

import (
	"context"
	"log"
	"net/http"
	"os"

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
	if err := godotenv.Load(); err != nil {
		log.Println("Peringatan: file .env tidak ditemukan")
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

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST"},
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
	}

	router.Run(":8080")
}
