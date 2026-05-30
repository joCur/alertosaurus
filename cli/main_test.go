package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestParseArgs(t *testing.T) {
	t.Run("parses message as positional argument", func(t *testing.T) {
		result := parseArgs([]string{"agent finished"})
		if result.Message != "agent finished" {
			t.Errorf("expected 'agent finished', got %q", result.Message)
		}
	})

	t.Run("parses --from flag", func(t *testing.T) {
		result := parseArgs([]string{"--from", "refactor-agent", "done"})
		if result.From != "refactor-agent" {
			t.Errorf("expected from='refactor-agent', got %q", result.From)
		}
		if result.Message != "done" {
			t.Errorf("expected message='done', got %q", result.Message)
		}
	})

	t.Run("parses --duration flag", func(t *testing.T) {
		result := parseArgs([]string{"--duration", "10000", "tests failed"})
		if result.Duration == nil || *result.Duration != 10000 {
			t.Errorf("expected duration=10000, got %v", result.Duration)
		}
		if result.Message != "tests failed" {
			t.Errorf("expected message='tests failed', got %q", result.Message)
		}
	})

	t.Run("parses all flags together", func(t *testing.T) {
		result := parseArgs([]string{"--from", "deploy", "--duration", "0", "stuck"})
		if result.From != "deploy" {
			t.Errorf("expected from='deploy', got %q", result.From)
		}
		if result.Duration == nil || *result.Duration != 0 {
			t.Errorf("expected duration=0, got %v", result.Duration)
		}
		if result.Message != "stuck" {
			t.Errorf("expected message='stuck', got %q", result.Message)
		}
	})

	t.Run("returns empty message when no positional args", func(t *testing.T) {
		result := parseArgs([]string{})
		if result.Message != "" {
			t.Errorf("expected empty message, got %q", result.Message)
		}
	})

	t.Run("defaults from to cwd basename", func(t *testing.T) {
		result := parseArgs([]string{"hello"})
		expected := filepath.Base(cwd())
		if result.From != expected {
			t.Errorf("expected from=%q, got %q", expected, result.From)
		}
	})

	t.Run("joins multiple positional args", func(t *testing.T) {
		result := parseArgs([]string{"hello", "world"})
		if result.Message != "hello world" {
			t.Errorf("expected 'hello world', got %q", result.Message)
		}
	})
}

func TestReadRuntimeFile(t *testing.T) {
	t.Run("returns runtime info when file exists", func(t *testing.T) {
		dir := t.TempDir()
		p := filepath.Join(dir, "runtime.json")
		data, _ := json.Marshal(runtimeInfo{Host: "127.0.0.1", Port: 4174, Pid: 1, StartedAt: ""})
		os.WriteFile(p, data, 0644)

		info, err := readRuntimeFile(p)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if info.Port != 4174 {
			t.Errorf("expected port=4174, got %d", info.Port)
		}
		if info.Host != "127.0.0.1" {
			t.Errorf("expected host='127.0.0.1', got %q", info.Host)
		}
	})

	t.Run("returns error when file does not exist", func(t *testing.T) {
		dir := t.TempDir()
		_, err := readRuntimeFile(filepath.Join(dir, "nope.json"))
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}
