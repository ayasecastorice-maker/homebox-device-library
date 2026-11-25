package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/user"
)

func (r *UserRepository) GetAvatar(ctx context.Context, uid uuid.UUID) (string, error) {
	u, err := r.db.User.Query().Where(user.ID(uid)).Select(user.FieldAvatar).Only(ctx)
	if err != nil {
		return "", err
	}
	return u.Avatar, nil
}

func (r *UserRepository) SetAvatar(ctx context.Context, uid uuid.UUID, image string) error {
	return r.db.User.UpdateOneID(uid).SetAvatar(image).Exec(ctx)
}
