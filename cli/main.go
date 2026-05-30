package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type runtimeInfo struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Pid       int    `json:"pid"`
	StartedAt string `json:"started_at"`
}

type parsedArgs struct {
	From     string
	Message  string
	Duration *int
	Help     bool
}

func parseArgs(args []string) parsedArgs {
	result := parsedArgs{From: filepath.Base(cwd())}
	i := 0
	var positional []string
	for i < len(args) {
		switch args[i] {
		case "--help", "-h":
			result.Help = true
			return result
		case "--from":
			i++
			if i < len(args) {
				result.From = args[i]
			}
		case "--duration":
			i++
			if i < len(args) {
				if v, err := strconv.Atoi(args[i]); err == nil {
					result.Duration = &v
				}
			}
		default:
			positional = append(positional, args[i])
		}
		i++
	}
	result.Message = strings.Join(positional, " ")
	return result
}

func cwd() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	return dir
}

func runtimePath() string {
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "alertosaurus", "runtime.json")
	case "windows":
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			home, _ := os.UserHomeDir()
			appdata = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(appdata, "alertosaurus", "runtime.json")
	default:
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			home, _ := os.UserHomeDir()
			configDir = filepath.Join(home, ".config")
		}
		return filepath.Join(configDir, "alertosaurus", "runtime.json")
	}
}

func readRuntimeFile(path string) (*runtimeInfo, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var info runtimeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func healthCheck(host string, port int) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://%s:%d/health", host, port))
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == 200
}

func notify(host string, port int, body map[string]any) (int, map[string]any, error) {
	payload, _ := json.Marshal(body)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Post(
		fmt.Sprintf("http://%s:%d/notify", host, port),
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	return resp.StatusCode, result, nil
}

const notRunning = "alertosaurus is not running. Start it with: alertosaurus"

const helpText = `Usage: roar [options] <message>

Send a notification to the Alertosaurus desktop app.

Options:
  --from <name>       Sender name shown in the notification (default: current directory)
  --duration <ms>     How long the notification stays visible, in milliseconds
  -h, --help          Show this help message

Examples:
  roar "build finished"
  roar --from deploy "staging is live"
  roar --duration 10000 "tests failed"`

func run() int {
	parsed := parseArgs(os.Args[1:])

	if parsed.Help {
		fmt.Println(helpText)
		return 0
	}

	if parsed.Message == "" {
		fmt.Fprintln(os.Stderr, "Usage: roar [options] <message>")
		fmt.Fprintln(os.Stderr, "Run 'roar --help' for more information.")
		return 1
	}

	info, err := readRuntimeFile(runtimePath())
	if err != nil {
		fmt.Fprintln(os.Stderr, notRunning)
		return 1
	}

	if !healthCheck(info.Host, info.Port) {
		fmt.Fprintln(os.Stderr, notRunning)
		return 1
	}

	body := map[string]any{
		"caller":  parsed.From,
		"message": parsed.Message,
	}
	if parsed.Duration != nil {
		body["duration_ms"] = *parsed.Duration
	}

	status, data, err := notify(info.Host, info.Port, body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to reach alertosaurus: %s\n", err)
		return 1
	}
	if status != 200 {
		if errMsg, ok := data["error"].(string); ok {
			fmt.Fprintln(os.Stderr, errMsg)
		} else {
			fmt.Fprintf(os.Stderr, "Server returned %d\n", status)
		}
		return 1
	}
	return 0
}

func main() {
	os.Exit(run())
}
