# UX Test Checklist

Tests marked `[AUTOMATED]` are covered by Playwright E2E tests and run via `pnpm playwright test` in `apps/copilot-service/`.
Tests marked `[MANUAL]` require a human tester with a running app and seeded database (or specific visual/subjective judgment).

---

## Navigation & Layout

1. **Top nav links** — Click "Tickets" and "+ New Ticket" in the CRM header; verify both land on the correct pages
   `[MANUAL — requires running CRM with seeded database]`

2. **Breadcrumb back links** — On the ticket detail page, click "← All Tickets" / "← Back to Tickets"; verify it returns to the list with filters preserved
   `[MANUAL — requires running CRM with seeded database]`

3. **Dark mode toggle** — Toggle dark mode on CRM and copilot service; verify all text remains readable with no invisible-on-dark elements
   `[MANUAL — requires visual inspection]`

4. **Mobile layout at 390px** — Resize browser to 390px wide; verify ticket list table scrolls horizontally without clipping, form fields stack without overflow, CopilotPanel is readable without horizontal scroll
   `[MANUAL — requires visual inspection at 390px viewport]`

---

## Ticket List (CRM)

5. **Filter by status** — Select "Open" from the status dropdown, click Filter; verify only open tickets appear; click "Clear filters" and verify full list returns
   `[MANUAL — requires running CRM with seeded database]`

6. **Filter by priority** — Select "Critical", click Filter; verify only critical tickets show
   `[MANUAL — requires running CRM with seeded database]`

7. **Combined filters** — Set both status and priority; verify intersection is returned
   `[MANUAL — requires running CRM with seeded database]`

8. **Search by title** — Type a partial ticket title, click Filter; verify matching results
   `[MANUAL — requires running CRM with seeded database]`

9. **Search by customer name** — Search a customer name; verify results
   `[MANUAL — requires running CRM with seeded database]`

10. **Empty state** — Filter to a combination that yields no tickets; verify the empty state renders with "Generate dummy tickets" and "Create first ticket" actions
    `[MANUAL — requires running CRM with seeded database]`

---

## Create Ticket (CRM)

11. **Required field validation** — Submit the new ticket form with Title blank; verify the browser native validation blocks submit and focuses the Title field
    `[MANUAL — requires running CRM]`

12. **Required field validation (description)** — Leave Description blank; verify validation blocks and focuses Description
    `[MANUAL — requires running CRM]`

13. **All fields populated** — Fill all fields including optional Org, Product Area, Channel; submit; verify ticket appears in list with correct data
    `[MANUAL — requires running CRM with seeded database]`

14. **Cancel button** — Click Cancel on the new ticket form; verify navigation returns to the list without creating a ticket
    `[MANUAL — requires running CRM]`

---

## Ticket Detail (CRM)

15. **Status change** — Click each status button (Open, In Progress, Resolved, Closed) in the sidebar; verify the button highlights and the badge in the header updates on page reload
    `[MANUAL — requires running CRM with seeded database]`

16. **Add reply (Agent)** — Type a message, set Author Type to Agent, click "Add Reply"; verify the message appears in the thread with blue styling
    `[MANUAL — requires running CRM with seeded database]`

17. **Add reply (Customer)** — Repeat with Author Type Customer; verify white/border styling
    `[MANUAL — requires running CRM with seeded database]`

18. **Delete ticket** — Click Delete in the Danger Zone; verify a confirmation prompt appears and the ticket is removed from the list after confirming
    `[MANUAL — requires running CRM with seeded database]`

---

## AI Copilot Panel

19. **Analyze Ticket** — Click "Analyze Ticket"; verify the loading skeleton appears, then results render with Extracted Signals, Hypotheses, Clarifying Questions, and Next Steps sections
    `[AUTOMATED — e2e/ux-tests.spec.ts: "analyze ticket shows loading then results"]`

20. **Collapsible Extracted Signals** — Click the "Extracted Signals" summary to collapse; verify content hides; click again to expand
    `[AUTOMATED — e2e/ux-tests.spec.ts: "collapsible extracted signals section"]`

21. **Collapsible Hypotheses** — Same collapse/expand test on Hypotheses section
    `[AUTOMATED — e2e/ux-tests.spec.ts: "collapsible hypotheses section"]`

22. **Copy Hypotheses** — Click Copy button on the Hypotheses header; paste into a text editor; verify hypotheses text is present
    `[AUTOMATED — e2e/ux-tests.spec.ts: "copy hypotheses shows toast"]`

23. **Copy Clarifying Questions** — Click Copy on Clarifying Questions; verify pasted content matches
    `[AUTOMATED — e2e/ux-tests.spec.ts: "copy clarifying questions shows toast"]`

24. **Copy Next Steps** — Click Copy on Next Steps; verify pasted content matches
    `[AUTOMATED — e2e/ux-tests.spec.ts: "copy next steps shows toast"]`

25. **Suggest Next Steps** — Click "Suggest Next Steps"; verify loading state then step list renders with a Copy button
    `[AUTOMATED — e2e/ux-tests.spec.ts: "suggest next steps shows loading then result"]`

26. **Copy Steps result** — Click Copy on the steps result; verify paste contains all steps
    `[AUTOMATED — e2e/ux-tests.spec.ts: "copy steps result shows toast"]`

---

## Draft Generation

27. **Generate Customer Reply** — Select "Customer Reply" + "Professional" tone, click "Generate Draft"; verify the draft textarea populates with a professional-sounding reply
    `[AUTOMATED — e2e/copilot.spec.ts: "should generate a customer reply draft"]`

28. **Tone variation** — Generate drafts with Friendly, Concise, and Surfer tones; verify the tone is noticeably different each time
    `[MANUAL — requires subjective quality judgment across tone variants]`

29. **Generate Internal Note** — Switch type to "Internal Note"; verify tone selector disappears; generate and verify draft is agent-facing in style
    `[AUTOMATED — e2e/copilot.spec.ts: "should generate an internal note (no tone selector)"]`

30. **Generate Escalation** — Switch to "Escalation"; generate; verify draft reads as a handoff document
    `[AUTOMATED — e2e/copilot.spec.ts: "should generate an escalation draft"]`

31. **Edit draft** — Modify text in the draft textarea; verify Save button becomes active
    `[AUTOMATED — e2e/copilot.spec.ts: "should enable Save when draft is edited"]`

32. **Save draft** — Click Save; verify "Draft saved ✓" toast appears and the button shows saved state
    `[AUTOMATED — e2e/copilot.spec.ts: "should save draft and show toast"]`

33. **Copy draft** — Click Copy; verify "Copied to clipboard" toast appears and paste produces the draft text
    `[AUTOMATED — e2e/copilot.spec.ts: "should copy draft and show toast"]`

34. **Mark as Sent** — Click "Mark as Sent"; verify button turns green with "Sent ✓" and cannot be clicked again
    `[AUTOMATED — e2e/ux-tests.spec.ts: "mark as sent disables button"]`

35. **Draft persists on reload** — Generate and save a customer reply draft; reload the page; verify the draft reloads from localStorage
    `[AUTOMATED — e2e/copilot.spec.ts: "should persist draft across page reload"]`

---

## Chat

36. **Ask a question** — Type a question in the Ask Me a Question field, press Enter; verify loading state then an answer appears with a Copy button
    `[AUTOMATED — e2e/ux-tests.spec.ts: "chat submit via Enter key"]`

37. **Ask via button** — Type a question and click "Ask" instead of pressing Enter; verify same behavior
    `[AUTOMATED — e2e/ux-tests.spec.ts: "chat submit via Ask button"]`

38. **Empty input** — Verify the Ask button is disabled when the input is empty
    `[AUTOMATED — e2e/ux-tests.spec.ts: "Ask button disabled when input is empty"]`

39. **Copy answer** — Click Copy on the chat answer; verify paste contains the full answer text
    `[AUTOMATED — e2e/ux-tests.spec.ts: "copy chat answer shows toast"]`

---

## Ticket Status (Copilot Panel)

40. **Status toggle** — Click each status button (Open, In Progress, Resolved, Closed); verify only the active one is highlighted and the backend updates (visible on CRM reload)
    `[AUTOMATED — e2e/ux-tests.spec.ts: "status toggle highlights active button" (UI state); backend persistence requires running CRM — manual]`

41. **Status feedback message** — After clicking a status button, verify a brief "Status updated to…" message appears below the buttons and auto-dismisses
    `[AUTOMATED — e2e/ux-tests.spec.ts: "status toggle shows feedback message"]`

---

## Similar Cases

42. **Similar cases load** — Open a ticket that has resolved similar cases in the DB; verify the Similar Cases section renders with title, product area badge, score %, and resolution snippet
    `[AUTOMATED — e2e/copilot.spec.ts: "should show similar resolved cases"]`

43. **No similar cases** — Open a ticket with no matches; verify "No similar resolved cases found." message
    `[AUTOMATED — e2e/copilot.spec.ts: "should show empty similar cases message"]`

44. **Apply pattern** — Click Apply on a similar case; verify "Applying pattern — generating draft…" toast appears, then the draft textarea populates with a reply derived from that case's resolution
    `[AUTOMATED — e2e/copilot.spec.ts: "should apply similar case pattern and populate draft"]`

---

## Demo Mode

45. **Run Demo** — Click "▶ Run Demo"; verify the sequence of toasts ("Demo starting — analyzing ticket…" → "Analysis complete — generating draft…" → "Demo complete — edit and save the draft below"); verify analysis result renders then draft populates
    `[AUTOMATED — e2e/copilot.spec.ts: "happy demo path — draft populates"]`

46. **Demo button disabled during run** — While demo is running, verify the button shows "Running demo…" and is disabled; verify Analyze and Suggest buttons are also disabled
    `[AUTOMATED — e2e/copilot.spec.ts: "demo button is disabled while running"]`

47. **Demo error recovery** — With a bad API key (if testable), verify an error toast appears and the button re-enables
    `[MANUAL — requires ability to inject a bad API key at test time]`

---

## Toast Notifications

48. **Toast auto-dismiss** — Trigger any toast (e.g., Copy); verify it disappears after ~3 seconds without user action
    `[AUTOMATED — e2e/ux-tests.spec.ts: "toast auto-dismisses after timeout"]`

49. **Multiple toasts** — Trigger several actions quickly (Copy, Save, Apply); verify multiple toasts stack and each dismisses independently
    `[AUTOMATED — e2e/ux-tests.spec.ts: "multiple toasts stack independently"]`

50. **Error toast styling** — Trigger a failure condition (e.g., save draft with network blocked); verify error toast is visually distinct (red background)
    `[MANUAL — requires visual inspection of error toast styling]`

---

## Provider Badge

51. **Badge visible** — Open the CopilotPanel; verify the provider badge shows "openai" (or the configured provider) in the panel header at all times
    `[AUTOMATED — e2e/ux-tests.spec.ts: "provider badge is visible in panel header"]`

---

## Accessibility (keyboard-only walkthrough)

52. **Tab through ticket list** — Tab through the tickets page; verify focus order is: search → status filter → priority filter → Filter button → ticket title links → pagination/actions
    `[AUTOMATED — e2e/ux-tests.spec.ts: "chat input and Ask button are keyboard-reachable" (copilot panel); full CRM tab order requires running CRM — manual]`

53. **Tab through new ticket form** — Tab through all fields in order; verify nothing is skipped and all fields are reachable
    `[MANUAL — requires running CRM]`

54. **Enter to submit chat** — Focus the chat input, type a question, press Enter; verify it submits without clicking the button
    `[AUTOMATED — e2e/ux-tests.spec.ts: "chat submit via Enter key"]`

55. **Status button keyboard** — Tab to the ticket status button group in CopilotPanel; use Tab/Space/Enter to change status; verify it works without a mouse
    `[AUTOMATED — e2e/ux-tests.spec.ts: "status buttons are keyboard-accessible"]`

56. **Collapsible sections keyboard** — Tab to an Extracted Signals or Hypotheses `<summary>`, press Enter/Space; verify it toggles open/closed
    `[AUTOMATED — e2e/ux-tests.spec.ts: "collapsible sections toggle with keyboard"]`
