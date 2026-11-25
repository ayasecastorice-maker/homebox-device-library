package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image/jpeg"
	"strings"

	"github.com/google/uuid"
)

var ErrInvalidAvatar = errors.New("avatar must be a JPEG thumbnail no larger than 256 by 256 pixels")

type UserAvatar struct {
	Image string `json:"image"`
}

func (svc *UserService) GetAvatar(ctx context.Context, uid uuid.UUID) (UserAvatar, error) {
	image, err := svc.repos.Users.GetAvatar(ctx, uid)
	return UserAvatar{Image: image}, err
}

func normalizeAvatar(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	const prefix = "data:image/jpeg;base64,"
	if len(value) > 96*1024 || !strings.HasPrefix(value, prefix) {
		return "", ErrInvalidAvatar
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, prefix))
	if err != nil {
		return "", ErrInvalidAvatar
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(raw))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 256 || config.Height > 256 {
		return "", ErrInvalidAvatar
	}
	image, err := jpeg.Decode(bytes.NewReader(raw))
	if err != nil {
		return "", ErrInvalidAvatar
	}
	// Re-encode the pixels so metadata and trailing input are never stored.
	var out bytes.Buffer
	if err := jpeg.Encode(&out, image, &jpeg.Options{Quality: 85}); err != nil {
		return "", err
	}
	return prefix + base64.StdEncoding.EncodeToString(out.Bytes()), nil
}

func (svc *UserService) SetAvatar(ctx context.Context, uid uuid.UUID, in UserAvatar) (UserAvatar, error) {
	image, err := normalizeAvatar(in.Image)
	if err != nil {
		return UserAvatar{}, err
	}
	if err := svc.repos.Users.SetAvatar(ctx, uid, image); err != nil {
		return UserAvatar{}, err
	}
	return UserAvatar{Image: image}, nil
}
