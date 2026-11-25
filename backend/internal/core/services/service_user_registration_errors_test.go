package services

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRegisterUser_DuplicateEmailHasExplicitErrorWithoutSideEffects(t *testing.T) {
	ctx := context.Background()
	groupsBefore, err := tClient.Group.Query().Count(ctx)
	require.NoError(t, err)
	before, err := tRepos.Users.GetOneID(ctx, tUser.ID)
	require.NoError(t, err)
	for _, email := range []string{tUser.Email, "  " + strings.ToUpper(tUser.Email) + "  "} {
		_, err := tSvc.User.RegisterUser(ctx, UserRegistration{
			Name: "duplicate-registration", Email: email, Password: "another password",
		})
		require.ErrorIs(t, err, ErrorEmailRegistered)
	}
	groupsAfter, err := tClient.Group.Query().Count(ctx)
	require.NoError(t, err)
	require.Equal(t, groupsBefore, groupsAfter)
	after, err := tRepos.Users.GetOneID(ctx, tUser.ID)
	require.NoError(t, err)
	require.Equal(t, before, after)
}
