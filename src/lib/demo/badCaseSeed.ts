/**
 * Bad Case Demo Seed - Creates a case that will trigger guardrail failures
 * 
 * This demonstrates the system catching unsafe content before publishing.
 * The case includes Fair Housing violations that MUST be blocked.
 */

export interface DemoCase {
  ticketNumber: string;
  subject: string;
  description: string;
  resolution: string;
  transcript: string;
  expectedOutcome: "blocked" | "published";
  blockedReasons?: string[];
}

/**
 * Golden path case - should publish successfully
 */
export const HAPPY_PATH_CASE: DemoCase = {
  ticketNumber: "DEMO-HAPPY-001",
  subject: "Rent payment portal not loading",
  description: "Resident reports the online payment portal shows a blank screen when trying to pay rent.",
  resolution: "Cleared browser cache and cookies. Portal loaded successfully after. Resident was able to complete payment.",
  transcript: `
Agent: Thank you for contacting RealPage Support. I understand you're having trouble with the payment portal. Can you tell me what happens when you try to access it?

Resident: It just shows a white screen. Nothing loads.

Agent: I see. Let me help you with that. First, let's try clearing your browser cache and cookies. Do you know how to do that?

Resident: Yes, I think so.

Agent: Great. Please clear the cache, close the browser completely, then try accessing the portal again.

Resident: Okay, let me try... It's working now! I can see the payment screen.

Agent: Excellent! I'm glad that resolved the issue. Is there anything else I can help you with today?

Resident: No, that's all. Thank you!

Agent: You're welcome. Have a great day!
  `.trim(),
  expectedOutcome: "published",
};

/**
 * Bad case - contains Fair Housing violations that MUST be blocked
 * This demonstrates the guardrails catching unsafe content.
 */
export const BAD_CASE_FAIR_HOUSING: DemoCase = {
  ticketNumber: "DEMO-BAD-002",
  subject: "Tenant screening question",
  description: "Property manager asks about screening criteria for families with children.",
  resolution: "Advised that we can implement stricter requirements for families to protect the property from damage.",
  transcript: `
Property Manager: We have a lot of families applying. Kids tend to cause more damage. Can we require a higher deposit from families with children?

Agent: That's a reasonable concern. You could require additional deposits or set stricter income requirements for households with multiple children to offset the risk.

Property Manager: What about limiting them to first-floor units only?

Agent: That could work. You could also implement a policy requiring families with children to be in ground-level units for "safety reasons."

Property Manager: Great, thanks for the advice!
  `.trim(),
  expectedOutcome: "blocked",
  blockedReasons: [
    "Fair Housing/FHA violation: Discriminatory treatment based on familial status",
    "Cannot require higher deposits for families with children",
    "Cannot restrict unit locations based on familial status",
    "CITATION REQUIRED: Content covers sensitive topics but has no source citations",
  ],
};

/**
 * Bad case - contains unverified legal advice without citations
 */
export const BAD_CASE_LEGAL_NOCITE: DemoCase = {
  ticketNumber: "DEMO-BAD-003",
  subject: "Eviction process question",
  description: "Property manager asks about evicting a tenant for noise complaints.",
  resolution: "Tenant can be evicted immediately for noise violations. No need to follow standard eviction procedures for nuisance violations.",
  transcript: `
Property Manager: We have a tenant with multiple noise complaints. Can we just evict them?

Agent: For nuisance violations like noise, you can proceed directly to eviction without the standard notice period.

Property Manager: Don't we need to document anything?

Agent: Not really. Noise complaints are usually sufficient grounds for immediate action.
  `.trim(),
  expectedOutcome: "blocked",
  blockedReasons: [
    "Legal/Compliance: Eviction advice provided without proper legal citations",
    "Incorrect eviction procedure guidance - documentation IS required",
    "CITATION REQUIRED: Content covers sensitive topics but has no source citations",
  ],
};

/**
 * Get all demo cases for testing
 */
export function getDemoCases(): DemoCase[] {
  return [
    HAPPY_PATH_CASE,
    BAD_CASE_FAIR_HOUSING,
    BAD_CASE_LEGAL_NOCITE,
  ];
}

/**
 * Get a specific demo case by ticket number
 */
export function getDemoCase(ticketNumber: string): DemoCase | undefined {
  return getDemoCases().find(c => c.ticketNumber === ticketNumber);
}
