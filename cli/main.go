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
	"syscall"
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
	Verbose  bool
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
		case "--verbose", "-v":
			result.Verbose = true
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

func isProcessAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = proc.Signal(syscall.Signal(0))
	return err == nil
}

func healthCheck(host string, port int) error {
	client := &http.Client{Timeout: 2 * time.Second}
	url := fmt.Sprintf("http://%s:%d/health", host, port)
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("health endpoint returned HTTP %d", resp.StatusCode)
	}
	return nil
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

const helpText = `Usage: roar [options] <message>

Send a notification to the Alertosaurus desktop app.

Options:
  --from <name>       Sender name shown in the notification (default: current directory)
  --duration <ms>     How long the notification stays visible, in milliseconds
  -v, --verbose       Show diagnostic details on failure
  -h, --help          Show this help message

Examples:
  roar "build finished"
  roar --from deploy "staging is live"
  roar --duration 10000 "tests failed"
  roar -v "hello"                          # show diagnostics if it fails`

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

	rtPath := runtimePath()
	if parsed.Verbose {
		fmt.Fprintf(os.Stderr, "runtime file: %s\n", rtPath)
	}

	info, err := readRuntimeFile(rtPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Fprintln(os.Stderr, "alertosaurus is not running (no runtime file found).")
		} else {
			fmt.Fprintf(os.Stderr, "alertosaurus is not running (cannot read runtime file: %s).\n", err)
		}
		fmt.Fprintln(os.Stderr, "Start it with: alertosaurus")
		if parsed.Verbose {
			fmt.Fprintf(os.Stderr, "  path: %s\n", rtPath)
		}
		return 1
	}

	if parsed.Verbose {
		fmt.Fprintf(os.Stderr, "found runtime: host=%s port=%d pid=%d started=%s\n",
			info.Host, info.Port, info.Pid, info.StartedAt)
	}

	if !isProcessAlive(info.Pid) {
		fmt.Fprintln(os.Stderr, "alertosaurus is not running (process has exited).")
		fmt.Fprintln(os.Stderr, "Start it with: alertosaurus")
		if parsed.Verbose {
			fmt.Fprintf(os.Stderr, "  stale runtime file: %s\n", rtPath)
			fmt.Fprintf(os.Stderr, "  recorded pid %d is no longer alive\n", info.Pid)
		}
		return 1
	}

	if err := healthCheck(info.Host, info.Port); err != nil {
		fmt.Fprintf(os.Stderr, "Cannot reach alertosaurus at %s:%d — %s\n", info.Host, info.Port, err)
		fmt.Fprintln(os.Stderr, "The app may have crashed, or a firewall may be blocking the connection.")
		if parsed.Verbose {
			fmt.Fprintf(os.Stderr, "  runtime file: %s\n", rtPath)
			fmt.Fprintf(os.Stderr, "  recorded pid: %d\n", info.Pid)
			fmt.Fprintf(os.Stderr, "  started at:   %s\n", info.StartedAt)
		}
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
