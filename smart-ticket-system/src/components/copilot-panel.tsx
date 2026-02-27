'use client';

import { useEffect, useState } from 'react';
import {
  analyzeTicketAsync,
  suggestNextStepsAsync,
  draftReplyAsync,
  chatAsync,
  pollStatus,
  type TicketSnapshot,
} from '@/lib/copilotClient';

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
  const [tone, setTone] = useState<'professional' | 'friendly' | 'concise'>(
    'professional',
  );
  const [chatInput, setChatInput] = useState('');

  // Polling effect
  useEffect(() => {
    if (
      !currentJob ||
      currentJob.state === 'success' ||
      currentJob.state === 'error'
    ) {
      return;
    }

    const interval = setInterval(async () => {
      const statusResult = await pollStatus(currentJob.suggestionId);

      if (statusResult.ok) {
        setCurrentJob(statusResult.data as SuggestionState);

        if (statusResult.data.state === 'success') {
          setResult(statusResult.data.content);
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

  const handleDraftReply = async () => {
    setResult(null);
    setResultType('draft');
    const res = await draftReplyAsync(snapshot.id, tone);
    if (res.ok) {
      setCurrentJob(res.data as SuggestionState);
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
      <div
        className={`inline-block rounded px-2 py-1 text-xs ${stateColors[currentJob.state]}`}
        data-testid="copilot-state"
      >
        {stateLabels[currentJob.state]}
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
      </div>
    );
  };

  const renderStepsResult = (data: { steps: string[] }) => {
    return (
      <div>
        <span className="font-medium">Next Steps:</span>
        <ul className="ml-5 mt-1 list-disc">
          {data.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderDraftResult = (data: { reply: string }) => {
    return (
      <div>
        <span className="font-medium">Draft Reply:</span>
        <p className="mt-1 whitespace-pre-wrap">{data.reply}</p>
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
          className="mt-2 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
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

      <div className="space-y-2">
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          data-testid="analyze-button"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Analyze Ticket
        </button>

        <button
          onClick={handleSuggest}
          disabled={isLoading}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Suggest Next Steps
        </button>

        <div className="flex gap-2">
          <select
            value={tone}
            onChange={(e) =>
              setTone(e.target.value as 'professional' | 'friendly' | 'concise')
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="concise">Concise</option>
          </select>
          <button
            onClick={handleDraftReply}
            disabled={isLoading}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Draft Reply
          </button>
        </div>

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
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
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
