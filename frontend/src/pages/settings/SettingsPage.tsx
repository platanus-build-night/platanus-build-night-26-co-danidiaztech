import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { SettingsOut, SettingsProvider, SettingsTestResult, SettingsUpdate } from "../../lib/types";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, ThemeToggle } from "../../components/ui";
import { cn } from "../../lib/cn";

const MODEL_OPTIONS = ["claude-opus-4-8", "claude-sonnet-5"] as const;

const PROVIDER_INFO: Record<SettingsProvider, { label: string; helper: string }> = {
  api: {
    label: "API key",
    helper: "Paste an Anthropic API key (sk-ant-…). Billed per call to the Messages API.",
  },
  plan: {
    label: "Claude Plan",
    helper: "Run `claude setup-token` and paste the token.",
  },
  mock: {
    label: "Mock",
    helper: "No credentials needed — returns a realistic canned analysis. Good for demos.",
  },
};

const inputClass =
  "w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent";

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsOut | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [provider, setProvider] = useState<SettingsProvider>("mock");
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [oauthToken, setOauthToken] = useState("");
  const [oauthTouched, setOauthTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SettingsTestResult | null>(null);

  function load() {
    setLoadError(null);
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        setProvider(s.provider as SettingsProvider);
        setModel(s.model);
        setApiKey("");
        setApiKeyTouched(false);
        setOauthToken("");
        setOauthTouched(false);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load settings"));
  }

  useEffect(load, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    setTestResult(null);
    try {
      const payload: SettingsUpdate = { provider, model };
      if (apiKeyTouched) payload.api_key = apiKey;
      if (oauthTouched) payload.oauth_token = oauthToken;
      const updated = await api.updateSettings(payload);
      setSettings(updated);
      setApiKey("");
      setApiKeyTouched(false);
      setOauthToken("");
      setOauthTouched(false);
      setJustSaved(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await api.testSettings());
    } catch (e) {
      setTestResult({
        ok: false,
        provider,
        model,
        error: e instanceof ApiError ? e.message : "Test request failed",
      });
    } finally {
      setTesting(false);
    }
  }

  const dirty =
    settings !== null &&
    (provider !== settings.provider || model !== settings.model || apiKeyTouched || oauthTouched);

  return (
    <div className="mx-auto max-w-2xl px-6 pb-16">
      <PageHeader
        title="Settings"
        subtitle={
          <Link to="/" className="hover:text-accent">
            &larr; Back to dashboard
          </Link>
        }
        actions={<ThemeToggle />}
      />

      {loadError && <EmptyState title="Could not load settings" description={loadError} />}

      {!loadError && settings === null && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading settings…
        </div>
      )}

      {settings && (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between p-4">
            <div>
              <h2 className="text-sm font-semibold text-text">AI provider status</h2>
              <p className="mt-0.5 text-sm text-text-muted">{settings.status}</p>
            </div>
            <Badge tone={settings.status.toLowerCase().includes("mock") ? "warning" : "success"}>
              {settings.provider}
            </Badge>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">Provider</h2>
            <div className="flex flex-col gap-2">
              {(Object.keys(PROVIDER_INFO) as SettingsProvider[]).map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors",
                    provider === p ? "border-accent bg-accent/5" : "border-border hover:bg-surface-alt"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      value={p}
                      checked={provider === p}
                      onChange={() => setProvider(p)}
                      className="accent-accent"
                    />
                    <span className="text-sm font-medium text-text">{PROVIDER_INFO[p].label}</span>
                  </div>
                  <p className="ml-6 text-xs text-text-muted">{PROVIDER_INFO[p].helper}</p>
                </label>
              ))}
            </div>

            {provider === "api" && (
              <div className="mt-3">
                <label htmlFor="api-key" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  API key {settings.api_key_masked && <span className="normal-case text-text-muted">(current: {settings.api_key_masked})</span>}
                </label>
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  placeholder={settings.api_key_masked ?? "sk-ant-…"}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyTouched(true);
                  }}
                  className={inputClass}
                />
              </div>
            )}

            {provider === "plan" && (
              <div className="mt-3">
                <label htmlFor="oauth-token" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Plan token{" "}
                  {settings.oauth_token_masked && (
                    <span className="normal-case text-text-muted">(current: {settings.oauth_token_masked})</span>
                  )}
                </label>
                <input
                  id="oauth-token"
                  type="password"
                  autoComplete="off"
                  value={oauthToken}
                  placeholder={settings.oauth_token_masked ?? "sk-ant-oat01-…"}
                  onChange={(e) => {
                    setOauthToken(e.target.value);
                    setOauthTouched(true);
                  }}
                  className={inputClass}
                />
              </div>
            )}
          </Card>

          <Card className="p-4">
            <label htmlFor="model" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving && <Spinner size="sm" />}
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={handleTest} disabled={testing}>
              {testing && <Spinner size="sm" />}
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {justSaved && !dirty && <span className="text-sm text-success">Saved.</span>}
          </div>
          <p className="-mt-2 text-xs text-text-muted">
            Test connection checks the currently saved provider — save your changes first if you just
            switched providers or updated a credential.
          </p>

          {saveError && <p className="text-sm text-danger">{saveError}</p>}

          {testResult && (
            <Card
              className={cn(
                "p-4",
                testResult.ok ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge tone={testResult.ok ? "success" : "danger"}>{testResult.ok ? "ok" : "error"}</Badge>
                <span className="text-sm text-text">
                  {testResult.provider}
                  {testResult.model ? ` · ${testResult.model}` : ""}
                </span>
              </div>
              {testResult.error && <p className="mt-2 text-sm text-danger">{testResult.error}</p>}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
