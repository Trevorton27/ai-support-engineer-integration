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
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category: string;
  urgency?: string;
  suggestedActions?: string[];
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
    return (
      <div className="space-y-2" data-testid="analysis-summary">
        <div>
          <span className="font-medium">Summary:</span> {data.summary}
        </div>
        <div>
          <span className="font-medium">Sentiment:</span>{' '}
          <span
            className={`ml-2 rounded px-2 py-1 text-xs ${
              data.sentiment === 'positive'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : data.sentiment === 'negative'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            {data.sentiment}
          </span>
        </div>
        <div>
          <span className="font-medium">Category:</span> {data.category}
        </div>
        {data.urgency && (
          <div>
            <span className="font-medium">Urgency:</span> {data.urgency}
          </div>
        )}
        {data.suggestedActions && data.suggestedActions.length > 0 && (
          <div>
            <span className="font-medium">Suggested Actions:</span>
            <ul className="ml-5 mt-1 list-disc">
              {data.suggestedActions.map((action, i) => (
                <li key={i}>{action}</li>
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
