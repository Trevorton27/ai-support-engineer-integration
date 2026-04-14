'use client';

import { useEffect, useRef, useState } from 'react';
import {
  analyzeTicketAsync,
  suggestNextStepsAsync,
  generateDraftAsync,
  saveDraft,
  chatAsync,
  pollStatus,
  updateTicketStatusAsync,
  sendFeedback,
  type TicketSnapshot,
} from '@/lib/copilotClient';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

type DraftType = 'customer_reply' | 'internal_note' | 'escalation';

type DraftContent = {
  text: string;
  draftType: DraftType;
  tone?: string;
  usedAnalysisId: string | null;
  markedSent?: boolean;
};

type CopilotPanelProps = {
  snapshot: TicketSnapshot;
};

type SuggestionState = {
  suggestionId: string;
  state: 'queued' | 'running' | 'success' | 'error';
  content?: any;
  error?: string;
};

type AnalysisResult = {
  extractedSignals: {
    product?: string;
    platform?: string;
    os?: string;
    browser?: string;
    appVersion?: string;
    device?: string;
    errorStrings: string[];
    urls: string[];
  };
  hypotheses: Array<{
    cause: string;
    evidence: string[];
    confidence: number;
    tests: string[];
  }>;
  clarifyingQuestions: string[];
  nextSteps: string[];
  riskFlags: string[];
  escalationWhen: string[];
};

export function CopilotPanel({ snapshot }: CopilotPanelProps) {
  const [currentJob, setCurrentJob] = useState<SuggestionState | null>(null);
  const [result, setResult] = useState<any>(null);
  const [resultType, setResultType] = useState<string>('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'concise' | 'surfer'>(
    'professional',
  );
  const [chatInput, setChatInput] = useState('');

  // Ticket status state
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(
    (snapshot.status as TicketStatus) || 'OPEN',
  );
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Phase 3 draft state
  const [draftType, setDraftType] = useState<DraftType>('customer_reply');
  const [draftEditText, setDraftEditText] = useState('');
  const [draftSuggestionId, setDraftSuggestionId] = useState<string | null>(
    null,
  );
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMarkedSent, setDraftMarkedSent] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  const resultTypeRef = useRef(resultType);
  useEffect(() => {
    resultTypeRef.current = resultType;
  }, [resultType]);

  // Reload last saved customer-reply draft from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(
      `draft-customer_reply-${snapshot.id}`,
    );
    if (!savedId) return;
    (async () => {
      const r = await pollStatus(savedId);
      if (!r.ok) return;
      const data = r.data as {
        id: string;
        state: SuggestionState['state'];
        content?: any;
      };
      if (data.state === 'success' && data.content?.text) {
        setResult(data.content);
        setResultType('draft');
        setDraftType('customer_reply');
        setDraftEditText(data.content.text);
        setDraftSuggestionId(savedId);
        setDraftMarkedSent(Boolean(data.content.markedSent));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling effect
  useEffect(() => {
    if (
      !currentJob ||
      !currentJob.suggestionId ||
      currentJob.state === 'success' ||
      currentJob.state === 'error'
    ) {
      return;
    }

    const interval = setInterval(async () => {
      const statusResult = await pollStatus(currentJob.suggestionId);

      if (statusResult.ok) {
        const data = statusResult.data as { id: string; state: SuggestionState['state']; content?: any; error?: string };
        setCurrentJob(prev => prev ? { ...prev, state: data.state, content: data.content, error: data.error } : prev);

        if (data.state === 'success') {
          setResult(data.content);
          if (resultTypeRef.current === 'draft' && data.content?.text) {
            setDraftEditText(data.content.text);
            setDraftMarkedSent(Boolean(data.content.markedSent));
            setDraftSaved(false);
          }
        }
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [currentJob]);

  const handleAnalyze = async () => {
    setResult(null);
    setResultType('analysis');
    const res = await analyzeTicketAsync(snapshot.id);
    if (res.ok) {
      setCurrentJob(res.data as SuggestionState);
    }
  };

  const handleSuggest = async () => {
    setResult(null);
    setResultType('steps');
    const res = await suggestNextStepsAsync(snapshot.id);
    if (res.ok) {
      setCurrentJob(res.data as SuggestionState);
    }
  };

  const handleGenerateDraft = async () => {
    setResult(null);
    setResultType('draft');
    setDraftEditText('');
    setDraftSuggestionId(null);
    setDraftSaved(false);
    setDraftMarkedSent(false);
    setDraftCopied(false);

    const res = await generateDraftAsync(snapshot.id, draftType, tone);
    if (res.ok) {
      const data = res.data as { suggestionId: string; state: SuggestionState['state'] };
      setCurrentJob({
        suggestionId: data.suggestionId,
        state: data.state,
      });
      setDraftSuggestionId(data.suggestionId);
      localStorage.setItem(
        `draft-${draftType}-${snapshot.id}`,
        data.suggestionId,
      );
    }
  };

  const handleSaveDraft = async () => {
    if (!draftSuggestionId) return;
    setDraftSaving(true);
    const res = await saveDraft(draftSuggestionId, draftEditText);
    setDraftSaving(false);
    if (res.ok) {
      setDraftSaved(true);
    }
  };

  const handleCopyDraft = async () => {
    await navigator.clipboard.writeText(draftEditText);
    setDraftCopied(true);
    setTimeout(() => setDraftCopied(false), 1500);
  };

  const handleMarkSent = async () => {
    if (!draftSuggestionId) return;
    const res = await saveDraft(draftSuggestionId, draftEditText, true);
    if (res.ok) {
      setDraftMarkedSent(true);
      setDraftSaved(true);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (newStatus === ticketStatus) return;
    setStatusUpdating(true);
    setStatusMessage(null);
    const res = await updateTicketStatusAsync(snapshot.id, newStatus);
    setStatusUpdating(false);
    if (res.ok) {
      setTicketStatus(newStatus);
      setStatusMessage(`Status updated to ${newStatus.replace('_', ' ')}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage('Failed to update status');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;

    setResult(null);
    setResultType('chat');
    const res = await chatAsync(snapshot.id, chatInput);
    if (res.ok) {
      setCurrentJob(res.data as SuggestionState);
      setChatInput('');
    }
  };

  const renderStateIndicator = () => {
    if (!currentJob) return null;

    const stateColors = {
      queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const stateLabels = {
      queued: 'Queued...',
      running: 'Processing...',
      success: 'Complete',
      error: `Error: ${currentJob.error}`,
    };

    return (
      <div className="flex items-center gap-2">
        <div
          className={`inline-block rounded px-2 py-1 text-xs ${stateColors[currentJob.state]}`}
          data-testid="copilot-state"
        >
          {stateLabels[currentJob.state]}
        </div>
        {currentJob.state === 'success' && (
          <FeedbackButtons suggestionId={currentJob.suggestionId} />
        )}
      </div>
    );
  };

  const renderAnalysisResult = (data: AnalysisResult) => {
    const sig = data.extractedSignals;

    const scalarSignals = [
      { label: 'Product', value: sig.product ?? '' },
      { label: 'Platform', value: sig.platform ?? '' },
      { label: 'OS', value: sig.os ?? '' },
      { label: 'Browser', value: sig.browser ?? '' },
      { label: 'Version', value: sig.appVersion ?? '' },
      { label: 'Device', value: sig.device ?? '' },
    ].filter((s) => s.value.length > 0);

    const hasSignals =
      scalarSignals.length > 0 ||
      sig.errorStrings.length > 0 ||
      sig.urls.length > 0;

    const confidenceBadgeClass = (n: number) => {
      if (n >= 0.75)
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      if (n >= 0.4)
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    };

    return (
      <div className="space-y-4" data-testid="analysis-summary">

        {/* Extracted Signals */}
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Extracted Signals
          </h4>
          {!hasSignals ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No signals detected</p>
          ) : (
            <div className="space-y-1.5">
              {scalarSignals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scalarSignals.map((s) => (
                    <span
                      key={s.label}
                      className="rounded bg-blue-50 px-2 py-0.5 text-xs dark:bg-blue-950"
                    >
                      <span className="font-medium">{s.label}:</span> {s.value}
                    </span>
                  ))}
                </div>
              )}
              {sig.errorStrings.length > 0 && (
                <div>
                  <span className="text-xs font-medium">Errors:</span>
                  <ul className="ml-4 mt-0.5 list-disc space-y-0.5">
                    {sig.errorStrings.map((e, i) => (
                      <li key={i} className="font-mono text-xs text-red-700 dark:text-red-400">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sig.urls.length > 0 && (
                <div>
                  <span className="text-xs font-medium">URLs:</span>
                  <ul className="ml-4 mt-0.5 list-disc space-y-0.5">
                    {sig.urls.map((u, i) => (
                      <li key={i} className="break-all font-mono text-xs text-blue-600 dark:text-blue-400">{u}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hypotheses */}
        {data.hypotheses.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Hypotheses
            </h4>
            <div className="space-y-2">
              {data.hypotheses.map((h, i) => (
                <div key={i} className="rounded-md border border-gray-200 p-2 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{h.cause}</p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${confidenceBadgeClass(h.confidence)}`}>
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
                  {h.evidence.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Evidence:</span>
                      <ul className="ml-4 mt-0.5 list-disc space-y-0.5">
                        {h.evidence.map((ev, j) => (
                          <li key={j} className="text-xs text-gray-600 dark:text-gray-300">{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {h.tests.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tests:</span>
                      <ul className="ml-4 mt-0.5 list-disc space-y-0.5">
                        {h.tests.map((t, j) => (
                          <li key={j} className="text-xs text-gray-600 dark:text-gray-300">{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clarifying Questions */}
        {data.clarifyingQuestions.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Clarifying Questions
            </h4>
            <ol className="ml-4 list-decimal space-y-1">
              {data.clarifyingQuestions.map((q, i) => (
                <li key={i} className="text-sm">{q}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Next Steps */}
        {data.nextSteps.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Next Steps
            </h4>
            <ol className="ml-4 list-decimal space-y-1">
              {data.nextSteps.map((step, i) => (
                <li key={i} className="text-sm">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Risk Flags */}
        {data.riskFlags.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Risk Flags
            </h4>
            <ul className="space-y-1">
              {data.riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-1.5 rounded bg-yellow-50 px-2 py-1 text-sm text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                  <span className="mt-0.5 shrink-0">&#9888;</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Escalate When */}
        {data.escalationWhen.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Escalate When
            </h4>
            <ul className="space-y-1">
              {data.escalationWhen.map((condition, i) => (
                <li key={i} className="flex items-start gap-1.5 rounded bg-red-50 px-2 py-1 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
                  <span className="mt-0.5 shrink-0">&#8679;</span>
                  {condition}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* KB References */}
        {renderReferences((data as any).references)}
      </div>
    );
  };

  const renderReferences = (
    references?: Array<{
      id: string;
      title: string;
      url?: string | null;
      snippet: string;
      score: number;
    }>,
  ) => {
    if (!references || references.length === 0) return null;

    return (
      <div data-testid="references-section">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          References
        </h4>
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="rounded-md border border-gray-200 p-2 dark:border-gray-700"
              data-testid="reference-item"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {ref.title}
                    </a>
                  ) : (
                    ref.title
                  )}
                </span>
                <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {Math.round(ref.score * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {ref.snippet}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStepsResult = (data: { steps: string[]; references?: any[] }) => {
    return (
      <div className="space-y-4">
        <div>
          <span className="font-medium">Next Steps:</span>
          <ul className="ml-5 mt-1 list-disc">
            {data.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
        {renderReferences(data.references)}
      </div>
    );
  };

  const renderDraftResult = (data: DraftContent) => {
    const label =
      data.draftType === 'customer_reply'
        ? 'Customer Reply Draft'
        : data.draftType === 'internal_note'
          ? 'Internal Note Draft'
          : 'Escalation Handoff Draft';

    return (
      <div data-testid="draft-result" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{label}</span>
          {data.usedAnalysisId && (
            <span
              className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              data-testid="draft-analysis-badge"
            >
              Using saved analysis
            </span>
          )}
        </div>
        <textarea
          data-testid="draft-edit-textarea"
          value={draftEditText}
          onChange={(e) => {
            setDraftEditText(e.target.value);
            setDraftSaved(false);
          }}
          rows={10}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={!draftSuggestionId || draftSaving}
            data-testid="draft-save-button"
            className="rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 dark:bg-gray-300 dark:text-gray-900 dark:hover:bg-gray-400"
          >
            {draftSaving ? 'Saving...' : draftSaved ? 'Saved \u2713' : 'Save'}
          </button>
          <button
            onClick={handleCopyDraft}
            data-testid="draft-copy-button"
            className="rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-white hover:bg-gray-600 dark:bg-gray-300 dark:text-gray-900 dark:hover:bg-gray-400"
          >
            {draftCopied ? 'Copied \u2713' : 'Copy'}
          </button>
          <button
            onClick={handleMarkSent}
            disabled={!draftSuggestionId || draftMarkedSent}
            data-testid="draft-mark-sent-button"
            className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 ${
              draftMarkedSent
                ? 'bg-green-600 text-white dark:bg-green-500'
                : 'bg-gray-700 text-white hover:bg-gray-600 dark:bg-gray-300 dark:text-gray-900 dark:hover:bg-gray-400'
            }`}
          >
            {draftMarkedSent ? 'Sent \u2713' : 'Mark as Sent'}
          </button>
        </div>
      </div>
    );
  };

  const renderChatResult = (data: { answer: string }) => {
    return (
      <div>
        <span className="font-medium">Answer:</span>
        <p className="mt-1">{data.answer}</p>
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    let content;
    if (resultType === 'analysis') {
      content = renderAnalysisResult(result);
    } else if (resultType === 'steps') {
      content = renderStepsResult(result);
    } else if (resultType === 'draft') {
      content = renderDraftResult(result);
    } else if (resultType === 'chat') {
      content = renderChatResult(result);
    } else {
      content = <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>;
    }

    return (
      <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-900">
        {content}
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(result, null, 2));
          }}
          className="mt-2 rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-white hover:bg-gray-600 dark:bg-gray-300 dark:text-gray-900 dark:hover:bg-gray-400"
        >
          Copy JSON
        </button>
      </div>
    );
  };

  const isLoading =
    currentJob?.state === 'queued' || currentJob?.state === 'running';

  return (
    <div
      className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      data-testid="copilot-panel"
    >
      <h3 className="text-sm font-semibold">AI Copilot</h3>

      {renderStateIndicator()}

      {/* ── Ticket Status ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Ticket Status
        </h4>
        <div className="flex gap-1">
          {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(
            (s) => {
              const isActive = ticketStatus === s;
              const colorMap: Record<TicketStatus, string> = {
                OPEN: isActive
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                IN_PROGRESS: isActive
                  ? 'bg-yellow-500 text-white dark:bg-yellow-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                RESOLVED: isActive
                  ? 'bg-green-600 text-white dark:bg-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                CLOSED: isActive
                  ? 'bg-gray-600 text-white dark:bg-gray-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              };
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusUpdating}
                  className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${colorMap[s]}`}
                >
                  {s.replace('_', ' ')}
                </button>
              );
            },
          )}
        </div>
        {statusMessage && (
          <p
            className={`text-xs ${statusMessage.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
          >
            {statusMessage}
          </p>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* ── AI Actions ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          AI Actions
        </h4>
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          data-testid="analyze-button"
          className="w-full rounded-md bg-gray-800 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Analyze Ticket
        </button>

        <button
          onClick={handleSuggest}
          disabled={isLoading}
          className="w-full rounded-md bg-gray-800 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Suggest Next Steps
        </button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* ── Create AI Generated Post ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Create AI Generated Post
        </h4>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-0.5 block text-[10px] font-medium text-gray-400 dark:text-gray-500">
              Post Type
            </label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as DraftType)}
              data-testid="draft-type-select"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="customer_reply">Customer Reply</option>
              <option value="internal_note">Internal Note</option>
              <option value="escalation">Escalation</option>
            </select>
          </div>
          {draftType === 'customer_reply' && (
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-gray-400 dark:text-gray-500">
                Post Tone
              </label>
              <select
                value={tone}
                onChange={(e) =>
                  setTone(
                    e.target.value as
                      | 'professional'
                      | 'friendly'
                      | 'concise'
                      | 'surfer',
                  )
                }
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="concise">Concise</option>
                <option value="surfer">Surfer</option>
              </select>
            </div>
          )}
        </div>
        <button
          onClick={handleGenerateDraft}
          disabled={isLoading}
          data-testid="generate-draft-button"
          className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Generate Draft
        </button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* ── Ask Me a Question ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Ask Me a Question
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask Copilot..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chatInput.trim()) {
                handleChat();
              }
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={handleChat}
            disabled={isLoading || !chatInput.trim()}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Ask
          </button>
        </div>
      </div>

      {currentJob?.state === 'error' && (
        <div
          className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200"
          data-testid="copilot-error"
        >
          {currentJob.error}
        </div>
      )}

      {renderResult()}
    </div>
  );
}

function FeedbackButtons({ suggestionId }: { suggestionId: string }) {
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (rating: 'up' | 'down') => {
    if (submitted || pending) return;
    setPending(true);
    const res = await sendFeedback(suggestionId, rating);
    setPending(false);
    if (res.ok) setSubmitted(rating);
  };

  return (
    <div className="flex items-center gap-1" data-testid="feedback-buttons">
      <button
        type="button"
        onClick={() => submit('up')}
        disabled={!!submitted || pending}
        data-testid="feedback-up"
        aria-label="Rate helpful"
        className={`rounded px-1.5 py-0.5 text-xs ${
          submitted === 'up'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => submit('down')}
        disabled={!!submitted || pending}
        data-testid="feedback-down"
        aria-label="Rate unhelpful"
        className={`rounded px-1.5 py-0.5 text-xs ${
          submitted === 'down'
            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        👎
      </button>
    </div>
  );
}
