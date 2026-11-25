package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
)

func avatarFixture(t *testing.T, size int) string {
	t.Helper()
	pixels := image.NewRGBA(image.Rect(0, 0, size, size))
	pixels.Set(0, 0, color.RGBA{R: 217, G: 119, B: 87, A: 255})
	var out bytes.Buffer
	require.NoError(t, jpeg.Encode(&out, pixels, nil))
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(out.Bytes())
}

func TestNormalizeAvatar(t *testing.T) {
	valid := avatarFixture(t, 256)
	for _, value := range []string{"", valid} {
		_, err := normalizeAvatar(value)
		require.NoError(t, err)
	}
	for _, value := range []string{
		"https://example.com/avatar.jpg",
		"data:image/svg+xml;base64,PHN2Zz4=",
		"data:image/jpeg;base64,bm90LWFuLWltYWdl",
		"data:image/jpeg;base64,@@@",
		strings.Repeat("A", 97*1024),
		avatarFixture(t, 257),
	} {
		_, err := normalizeAvatar(value)
		require.ErrorIs(t, err, ErrInvalidAvatar)
	}
	normalized, err := normalizeAvatar(valid + "\n")
	require.NoError(t, err)
	require.NotContains(t, normalized, "\n")
}

func TestUserAvatarPersistenceAndIsolation(t *testing.T) {
	ctx := context.Background()
	makeUser := func() repo.UserOut {
		u, err := tRepos.Users.Create(ctx, repo.UserCreate{
			Name: "avatar-test", Email: fk.Email(), DefaultGroupID: tGroup.ID,
		})
		require.NoError(t, err)
		t.Cleanup(func() { _ = tClient.User.DeleteOneID(u.ID).Exec(ctx) })
		return u
	}
	first, second := makeUser(), makeUser()
	empty, err := tSvc.User.GetAvatar(ctx, first.ID)
	require.NoError(t, err)
	require.Empty(t, empty.Image)
	saved, err := tSvc.User.SetAvatar(ctx, first.ID, UserAvatar{Image: avatarFixture(t, 256)})
	require.NoError(t, err)
	require.NotEmpty(t, saved.Image)
	require.NoError(t, tSvc.User.SetSettings(ctx, first.ID, map[string]interface{}{"language": "zh-CN"}))
	loaded, err := tSvc.User.GetAvatar(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, saved, loaded)
	other, err := tSvc.User.GetAvatar(ctx, second.ID)
	require.NoError(t, err)
	require.Empty(t, other.Image)
	_, err = tSvc.User.SetAvatar(ctx, first.ID, UserAvatar{Image: "invalid"})
	require.ErrorIs(t, err, ErrInvalidAvatar)
	loaded, err = tSvc.User.GetAvatar(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, saved, loaded)
	_, err = tSvc.User.SetAvatar(ctx, first.ID, UserAvatar{})
	require.NoError(t, err)
	loaded, err = tSvc.User.GetAvatar(ctx, first.ID)
	require.NoError(t, err)
	require.Empty(t, loaded.Image)
	settings, err := tSvc.User.GetSettings(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, "zh-CN", settings["language"])
	u, err := tRepos.Users.GetOneID(ctx, first.ID)
	require.NoError(t, err)
	require.Equal(t, first.Email, u.Email)
}
