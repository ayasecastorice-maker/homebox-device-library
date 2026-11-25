-- +goose Up
ALTER TABLE users ADD COLUMN device_display JSONB DEFAULT '{}';
