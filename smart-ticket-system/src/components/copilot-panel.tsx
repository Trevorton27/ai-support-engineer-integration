'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  checkCopilotAvailability,
  copilotAnalyze,
  copilotSuggest,
  copilotDraft,
  copilotAsk,
} from '@/app/(dashboard)/tickets/[id]/copilot-actions';
import type { TicketSnapshot } from '@/lib/copilotClient';

type CopilotPanelProps = {
  snapshot: TicketSnapshot;
};

export function CopilotPanel({ snapshot }: CopilotPanelProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [resultLabel, setResultLabel] = useState<string>('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'concise'>(
    'professional',
  );
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    checkCopilotAvailability().then(setAvailable);
  }, []);

  if (available === null) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm text-gray-500">Checking Copilot...</p>
      </div>
    );
  }

  if (!available) {
    return (
      <div
        className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
        data-testid="copilot-unavailable"
      >
        <h3 className="mb-2 text-sm font-semibold">AI Copilot</h3>
        <p className="text-sm text-gray-500">
          Copilot unavailable — configure{' '}
          <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
            COPILOT_API_BASE_URL
          </code>{' '}
          to enable AI features.
        </p>
      </div>
    );
  }

  const handleAction = (
    label: string,
    action: () => Promise<{ ok: boolean; data?: unknown; error?: string }>,
  ) => {
    setResultLabel(label);
    setResult(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setResult(JSON.stringify(res.data, null, 2));
      } else {
        setResult(`Error: ${res.error}`);
      }
    });
  };

  return (
    <div
      className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      data-testid="copilot-panel"
    >
      <h3 className="text-sm font-semibold">AI Copilot</h3>

      <div className="space-y-2">
        <button
          onClick={() =>
            handleAction('Analysis', () => copilotAnalyze(snapshot))
          }
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Analyze Ticket
        </button>

        <button
          onClick={() =>
            handleAction('Suggestions', () => copilotSuggest(snapshot))
          }
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Suggest Next Steps
        </button>

        <div className="flex gap-2">
          <select
            value={tone}
            onChange={(e) =>
              setTone(
                e.target.value as 'professional' | 'friendly' | 'concise',
              )
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="concise">Concise</option>
          </select>
          <button
            onClick={() =>
              handleAction('Draft Reply', () =>
                copilotDraft(snapshot, tone),
              )
            }
            disabled={isPending}
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
                handleAction('Copilot', () =>
                  copilotAsk(snapshot, chatInput),
                );
                setChatInput('');
              }
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            onClick={() => {
              if (chatInput.trim()) {
                handleAction('Copilot', () =>
                  copilotAsk(snapshot, chatInput),
                );
                setChatInput('');
              }
            }}
            disabled={isPending || !chatInput.trim()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Ask
          </button>
        </div>
      </div>

      {isPending && (
        <p className="text-xs text-gray-500">Processing...</p>
      )}

      {result && (
        <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-900">
          <p className="mb-1 text-xs font-medium text-gray-500">
            {resultLabel}
          </p>
          <pre className="whitespace-pre-wrap text-xs">{result}</pre>
        </div>
      )}
    </div>
  );
}
