package services

import "github.com/sysadminsmedia/homebox/backend/internal/data/repo"

func (svc *UserService) GetDeviceDisplay(ctx Context) (repo.DeviceDisplay, error) {
	return svc.repos.Users.GetDeviceDisplay(ctx, ctx.UID, ctx.GID)
}

func (svc *UserService) SetDeviceDisplay(ctx Context, in repo.DeviceDisplay) (repo.DeviceDisplay, error) {
	return svc.repos.Users.SetDeviceDisplay(ctx, ctx.UID, ctx.GID, in)
}
