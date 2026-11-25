package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
)

func TestDeviceDisplayPersistenceIsolationAndConflict(t *testing.T) {
	ctx := context.Background()
	u, err := tRepos.Users.Create(ctx, repo.UserCreate{Name: "device-display-test", Email: fk.Email(), DefaultGroupID: tGroup.ID})
	require.NoError(t, err)
	t.Cleanup(func() { _ = tClient.User.DeleteOneID(u.ID).Exec(ctx) })
	actor := Context{Context: ctx, UID: u.ID, GID: tGroup.ID}
	itemType, err := tClient.EntityType.Create().SetName("order-type").SetGroupID(tGroup.ID).Save(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tClient.EntityType.DeleteOneID(itemType.ID).Exec(ctx) })
	item, err := tClient.Entity.Create().SetName("order-test").SetEntityTypeID(itemType.ID).SetGroupID(tGroup.ID).Save(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tClient.Entity.DeleteOneID(item.ID).Exec(ctx) })
	empty, err := tSvc.User.GetDeviceDisplay(actor)
	require.NoError(t, err)
	require.Equal(t, "manual", empty.Sort)
	require.Empty(t, empty.Order)
	saved, err := tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "manual", Order: []uuid.UUID{item.ID}})
	require.NoError(t, err)
	require.Equal(t, 1, saved.Revision)
	require.NoError(t, tSvc.User.SetSettings(ctx, u.ID, map[string]interface{}{"language": "zh-CN"}))
	loaded, err := tSvc.User.GetDeviceDisplay(actor)
	require.NoError(t, err)
	require.Equal(t, saved, loaded)
	other, err := tSvc.User.GetDeviceDisplay(tCtx)
	require.NoError(t, err)
	require.Empty(t, other.Order)
	otherCollection := actor
	otherCollection.GID = uuid.New()
	_, err = tSvc.User.SetDeviceDisplay(otherCollection, repo.DeviceDisplay{Sort: "name-asc"})
	require.NoError(t, err)
	loaded, err = tSvc.User.GetDeviceDisplay(actor)
	require.NoError(t, err)
	require.Equal(t, saved, loaded)
	_, err = tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "price-desc", Revision: 0})
	require.ErrorIs(t, err, repo.ErrDeviceDisplayConflict)
	for _, invalid := range []repo.DeviceDisplay{
		{Sort: "bad", Revision: 1},
		{Sort: "manual", Revision: -1},
		{Sort: "manual", Revision: 1, Order: []uuid.UUID{item.ID, item.ID}},
		{Sort: "manual", Revision: 1, Order: []uuid.UUID{uuid.New()}},
		{Sort: "manual", Revision: 1, Order: []uuid.UUID{uuid.Nil}},
	} {
		_, err = tSvc.User.SetDeviceDisplay(actor, invalid)
		require.ErrorIs(t, err, repo.ErrInvalidDeviceDisplay)
	}
	_, err = tSvc.User.SetDeviceDisplay(otherCollection, repo.DeviceDisplay{Sort: "manual", Revision: 1, Order: []uuid.UUID{item.ID}})
	require.ErrorIs(t, err, repo.ErrInvalidDeviceDisplay)
	loaded, err = tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "name-asc", Revision: saved.Revision, Order: saved.Order})
	require.NoError(t, err)
	require.Equal(t, "name-asc", loaded.Sort)
	settings, err := tSvc.User.GetSettings(ctx, u.ID)
	require.NoError(t, err)
	require.Equal(t, "zh-CN", settings["language"])
	unchanged, err := tClient.Entity.Get(ctx, item.ID)
	require.NoError(t, err)
	require.True(t, item.UpdatedAt.Equal(unchanged.UpdatedAt))
}

func TestDeviceDisplayCategoryIsolationAndLegacyCompatibility(t *testing.T) {
	ctx := context.Background()
	u, err := tRepos.Users.Create(ctx, repo.UserCreate{Name: "category-order-test", Email: fk.Email(), DefaultGroupID: tGroup.ID})
	require.NoError(t, err)
	t.Cleanup(func() { _ = tClient.User.DeleteOneID(u.ID).Exec(ctx) })
	actor := Context{Context: ctx, UID: u.ID, GID: tGroup.ID}
	kind, err := tClient.EntityType.Create().SetName("category-order-type").SetGroupID(tGroup.ID).Save(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tClient.EntityType.DeleteOneID(kind.ID).Exec(ctx) })
	ids := []uuid.UUID{}
	for i := 0; i < 2; i++ {
		item, err := tClient.Entity.Create().SetName("category-order-item").SetEntityTypeID(kind.ID).SetGroupID(tGroup.ID).Save(ctx)
		require.NoError(t, err)
		t.Cleanup(func() { _ = tClient.Entity.DeleteOneID(item.ID).Exec(ctx) })
		ids = append(ids, item.ID)
	}
	legacy, err := tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "manual", Order: ids})
	require.NoError(t, err)
	require.Empty(t, legacy.Categories)
	first := legacy
	first.Categories = map[string]repo.DeviceArrangement{
		"外设": {Sort: "manual", Order: []uuid.UUID{ids[1], ids[0]}},
		"电脑": {Sort: "name-asc", Order: []uuid.UUID{}},
	}
	saved, err := tSvc.User.SetDeviceDisplay(actor, first)
	require.NoError(t, err)
	require.Equal(t, ids, saved.Order)
	require.Equal(t, first.Categories, saved.Categories)
	loaded, err := tSvc.User.GetDeviceDisplay(actor)
	require.NoError(t, err)
	require.Equal(t, saved, loaded)
	// Global writes from an older window must retain the saved category map.
	global, err := tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "price-desc", Order: ids, Revision: saved.Revision})
	require.NoError(t, err)
	require.Equal(t, saved.Categories, global.Categories)
	changed := repo.DeviceDisplay{Sort: global.Sort, Order: global.Order, Revision: global.Revision,
		Categories: map[string]repo.DeviceArrangement{"外设": {Sort: "name-desc", Order: ids}}}
	next, err := tSvc.User.SetDeviceDisplay(actor, changed)
	require.NoError(t, err)
	require.Equal(t, global.Order, next.Order)
	require.Equal(t, global.Sort, next.Sort)
	require.Equal(t, global.Categories["电脑"], next.Categories["电脑"])
	require.Equal(t, "name-desc", next.Categories["外设"].Sort)
	_, err = tSvc.User.SetDeviceDisplay(actor, changed)
	require.ErrorIs(t, err, repo.ErrDeviceDisplayConflict)
	for _, invalid := range []map[string]repo.DeviceArrangement{
		{"unknown": {Sort: "manual"}},
		{"外设": {Sort: "invalid"}},
		{"外设": {Sort: "manual", Order: []uuid.UUID{uuid.Nil}}},
		{"外设": {Sort: "manual", Order: []uuid.UUID{ids[0], ids[0]}}},
		{"外设": {Sort: "manual", Order: []uuid.UUID{uuid.New()}}},
		{"外设": {Sort: "manual", Order: make([]uuid.UUID, 10001)}},
	} {
		_, err = tSvc.User.SetDeviceDisplay(actor, repo.DeviceDisplay{Sort: "manual", Revision: next.Revision, Categories: invalid})
		require.ErrorIs(t, err, repo.ErrInvalidDeviceDisplay)
	}
	otherCollection := actor
	otherCollection.GID = uuid.New()
	_, err = tSvc.User.SetDeviceDisplay(otherCollection, repo.DeviceDisplay{Sort: "manual", Categories: map[string]repo.DeviceArrangement{"外设": {Sort: "manual", Order: ids}}})
	require.ErrorIs(t, err, repo.ErrInvalidDeviceDisplay)
	loaded, err = tSvc.User.GetDeviceDisplay(actor)
	require.NoError(t, err)
	require.Equal(t, next, loaded)
	other, err := tSvc.User.GetDeviceDisplay(tCtx)
	require.NoError(t, err)
	require.Empty(t, other.Categories)
}
