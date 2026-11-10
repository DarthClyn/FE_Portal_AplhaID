// The demo script: two flows (issue an eLC, verify eLCs from other banks). Each step highlights a part of the page
// (data-tour="…") and explains it. "action" steps are done by the viewer in manual mode, or by the moving cursor in
// auto mode; the tour moves on when "waitFor" appears.

export interface DemoStep {
  id: string;
  flow: 1 | 2;
  route?: string;
  /** CSS selector of the highlighted element; none = a centred card. */
  target?: string;
  title: string;
  body: string;
  /** What the viewer (manual) or the cursor (auto) clicks. */
  action?: { selector: string; label: string; real?: boolean };
  /** Selector that shows the action worked; the tour moves on once it appears. */
  waitFor?: string;
  /** Seconds to read the step in auto mode before acting / moving on. */
  dwell?: number;
  /** If the action's element is missing (e.g. an empty inbox), what the demo does instead. */
  fallback?: 'verify-sample';
}

export const STEPS: DemoStep[] = [
  {
    id: 'welcome', flow: 1,
    title: 'Welcome to the Bank Alpha eLC portal',
    body: 'Two short flows: first we issue an electronic Letter of Credit and sign it with the bank\'s own key, then we verify an eLC issued by another bank on another platform.',
    dwell: 5,
  },
  {
    id: 'overview', flow: 1, route: '/overview', target: '[data-tour="overview-stats"]',
    title: 'Overview',
    body: 'Every eLC Bank Alpha has issued: how many are active, which expire soon, and which have expired. The list below is searchable by Tx ID and VC ID.',
    dwell: 5,
  },
  {
    id: 'overview-table', flow: 1, route: '/overview', target: '[data-tour="overview-table"]',
    title: 'Issued eLCs',
    body: 'Each row is one eLC: its transaction ID, credential ID, issue and expiry dates, and live status. The eLC content itself is never stored here, only IDs and status.',
    dwell: 5,
  },
  {
    id: 'issue', flow: 1, route: '/issue', target: '[data-tour="fill-sample"]',
    title: 'Issue an eLC',
    body: 'The form follows the SWIFT MT700 layout. For the demo, fill it with sample values.',
    action: { selector: '[data-tour="fill-sample"]', label: 'Click "Fill sample data"' },
    waitFor: '[data-tour="ready"]',
    dwell: 3,
  },
  {
    id: 'form', flow: 1, route: '/issue', target: '[data-tour="issue-form"]',
    title: 'All required fields are filled',
    body: 'Credit, parties, amount, payment, shipment and documents. Each field shows its MT700 tag. The side panel confirms all required fields are complete.',
    dwell: 5,
  },
  {
    id: 'sign', flow: 1, route: '/issue', target: '[data-tour="sign"]',
    title: 'Sign and issue',
    body: 'Signing turns the form into a W3C verifiable credential, signed with Bank Alpha\'s own key (its DID). Any change afterwards is detectable.',
    action: { selector: '[data-tour="sign"]', label: 'Click "Sign & issue eLC"', real: true },
    waitFor: '[data-tour="issued"]',
    dwell: 3,
  },
  {
    id: 'send', flow: 1, route: '/issue', target: '[data-tour="download-elc"]',
    title: 'Send it to the advising bank',
    body: 'The eLC is active and recorded. Download the signed file and send it to the advising bank, which can verify it independently, on its own platform.',
    dwell: 6,
  },
  {
    id: 'flow2', flow: 2,
    title: 'Flow 2 · Verify eLCs issued by other banks',
    body: 'Now the other direction: an eLC issued by a bank on another platform arrives at Bank Alpha. We check it before relying on it.',
    dwell: 5,
  },
  {
    id: 'inbox', flow: 2, route: '/inbox', target: '[data-tour="inbox-table"]',
    title: 'Received eLCs',
    body: 'Files other platforms send to Bank Alpha land in the inbox. Select one and click Verify, or go to Verify eLC to upload a file from your device.',
    action: { selector: '[data-tour="inbox-verify"]', label: 'Click "Verify" on a file' },
    waitFor: '[data-tour="verify-result"]',
    dwell: 4,
    fallback: 'verify-sample',
  },
  {
    id: 'checks', flow: 2, route: '/verify', target: '[data-tour="verify-checks"]',
    title: 'Four independent checks',
    body: 'Integrity: unchanged since signing. Status: still active today. Issuer: signed by the issuer it names. Trusted issuer: that issuer is on the trusted list. "via PILA" means it was checked with PILA\'s SDK and NDAKey.',
    dwell: 7,
  },
  {
    id: 'verdict', flow: 2, route: '/verify', target: '[data-tour="verify-result"]',
    title: 'The verdict',
    body: 'All four checks must pass. Change a single character in the file and Integrity fails; an issuer outside the trusted list fails the last check.',
    dwell: 6,
  },
  {
    id: 'done', flow: 2,
    title: 'That\'s the demo',
    body: 'Issued with the bank\'s own key, verified across platforms in seconds, and every action recorded in the audit log.',
    dwell: 6,
  },
];
