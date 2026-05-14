import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Database,
  FileText,
  Loader2,
  PlayCircle,
  Route,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import {
  checkNvidiaHealth,
  uploadClaimFile,
  extractClaimText,
  listGoogleDriveTestFiles,
  importGoogleDriveFile,
  extractClaimFields,
  aiExtractClaimFields,
  validateClaimFields,
  aiValidateClaimFields,
  routeClaim,
  aiExplainRoute,
} from "./api/claimApi";
import { checkBackendHealth } from "./api/healthapi";

import "./App.css";

const workflowSteps = [
  {
    key: "upload",
    label: "Upload",
    title: "Upload claim file",
    icon: UploadCloud,
    activeText: "Uploading the selected file.",
  },
  {
    key: "text",
    label: "Text",
    title: "Extract text",
    icon: FileText,
    activeText: "Reading text from the document.",
  },
  {
    key: "fields",
    label: "Fields",
    title: "Extract fields",
    icon: Database,
    activeText: "Finding FNOL claim fields.",
  },
  {
    key: "validate",
    label: "Validate",
    title: "Validate fields",
    icon: ClipboardCheck,
    activeText: "Checking mandatory fields and quality.",
  },
  {
    key: "route",
    label: "Route",
    title: "Route claim",
    icon: Route,
    activeText: "Applying routing rules.",
  },
  {
    key: "explain",
    label: "Explain",
    title: "AI explanation",
    icon: Sparkles,
    activeText: "Preparing the route explanation.",
  },
];

const fieldLabels = {
  policyNumber: "Policy number",
  policyholderName: "Policyholder",
  effectiveDates: "Effective dates",
  incidentDate: "Incident date",
  incidentTime: "Incident time",
  incidentLocation: "Incident location",
  description: "Description",
  claimant: "Claimant",
  thirdParties: "Third parties",
  contactDetails: "Contact details",
  assetType: "Asset type",
  assetId: "Asset ID",
  estimatedDamage: "Estimated damage",
  claimType: "Claim type",
  attachments: "Attachments",
  initialEstimate: "Initial estimate",
};

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatValue(value, fallback = "Missing") {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : fallback;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length ? JSON.stringify(value) : fallback;
  }

  return value || fallback;
}

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function getMissingFields(validationResult) {
  return (
    validationResult?.missingFields ||
    validationResult?.validation?.missingFields ||
    []
  );
}

function getValidationSummary(validationResult) {
  return validationResult?.validation?.summary || "Validation completed.";
}

function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase().endsWith(".pdf")
  );
}

function getErrorMessage(err, fallback) {
  return (
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.message ||
    fallback
  );
}

function getStepStatus(stepKey, results, currentStep, errorStep) {
  if (errorStep === stepKey) return "error";
  if (currentStep === stepKey) return "active";
  if (results[stepKey]) return "complete";
  return "pending";
}

function StatusPill({ children, tone = "muted", icon: Icon }) {
  return (
    <span className={`status-pill ${tone}`}>
      {Icon && <Icon size={14} strokeWidth={2.3} />}
      {children}
    </span>
  );
}

function HealthStatusPill({ label, health }) {
  const isChecking = health.state === "checking";
  const isReady = health.state === "ready";

  return (
    <StatusPill
      icon={isChecking ? Loader2 : isReady ? CheckCircle2 : AlertTriangle}
      tone={isChecking ? "info" : isReady ? "success" : "danger"}
    >
      {label} {isChecking ? "checking" : isReady ? "ready" : "offline"}
    </StatusPill>
  );
}

function ActionButton({
  children,
  icon: Icon,
  busy = false,
  variant = "primary",
  ...buttonProps
}) {
  const ButtonIcon = busy ? Loader2 : Icon;

  return (
    <button
      {...buttonProps}
      className={`action-button ${variant}`}
      disabled={buttonProps.disabled || busy}
      type="button"
    >
      {ButtonIcon && (
        <ButtonIcon
          className={busy ? "spin" : undefined}
          size={17}
          strokeWidth={2.3}
        />
      )}
      <span>{children}</span>
    </button>
  );
}

function ModeToggle({ label, value, onChange, disabled }) {
  return (
    <div className="mode-group">
      <span>{label}</span>
      <div className="mode-toggle">
        <button
          className={value === "rule" ? "selected" : ""}
          disabled={disabled}
          onClick={() => onChange("rule")}
          type="button"
        >
          Rule-based
        </button>
        <button
          className={value === "ai" ? "selected" : ""}
          disabled={disabled}
          onClick={() => onChange("ai")}
          type="button"
        >
          Use AI
        </button>
      </div>
    </div>
  );
}

function FilePicker({ selectedFile, onFileChange, disabled }) {
  return (
    <label className={`file-picker ${selectedFile ? "has-file" : ""}`}>
      <input
        accept=".pdf,.txt"
        disabled={disabled}
        onChange={onFileChange}
        type="file"
      />
      <span className="file-icon">
        <UploadCloud size={25} strokeWidth={2.2} />
      </span>
      <span className="file-copy">
        <strong>
          {selectedFile ? selectedFile.name : "Select claim document"}
        </strong>
        <small>
          {selectedFile
            ? `${formatFileSize(selectedFile.size)} selected`
            : "PDF or TXT file"}
        </small>
      </span>
    </label>
  );
}

function FieldFrameGrid({ fields = {} }) {
  const entries = Object.keys(fieldLabels).map((key) => ({
    key,
    label: fieldLabels[key],
    value: fields?.[key],
  }));

  return (
    <div className="field-frame-grid">
      {entries.map((item) => (
        <div
          className={`field-frame ${isEmptyValue(item.value) ? "missing" : ""}`}
          key={item.key}
        >
          <span>{item.label}</span>
          <strong>{formatValue(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function KeyValueList({ items }) {
  return (
    <div className="key-value-list">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{formatValue(item.value, item.fallback || "-")}</strong>
        </div>
      ))}
    </div>
  );
}

function ResultModal({ result, onClose }) {
  const [activeTab, setActiveTab] = useState("summary");

  if (!result) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="result-modal-title"
        aria-modal="true"
        className="result-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{result.phase}</p>
            <h2 id="result-modal-title">{result.title}</h2>
          </div>
          <button
            aria-label="Close result modal"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={19} strokeWidth={2.4} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={activeTab === "summary" ? "active" : ""}
            onClick={() => setActiveTab("summary")}
            type="button"
          >
            Normal
          </button>
          <button
            className={activeTab === "json" ? "active" : ""}
            onClick={() => setActiveTab("json")}
            type="button"
          >
            JSON
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "summary" ? (
            <div className="modal-summary">{result.summary}</div>
          ) : (
            <pre>{JSON.stringify(result.data, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function DriveFilePickerModal({
  files,
  importingFileId,
  loading,
  onClose,
  onSelect,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="drive-modal-title"
        aria-modal="true"
        className="result-modal drive-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Google Drive</p>
            <h2 id="drive-modal-title">Test files</h2>
          </div>
          <button
            aria-label="Close Google Drive file picker"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={19} strokeWidth={2.4} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-line">
              <Loader2 className="spin" size={17} strokeWidth={2.3} />
              <span>Loading Google Drive files.</span>
            </div>
          ) : files.length ? (
            <div className="drive-file-list">
              {files.map((file) => (
                <button
                  className="drive-file-option"
                  disabled={Boolean(importingFileId)}
                  key={file.id}
                  onClick={() => onSelect(file)}
                  type="button"
                >
                  <span className="drive-file-icon">
                    {importingFileId === file.id ? (
                      <Loader2 className="spin" size={18} strokeWidth={2.3} />
                    ) : (
                      <FileText size={18} strokeWidth={2.3} />
                    )}
                  </span>
                  <span className="drive-file-copy">
                    <strong>{file.name}</strong>
                    <small>{file.size || file.mimeType}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="danger-text">No test files were found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessTracker({
  results,
  currentStep,
  errorStep,
  extractionMode,
  validationMode,
  onOpenResult,
}) {
  const getPhaseModeLabel = (stepKey) => {
    if (stepKey === "fields") {
      return extractionMode === "ai" ? "Used AI" : "Rule-based";
    }

    if (stepKey === "validate") {
      return validationMode === "ai" ? "Used AI" : "Rule-based";
    }

    if (stepKey === "explain") {
      return "Used AI";
    }

    return "";
  };

  return (
    <section className="process-tracker">
      <div className="tracker-heading">
        <div>
          <p className="eyebrow">Claim progress</p>
          <h3>Phase tracker</h3>
        </div>
        <div className="tracker-heading-icon">
          <Route size={16} strokeWidth={2.3} />
        </div>
      </div>

      <ol className="process-list">
        {workflowSteps.map((step) => {
            const status = getStepStatus(
              step.key,
              results,
              currentStep,
              errorStep
            );
            const Icon = step.icon;
            const modeLabel = getPhaseModeLabel(step.key);

            return (
            <li className={`process-item ${status}`} key={step.key}>
              <span className="process-marker">
                {status === "complete" ? (
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                ) : status === "active" ? (
                  <Loader2 className="spin" size={16} strokeWidth={2.4} />
                ) : (
                  <Icon size={16} strokeWidth={2.2} />
                )}
              </span>
              <span className="process-copy">
                <strong>{step.label}</strong>
                  <small>
                    {status === "active"
                      ? step.activeText
                      : status === "complete"
                        ? "Completed"
                        : status === "error"
                          ? "Needs attention"
                          : "Waiting"}
                  </small>
                  {modeLabel && <em>{modeLabel}</em>}
                </span>
              {results[step.key] && (
                <button
                  aria-label={`View ${step.label} result`}
                  className="mini-result-button"
                  onClick={() => onOpenResult(step.key)}
                  type="button"
                >
                  Result
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function App() {
  const [apiHealth, setApiHealth] = useState({ state: "checking" });
  const [aiHealth, setAiHealth] = useState({ state: "checking" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [driveFiles, setDriveFiles] = useState([]);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveImportingFileId, setDriveImportingFileId] = useState("");
  const [extractionMode, setExtractionMode] = useState("rule");
  const [validationMode, setValidationMode] = useState("rule");
  const [results, setResults] = useState({});
  const [currentStep, setCurrentStep] = useState("");
  const [errorStep, setErrorStep] = useState("");
  const [error, setError] = useState("");
  const [activeResultKey, setActiveResultKey] = useState(null);

  const pipelineRunning = Boolean(currentStep);
  const driveImporting = Boolean(driveImportingFileId);
  const isBusy = pipelineRunning || driveLoading || driveImporting;
  const explanation = results.explain?.explanation;
  const pdfPreviewUrl = useMemo(() => {
    if (!isPdfFile(selectedFile)) {
      return "";
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    let cancelled = false;

    const runHealthChecks = async () => {
      const [apiResult, aiResult] = await Promise.allSettled([
        checkBackendHealth(),
        checkNvidiaHealth(),
      ]);

      if (cancelled) return;

      if (apiResult.status === "fulfilled") {
        setApiHealth({ state: "ready", data: apiResult.value });
      } else {
        setApiHealth({
          state: "error",
          message: getErrorMessage(apiResult.reason, "API health check failed."),
        });
      }

      if (aiResult.status === "fulfilled") {
        setAiHealth({
          state: aiResult.value?.connected ? "ready" : "error",
          data: aiResult.value,
        });
      } else {
        setAiHealth({
          state: "error",
          message: getErrorMessage(aiResult.reason, "AI health check failed."),
        });
      }
    };

    runHealthChecks();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetWorkflow = () => {
    setResults({});
    setCurrentStep("");
    setErrorStep("");
    setError("");
    setActiveResultKey(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    resetWorkflow();
  };

  const openDrivePicker = async () => {
    setDrivePickerOpen(true);
    setError("");

    try {
      setDriveLoading(true);
      const response = await listGoogleDriveTestFiles();
      setDriveFiles(response.files || []);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not load the Google Drive test files."
        )
      );
    } finally {
      setDriveLoading(false);
    }
  };

  const selectDriveFile = async (driveFile) => {
    try {
      setDriveImportingFileId(driveFile.id);
      resetWorkflow();

      const importedFile = await importGoogleDriveFile({
        fileId: driveFile.id,
      });
      setSelectedFile(importedFile);
      setDrivePickerOpen(false);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not import the selected Google Drive file."
        )
      );
    } finally {
      setDriveImportingFileId("");
    }
  };

  const savePhaseResult = (key, data) => {
    setResults((previous) => ({
      ...previous,
      [key]: data,
    }));
  };

  const runClaimPipeline = async () => {
    if (!selectedFile) {
      setError("Please select a PDF or TXT claim file first.");
      return;
    }

    let activePhase = "";

    const setPhase = (phase) => {
      activePhase = phase;
      setCurrentStep(phase);
    };

    try {
      setResults({});
      setError("");
      setErrorStep("");
      setActiveResultKey(null);

      setPhase("upload");
      const upload = await uploadClaimFile(selectedFile);
      savePhaseResult("upload", upload);

      setPhase("text");
      const text = await extractClaimText(selectedFile);
      savePhaseResult("text", text);

      setPhase("fields");
      const fields =
        extractionMode === "ai"
          ? await aiExtractClaimFields(text.rawText)
          : await extractClaimFields(text.rawText);
      savePhaseResult("fields", fields);

      setPhase("validate");
      const validation =
        validationMode === "ai"
          ? await aiValidateClaimFields(fields.extractedFields)
          : await validateClaimFields(fields.extractedFields);
      savePhaseResult("validate", validation);

      setPhase("route");
      const route = await routeClaim(fields.extractedFields);
      savePhaseResult("route", route);
      setActiveResultKey("final");

      setPhase("explain");
      const aiExplanation = await aiExplainRoute({
        extractedFields: route.extractedFields,
        missingFields: route.missingFields,
        recommendedRoute: route.recommendedRoute,
        reasoning: route.reasoning,
      });
      savePhaseResult("explain", aiExplanation);
    } catch (err) {
      setErrorStep(activePhase);
      setError(
        getErrorMessage(
          err,
          `The ${activePhase || "claim"} phase failed. Please try again.`
        )
      );
    } finally {
      setCurrentStep("");
    }
  };

  const buildResultPayload = (key, sourceResults = results) => {
    const result = sourceResults[key];
    const fields = sourceResults.fields?.extractedFields || {};
    const validationMissingFields = getMissingFields(sourceResults.validate);
    const route = sourceResults.route;
    const explain = sourceResults.explain?.explanation;

    const payloads = {
      upload: {
        phase: "Phase 1",
        title: "Upload result",
        data: result,
        summary: (
          <KeyValueList
            items={[
              { label: "Status", value: result?.message || "Uploaded" },
              { label: "File name", value: result?.file?.filename },
              { label: "File type", value: result?.file?.fileType },
              { label: "Saved path", value: result?.file?.filePath },
            ]}
          />
        ),
      },
      pdf: {
        phase: "PDF preview",
        title: "Claim document preview",
        data: {
          fileName: selectedFile?.name,
          fileType: selectedFile?.type || "application/pdf",
          fileSize: selectedFile?.size,
        },
        summary: (
          <>
            <KeyValueList
              items={[
                { label: "File name", value: selectedFile?.name },
                { label: "File size", value: formatFileSize(selectedFile?.size) },
              ]}
            />
            {pdfPreviewUrl ? (
              <>
                <h4>PDF preview</h4>
                <div className="pdf-preview-frame">
                  <iframe
                    src={pdfPreviewUrl}
                    title={`PDF preview for ${selectedFile?.name || "claim file"}`}
                  />
                </div>
              </>
            ) : (
              <p className="danger-text">PDF preview is not available.</p>
            )}
          </>
        ),
      },
      text: {
        phase: "Phase 2",
        title: "Text extraction result",
        data: result,
        summary: (
          <>
            <KeyValueList
              items={[
                { label: "Status", value: result?.message },
                { label: "Text length", value: result?.textLength },
              ]}
            />
            <h4>Text preview</h4>
            <pre className="preview-block">{result?.rawTextPreview || ""}</pre>
          </>
        ),
      },
      fields: {
        phase: "Phase 3",
        title: "Extracted claim fields",
        data: result,
        summary: (
          <>
            <KeyValueList
              items={[
                {
                  label: "Extraction mode",
                  value: extractionMode === "ai" ? "AI" : "Rule-based",
                },
                { label: "Status", value: result?.message },
              ]}
            />
            <FieldFrameGrid fields={fields} />
          </>
        ),
      },
      validate: {
        phase: "Phase 4",
        title: "Validation result",
        data: result,
        summary: (
          <>
            <KeyValueList
              items={[
                {
                  label: "Validation mode",
                  value: validationMode === "ai" ? "AI" : "Rule-based",
                },
                {
                  label: "Missing fields",
                  value: validationMissingFields.length,
                },
                {
                  label: "Summary",
                  value: getValidationSummary(result),
                },
              ]}
            />
            {validationMissingFields.length > 0 ? (
              <ul className="simple-list">
                {validationMissingFields.map((field) => (
                  <li key={field}>{fieldLabels[field] || field}</li>
                ))}
              </ul>
            ) : (
              <p className="good-text">No mandatory fields are missing.</p>
            )}
          </>
        ),
      },
      route: {
        phase: "Phase 5",
        title: "Routing result",
        data: result,
        summary: (
          <KeyValueList
            items={[
              { label: "Recommended route", value: route?.recommendedRoute },
              { label: "Reasoning", value: route?.reasoning },
              { label: "Missing fields", value: route?.missingFields?.length },
            ]}
          />
        ),
      },
      explain: {
        phase: "Final phase",
        title: "AI route explanation",
        data: result,
        summary: (
          <>
            <KeyValueList
              items={[
                { label: "Route", value: explain?.route },
                { label: "Summary", value: explain?.summary },
                { label: "Next action", value: explain?.nextAction },
              ]}
            />
            <h4>Key factors</h4>
            {explain?.keyFactors?.length ? (
              <ul className="simple-list">
                {explain.keyFactors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            ) : (
              <p>No key factors returned.</p>
            )}
          </>
        ),
      },
      final: {
        phase: "Final result",
        title: "Routing result and AI explanation",
        data: {
          route,
          aiExplanation: sourceResults.explain || null,
          explanationStatus: sourceResults.explain
            ? "ready"
            : errorStep === "explain"
              ? "failed"
              : "loading",
        },
        summary: (
          <>
            <h4>Routing result</h4>
            <KeyValueList
              items={[
                { label: "Recommended route", value: route?.recommendedRoute },
                { label: "Reasoning", value: route?.reasoning },
                { label: "Missing fields", value: route?.missingFields?.length },
              ]}
            />

            <h4>AI explanation</h4>
            {explain ? (
              <>
                <KeyValueList
                  items={[
                    { label: "Summary", value: explain.summary },
                    { label: "Next action", value: explain.nextAction },
                  ]}
                />
                {explain.keyFactors?.length > 0 && (
                  <ul className="simple-list">
                    {explain.keyFactors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : errorStep === "explain" ? (
              <p className="danger-text">
                AI explanation failed. The routing result is still available.
              </p>
            ) : (
              <div className="loading-line">
                <Loader2 className="spin" size={17} strokeWidth={2.3} />
                <span>AI explanation is loading.</span>
              </div>
            )}
          </>
        ),
      },
    };

    return payloads[key];
  };

  const openResult = (key) => {
    const payload = buildResultPayload(key);
    if (payload?.data) {
      setActiveResultKey(key);
    }
  };

  const activeResult = activeResultKey
    ? buildResultPayload(activeResultKey)
    : null;

  const routeLabel = results.route?.recommendedRoute || "Not routed yet";
  const finalReady = Boolean(results.explain);

  return (
    <div className="app-shell">
      <main className="main-panel">
        <header className="page-header">
          <div className="header-copy">
            <span className="brand-mark">
              <ShieldCheck size={23} strokeWidth={2.3} />
            </span>
            <div>
              <p className="eyebrow">FNOL automation</p>
              <h2>Upload once, process the claim automatically</h2>
              <p>
                Choose how extraction and validation should run, then start the
                claim pipeline.
              </p>
            </div>
          </div>
          <div className="header-status">
            <HealthStatusPill health={apiHealth} label="API" />
            <HealthStatusPill health={aiHealth} label="AI" />
            <StatusPill
              icon={finalReady ? CheckCircle2 : currentStep ? Loader2 : Circle}
              tone={finalReady ? "success" : currentStep ? "info" : "muted"}
            >
              {finalReady
                ? "Completed"
                : currentStep
                  ? "Processing"
                  : "Ready"}
            </StatusPill>
          </div>
        </header>

        {error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={18} strokeWidth={2.3} />
            <span>{error}</span>
          </div>
        )}

        <section className="intake-card">
          <div className="intake-header">
            <div>
              <p className="eyebrow">Claim intake</p>
              <h3>Processing choices</h3>
            </div>
            <StatusPill
              icon={selectedFile ? CheckCircle2 : UploadCloud}
              tone={selectedFile ? "success" : "muted"}
            >
              {selectedFile ? "File selected" : "Waiting for file"}
            </StatusPill>
          </div>

          <div className="mode-grid">
            <ModeToggle
              disabled={isBusy}
              label="Field extraction"
              onChange={setExtractionMode}
              value={extractionMode}
            />
            <ModeToggle
              disabled={isBusy}
              label="Field validation"
              onChange={setValidationMode}
              value={validationMode}
            />
          </div>

          <FilePicker
            disabled={isBusy}
            onFileChange={handleFileChange}
            selectedFile={selectedFile}
          />

          <div className="intake-actions">
            <ActionButton
              busy={pipelineRunning}
              disabled={!selectedFile || isBusy}
              icon={PlayCircle}
              onClick={runClaimPipeline}
            >
              Upload and Process Claim
            </ActionButton>
            <ActionButton
              busy={driveLoading}
              disabled={pipelineRunning || driveImporting}
              icon={UploadCloud}
              onClick={openDrivePicker}
              variant="secondary"
            >
              Upload from GDrive
            </ActionButton>
            {isPdfFile(selectedFile) && (
              <ActionButton
                disabled={!pdfPreviewUrl}
                icon={FileText}
                onClick={() => openResult("pdf")}
                variant="secondary"
              >
                View PDF
              </ActionButton>
            )}
          </div>
        </section>

        <ProcessTracker
          currentStep={currentStep}
          errorStep={errorStep}
          extractionMode={extractionMode}
          onOpenResult={openResult}
          results={results}
          validationMode={validationMode}
        />

        <section className="decision-card">
          <div>
            <p className="eyebrow">Final routing</p>
            <h3>{routeLabel}</h3>
            <p>{explanation?.summary || results.route?.reasoning || "Run the pipeline to see the routing decision and AI explanation."}</p>
          </div>
          {results.explain && (
            <ActionButton
              icon={Sparkles}
              onClick={() => openResult("final")}
              variant="secondary"
            >
              View Final Result
            </ActionButton>
          )}
        </section>

        {results.fields && (
          <p className="tracker-note">
            Open any completed phase result from the tracker above.
          </p>
        )}
      </main>

      <ResultModal
        onClose={() => setActiveResultKey(null)}
        result={activeResult}
      />
      {drivePickerOpen && (
        <DriveFilePickerModal
          files={driveFiles}
          importingFileId={driveImportingFileId}
          loading={driveLoading}
          onClose={() => setDrivePickerOpen(false)}
          onSelect={selectDriveFile}
        />
      )}
    </div>
  );
}

export default App;
