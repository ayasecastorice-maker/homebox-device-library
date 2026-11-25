package v1

import (
	"errors"
	"net/http"

	"github.com/hay-kot/httpkit/errchain"
	"github.com/hay-kot/httpkit/server"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/validate"
)

func (ctrl *V1Controller) HandleUserAvatarGet() errchain.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		actor := services.UseUserCtx(r.Context())
		avatar, err := ctrl.svc.User.GetAvatar(r.Context(), actor.ID)
		if err != nil {
			return validate.NewRequestError(err, http.StatusInternalServerError)
		}
		w.Header().Set("Cache-Control", "no-store")
		return server.JSON(w, http.StatusOK, Wrap(avatar))
	}
}

func (ctrl *V1Controller) HandleUserAvatarUpdate() errchain.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		r.Body = http.MaxBytesReader(w, r.Body, 128*1024)
		var in services.UserAvatar
		if err := server.Decode(r, &in); err != nil {
			return validate.NewRequestError(err, http.StatusBadRequest)
		}
		actor := services.UseUserCtx(r.Context())
		avatar, err := ctrl.svc.User.SetAvatar(r.Context(), actor.ID, in)
		if errors.Is(err, services.ErrInvalidAvatar) {
			return validate.NewRequestError(err, http.StatusBadRequest)
		}
		if err != nil {
			return validate.NewRequestError(err, http.StatusInternalServerError)
		}
		w.Header().Set("Cache-Control", "no-store")
		return server.JSON(w, http.StatusOK, Wrap(avatar))
	}
}
