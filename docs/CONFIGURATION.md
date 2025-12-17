# Configuration Guide

Complete configuration reference for Claude Adapter.

## Table of Contents

- [CLI Configuration](#cli-configuration)
- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Model Mapping](#model-mapping)

---

## CLI Configuration

### Command Line Options

```bash
claude-adapter [options]
```

| Option          | Alias | Description             | Default |
| --------------- | ----- | ----------------------- | ------- |
| `--port`        | `-p`  | Proxy server port       | `8080`  |
| `--reconfigure` | `-r`  | Force new configuration | `false` |
| `--version`     | `-V`  | Show version number     | —       |
| `--help`        | `-h`  | Show help               | —       |

### Examples

```bash
# Start with default settings
claude-adapter

# Use custom port
claude-adapter --port 3000

# Force reconfiguration
claude-adapter --reconfigure

# Combine options
claude-adapter -p 3000 -r
```

---

## Configuration Files

### Adapter Configuration

**Location:** `~/.claude-adapter/config.json`

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-your-api-key",
  "models": {
    "opus": "gpt-4-turbo",
    "sonnet": "gpt-4-turbo",
    "haiku": "gpt-3.5-turbo"
  }
}
```

| Field           | Type     | Required | Description                      |
| --------------- | -------- | -------- | -------------------------------- |
| `baseUrl`       | `string` | Yes      | OpenAI-compatible API base URL   |
| `apiKey`        | `string` | Yes      | API authentication key           |
| `models.opus`   | `string` | Yes      | Model for Claude Opus requests   |
| `models.sonnet` | `string` | Yes      | Model for Claude Sonnet requests |
| `models.haiku`  | `string` | Yes      | Model for Claude Haiku requests  |

---

### Claude Code Settings

**Location:** `~/.claude/settings.json`

Automatically configured by the CLI:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_AUTH_TOKEN": "default",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-4-turbo",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-4-turbo",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-3.5-turbo"
  }
}
```

---

### Claude Onboarding

**Location:** `~/.claude.json`

Automatically configured to skip onboarding:

```json
{
  "hasCompletedOnboarding": true
}
```

---

## Environment Variables

The adapter reads these from Claude Code's configuration:

| Variable                         | Description                             |
| -------------------------------- | --------------------------------------- |
| `ANTHROPIC_BASE_URL`             | Proxy server URL                        |
| `ANTHROPIC_AUTH_TOKEN`           | Authentication token (set to "default") |
| `ANTHROPIC_DEFAULT_OPUS_MODEL`   | Model name for Opus                     |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Model name for Sonnet                   |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL`  | Model name for Haiku                    |

---

## Model Mapping

### How It Works

When Claude Code makes a request for a Claude model, the adapter maps it to your configured OpenAI model:

```
claude-3-opus-20240229    → models.opus    → gpt-4-turbo
claude-3-sonnet-20240229  → models.sonnet  → gpt-4-turbo
claude-3-haiku-20240307   → models.haiku   → gpt-3.5-turbo
```

### Recommended Mappings

#### For OpenAI API

| Claude Model | Recommended OpenAI Model       |
| ------------ | ------------------------------ |
| Opus         | `gpt-4-turbo`, `gpt-4o`        |
| Sonnet       | `gpt-4-turbo`, `gpt-4o-mini`   |
| Haiku        | `gpt-3.5-turbo`, `gpt-4o-mini` |

#### For Azure OpenAI

Use your deployment names:

```json
{
  "models": {
    "opus": "my-gpt4-deployment",
    "sonnet": "my-gpt4-deployment",
    "haiku": "my-gpt35-deployment"
  }
}
```

#### For Other Providers

Any OpenAI-compatible API (Ollama, LM Studio, etc.):

```json
{
  "baseUrl": "http://localhost:11434/v1",
  "models": {
    "opus": "llama3:70b",
    "sonnet": "llama3:8b",
    "haiku": "llama3:8b"
  }
}
```

---

## Troubleshooting

### Reset Configuration

Delete the config file to start fresh:

```bash
rm ~/.claude-adapter/config.json
claude-adapter
```

### View Current Configuration

```bash
cat ~/.claude-adapter/config.json
```

### Verify Claude Code Settings

```bash
cat ~/.claude/settings.json
```
