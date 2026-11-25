// Command start runs one private, per-user Homebox server until Terminal closes.
package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const addr = "127.0.0.1:7745"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Homebox:", err)
		os.Exit(1)
	}
}

func run() error {
	syscall.Umask(0077)
	self, err := os.Executable()
	if err != nil {
		return err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	data := filepath.Join(home, "Library", "Application Support", "Homebox Personal")
	if err := os.MkdirAll(data, 0700); err != nil {
		return err
	}
	lock, err := os.OpenFile(filepath.Join(data, "instance.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return fmt.Errorf("cannot lock the data folder; another Homebox may already be running: %w", err)
	}
	probe, err := net.Listen("tcp4", addr)
	if err != nil {
		return fmt.Errorf("port 7745 unavailable; close the other instance first: %w", err)
	}
	probe.Close()
	pepper, err := loadPepper(data)
	if err != nil {
		return err
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGHUP, syscall.SIGTERM)
	defer cancel()
	cmd := exec.Command(filepath.Join(filepath.Dir(self), "homebox"))
	cmd.Dir, cmd.Stdout, cmd.Stderr = data, os.Stdout, os.Stderr
	// Keep the lock in the backend too, if Terminal kills the launcher first.
	cmd.ExtraFiles = []*os.File{lock}
	for _, v := range os.Environ() {
		if !strings.HasPrefix(v, "HBOX_") {
			cmd.Env = append(cmd.Env, v)
		}
	}
	cmd.Env = append(cmd.Env, "HBOX_WEB_HOST=127.0.0.1", "HBOX_WEB_PORT=7745",
		"HBOX_AUTH_API_KEY_PEPPER="+pepper, "HBOX_MODE=production", "HBOX_DEMO=false",
		"HBOX_OPTIONS_ALLOW_ANALYTICS=false", "HBOX_OPTIONS_GITHUB_RELEASE_CHECK=false",
		"HBOX_OPTIONS_ALLOW_REGISTRATION=true")
	if err := cmd.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	stop := func() {
		_ = cmd.Process.Signal(syscall.SIGTERM)
		select {
		case <-done:
		case <-time.After(15 * time.Second):
			_ = cmd.Process.Kill()
			<-done
		}
	}
	url := "http://" + addr
	client := &http.Client{Timeout: time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	timeout := time.NewTimer(60 * time.Second)
	defer timeout.Stop()
	for {
		select {
		case err := <-done:
			return err
		case <-ctx.Done():
			stop()
			return nil
		case <-timeout.C:
			stop()
			return errors.New("startup timed out; see the server messages above")
		case <-tick.C:
			r, err := client.Get(url + "/api/v1/status")
			if err != nil {
				continue
			}
			r.Body.Close()
			if r.StatusCode != http.StatusOK {
				continue
			}
			fmt.Println("Homebox:", url, "\nPress Control-C in this window to stop.")
			if err := exec.CommandContext(ctx, "/usr/bin/open", url).Run(); err != nil {
				fmt.Println("Open the address above in your browser.")
			}
			select {
			case err := <-done:
				return err
			case <-ctx.Done():
				stop()
				return nil
			}
		}
	}
}

func loadPepper(dir string) (string, error) {
	path := filepath.Join(dir, "api-key-pepper.txt")
	data, err := os.ReadFile(path)
	if err == nil {
		key := strings.TrimSpace(string(data))
		raw, decErr := base64.StdEncoding.DecodeString(key)
		if decErr != nil || len(raw) != 48 {
			return "", errors.New("invalid api-key-pepper.txt; restore it from backup")
		}
		return key, nil
	}
	if !os.IsNotExist(err) {
		return "", err
	}
	if _, err := os.Stat(filepath.Join(dir, ".data", "homebox.db")); err == nil || !os.IsNotExist(err) {
		return "", errors.New("database found without its original pepper; restore api-key-pepper.txt from backup")
	}
	raw := make([]byte, 48)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	key := base64.StdEncoding.EncodeToString(raw)
	tmp, err := os.CreateTemp(dir, ".pepper-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	_, err = tmp.WriteString(key)
	closeErr := tmp.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	return key, os.Rename(tmp.Name(), path)
}
