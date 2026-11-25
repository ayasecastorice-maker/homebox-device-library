package repo

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/entity"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/group"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/user"
)

var ErrDeviceDisplayConflict = errors.New("device display changed in another session")
var ErrInvalidDeviceDisplay = errors.New("invalid device display settings")

type DeviceDisplay struct {
	Sort       string                       `json:"sort"`
	Order      []uuid.UUID                  `json:"order"`
	Revision   int                          `json:"revision"`
	Categories map[string]DeviceArrangement `json:"categories,omitempty"`
}

type DeviceArrangement struct {
	Sort  string      `json:"sort"`
	Order []uuid.UUID `json:"order"`
}

func validDeviceArrangement(value DeviceArrangement, ids map[uuid.UUID]bool) bool {
	switch value.Sort {
	case "manual", "added-desc", "added-asc", "purchase-desc", "purchase-asc", "price-desc", "price-asc", "name-asc", "name-desc":
	default:
		return false
	}
	if len(value.Order) > 10000 {
		return false
	}
	seen := make(map[uuid.UUID]bool, len(value.Order))
	for _, id := range value.Order {
		if id == uuid.Nil || seen[id] {
			return false
		}
		seen[id] = true
		ids[id] = true
	}
	return true
}

func deviceDisplayValue(all map[string]interface{}, gid uuid.UUID) (DeviceDisplay, error) {
	state := DeviceDisplay{Sort: "manual", Order: []uuid.UUID{}}
	if value, ok := all[gid.String()]; ok {
		data, err := json.Marshal(value)
		if err != nil {
			return state, err
		}
		if err = json.Unmarshal(data, &state); err != nil {
			return state, err
		}
	}
	if state.Order == nil {
		state.Order = []uuid.UUID{}
	}
	return state, nil
}

func (r *UserRepository) GetDeviceDisplay(ctx context.Context, uid, gid uuid.UUID) (DeviceDisplay, error) {
	u, err := r.db.User.Get(ctx, uid)
	if err != nil {
		return DeviceDisplay{}, err
	}
	return deviceDisplayValue(u.DeviceDisplay, gid)
}

func (r *UserRepository) SetDeviceDisplay(ctx context.Context, uid, gid uuid.UUID, in DeviceDisplay) (DeviceDisplay, error) {
	ids := make(map[uuid.UUID]bool)
	if in.Revision < 0 || !validDeviceArrangement(DeviceArrangement{Sort: in.Sort, Order: in.Order}, ids) || len(in.Categories) > 6 {
		return DeviceDisplay{}, ErrInvalidDeviceDisplay
	}
	total := len(in.Order)
	for name, value := range in.Categories {
		switch name {
		case "电脑", "外设", "音频", "手机", "手表", "其他":
		default:
			return DeviceDisplay{}, ErrInvalidDeviceDisplay
		}
		if !validDeviceArrangement(value, ids) {
			return DeviceDisplay{}, ErrInvalidDeviceDisplay
		}
		total += len(value.Order)
	}
	if total > 20000 {
		return DeviceDisplay{}, ErrInvalidDeviceDisplay
	}
	if len(ids) > 0 {
		unique := make([]uuid.UUID, 0, len(ids))
		for id := range ids {
			unique = append(unique, id)
		}
		count, err := r.db.Entity.Query().Where(entity.IDIn(unique...), entity.HasGroupWith(group.IDEQ(gid))).Count(ctx)
		if err != nil {
			return DeviceDisplay{}, err
		}
		if count != len(ids) {
			return DeviceDisplay{}, ErrInvalidDeviceDisplay
		}
	}
	// Compare-and-swap protects simultaneous tabs and preserves other collections.
	for attempt := 0; attempt < 5; attempt++ {
		u, err := r.db.User.Get(ctx, uid)
		if err != nil {
			return DeviceDisplay{}, err
		}
		current, err := deviceDisplayValue(u.DeviceDisplay, gid)
		if err != nil {
			return DeviceDisplay{}, err
		}
		if current.Revision != in.Revision {
			return DeviceDisplay{}, ErrDeviceDisplayConflict
		}
		all := u.DeviceDisplay
		if all == nil {
			all = make(map[string]interface{})
		}
		next := in
		next.Revision++
		// Older clients updating the global order cannot erase category preferences.
		if len(current.Categories) > 0 || len(in.Categories) > 0 {
			next.Categories = make(map[string]DeviceArrangement)
			for name, value := range current.Categories {
				next.Categories[name] = value
			}
			for name, value := range in.Categories {
				if value.Order == nil {
					value.Order = []uuid.UUID{}
				}
				next.Categories[name] = value
			}
		}
		if next.Order == nil {
			next.Order = []uuid.UUID{}
		}
		all[gid.String()] = next
		n, err := r.db.User.Update().Where(user.IDEQ(uid), user.UpdatedAtEQ(u.UpdatedAt)).SetDeviceDisplay(all).Save(ctx)
		if err != nil {
			return DeviceDisplay{}, err
		}
		if n == 1 {
			return next, nil
		}
	}
	return DeviceDisplay{}, ErrDeviceDisplayConflict
}
