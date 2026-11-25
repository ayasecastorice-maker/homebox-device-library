package v1

import (
	"errors"
	"net/http"

	"github.com/hay-kot/httpkit/errchain"
	"github.com/hay-kot/httpkit/server"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/validate"
)

func (ctrl *V1Controller) HandleDeviceDisplayGet() errchain.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		state, err := ctrl.svc.User.GetDeviceDisplay(services.NewContext(r.Context()))
		if err != nil {
			return validate.NewRequestError(err, http.StatusInternalServerError)
		}
		w.Header().Set("Cache-Control", "no-store")
		return server.JSON(w, http.StatusOK, Wrap(state))
	}
}

func (ctrl *V1Controller) HandleDeviceDisplayUpdate() errchain.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		r.Body = http.MaxBytesReader(w, r.Body, 1024*1024)
		var in repo.DeviceDisplay
		if err := server.Decode(r, &in); err != nil {
			return validate.NewRequestError(err, http.StatusBadRequest)
		}
		state, err := ctrl.svc.User.SetDeviceDisplay(services.NewContext(r.Context()), in)
		if errors.Is(err, repo.ErrInvalidDeviceDisplay) {
			return validate.NewRequestError(err, http.StatusBadRequest)
		}
		if errors.Is(err, repo.ErrDeviceDisplayConflict) {
			return validate.NewRequestError(err, http.StatusConflict)
		}
		if err != nil {
			return validate.NewRequestError(err, http.StatusInternalServerError)
		}
		w.Header().Set("Cache-Control", "no-store")
		return server.JSON(w, http.StatusOK, Wrap(state))
	}
}
