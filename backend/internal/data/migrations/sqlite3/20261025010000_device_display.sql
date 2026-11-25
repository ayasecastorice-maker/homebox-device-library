-- +goose Up
ALTER TABLE users ADD COLUMN device_display JSON DEFAULT '{}';
