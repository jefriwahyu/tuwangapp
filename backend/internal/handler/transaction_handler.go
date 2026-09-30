package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"tuwangapp/backend/internal/repository"
)

// GET /api/v1/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10&offset=0
func GetTransactionsHandler(c *gin.Context) {
	userID := c.GetString("user_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	rows, err := repository.GetTransactions(userID, repository.ListFilter{
		From:   c.Query("from"),
		To:     c.Query("to"),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}
