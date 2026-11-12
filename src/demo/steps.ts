// The demo script: two flows (issue an eLC, verify eLCs from other banks). Each step highlights a part of the page
// (data-tour="…") and explains it. "action" steps are done by the viewer in manual mode, or by the moving cursor in
// auto mode; the tour moves on when "waitFor" appears.

export interface DemoStep {
  id: string;
  flow: 1 | 2;
  route?: string;
  /** CSS selector(s) of the highlighted element(s); several matches are highlighted as one area. None = a centred card. */
  target?: string;
  /** Place the step card next to this element instead of the whole highlighted area. */
  cardAnchor?: string;
  title: string;
  body: string;
  /** What the viewer (manual) or the cursor (auto) clicks. */
  action?: { selector: string; label: string; real?: boolean };
  /** Selector that shows the action worked; the tour moves on once it appears. */
  waitFor?: string;
  /** Seconds to read the step in auto mode before acting / moving on. */
  dwell?: number;
  /** Seconds to wait for waitFor after the action before moving on anyway (e.g. a partner service is slow). */
  waitTimeout?: number;
  /** If the action's element is missing (e.g. an empty inbox), what the demo does instead. */
  fallback?: 'verify-sample';
}

export const STEPS: DemoStep[] = [
  {
    id: 'overview', flow: 1, route: '/overview',
    target: '[data-tour="overview-stats"], [data-tour="overview-table"]', cardAnchor: '[data-tour="overview-stats"]',
    title: 'Overview',
    body: 'Every eLC Bank Alpha has issued: how many are active, expiring soon or expired, and one row per eLC with its Tx ID, VC ID, dates, live status and whether it was sent to the advising bank. Only IDs and status are kept here, never the eLC content.',
    dwell: 7,
  },
  {
    id: 'issue', flow: 1, route: '/issue', target: '[data-tour="fill-sample"]',
    title: 'Issue an eLC',
    body: 'The form follows the SWIFT MT700 layout: credit, parties, amount, payment, shipment and documents. For the demo, fill it with sample values.',
    action: { selector: '[data-tour="fill-sample"]', label: 'Click "Fill details"' },
    waitFor: '[data-tour="ready"]',
    dwell: 4,
  },
  {
    id: 'sign', flow: 1, route: '/issue', target: '[data-tour="sign"]',
    title: 'Sign and issue',
    body: 'All required fields are complete. Signing turns the form into a W3C verifiable credential, signed with Bank Alpha\'s own key (its DID). Any change afterwards is detectable.',
    action: { selector: '[data-tour="sign"]', label: 'Click "Sign & issue eLC"', real: true },
    waitFor: '[data-tour="issued"]',
    dwell: 4,
  },
  {
    id: 'send', flow: 1, route: '/issue', target: '[data-tour="send-elc"]',
    title: 'Send it to the advising bank',
    body: 'The eLC is active and names its advising bank, Bank Beta in Vietnam. One click delivers it to Bank Beta\'s inbox on PILA, where it is checked independently. Overview then shows it as sent.',
    action: { selector: '[data-tour="send-elc"]', label: 'Click "Send to Bank Beta"', real: true },
    waitFor: '[data-tour="elc-sent"]',
    waitTimeout: 15,
    dwell: 5,
  },
  {
    id: 'inbox', flow: 2, route: '/inbox', target: '[data-tour="inbox-table"]',
    title: 'Verify eLCs issued by other banks',
    body: 'eLCs other platforms send to Bank Alpha land in the inbox. Select one and click Verify, or go to Verify eLC to upload a file from your device.',
    action: { selector: '[data-tour="inbox-verify"]', label: 'Click "Verify" on a file' },
    waitFor: '[data-tour="verify-result"]',
    dwell: 5,
    fallback: 'verify-sample',
  },
  {
    id: 'checks', flow: 2, route: '/verify',
    target: '[data-tour="verify-checks"], [data-tour="verify-result"]', cardAnchor: '[data-tour="verify-result"]',
    title: 'Four checks, one verdict',
    body: 'Integrity: unchanged since signing. Status: active today. Issuer: signed by the issuer it names. Trusted issuer: on the trusted list. All four must pass. "via PILA" or "via TOTM" shows who checked it.',
    dwell: 9,
  },
];
